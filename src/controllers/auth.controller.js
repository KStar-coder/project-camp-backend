import { User } from "../models/user.model.js";
import { ApiResponse } from '../utils/api-response.js'
import { ApiError } from '../utils/api-error.js'
import { asyncHandler } from '../utils/async-handler.js';
import crypto from "crypto";
import { emailVerificationMailgenContent, forgotPasswordMailgenContent, sendEmail } from "../utils/mail.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        // save the data 
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access token");
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const { email, username, password, role } = req.body;

    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedUsername = username?.trim();

    if (!normalizedEmail || !normalizedUsername || !password) {
        throw new ApiError(400, "Email, username and password are required", []);
    }

    // find if there's an existing user having the same username or email
    const existingUser = await User.findOne({
        $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
    });

    if (existingUser) {
        throw new ApiError(409, "User with email or username already exists", []);
    }

    // if user is not found, store it in the DB 
    const user = await User.create({
        email: normalizedEmail,
        password,
        username: normalizedUsername,
        isEmailVerified: false
    });

    // generating tokens after creating the user in the DB
    const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false }); // don't need to validate anything before saving as we are only creating a single user 

    // sending account creation confirmation email to the new user
    await sendEmail(
        {
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unHashedToken}`
            ),

        }
    );

    // we do not want to send the user everything as it is not required, so we remove the useless info
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering a user");
    }

    return res.status(201).json(
        new ApiResponse(
            200,
            { user: createdUser },
            "User registered successfully and verification email has been sent on your email"
        )
    )

});

const login = asyncHandler(async (req, res) => {
    const { email, password, username } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(400, "User with email does not exist");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Incorrect Password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
    );

    // cookies option
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully"
            )
        )
});

const logoutUser = asyncHandler(async (req, res) => {

    // Step 1: update the user data in the DB by clearing the refresh token.
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: ""
            }
        },
        {
            new: true
        }

    );

    // Step 2: set the options for the cookie
    const options = {
        httpOnly: true,
        secure: true
    }

    // Step 3: Clear the cookies and set the options for them.
    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User Logged Out")
        )
});

const getCurrentUser = asyncHandler(async (req, res) => {
    // req.user will give us the current user to we can simply return the response where we will return req.user 
    return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"));

});

const verifyEmail = asyncHandler(async (req, res) => {
    // email verification token is present in the req.params we need that 
    const { verificationToken } = req.params;

    if (!verificationToken) {
        throw new ApiError(400, "Email verification token is missing");
    }

    // encrypt the unhashed token 
    let hashedToken = crypto.createHash("sha256").update(verificationToken).digest("hex");

    // now this will give us the same hashed token that is contained in the DB
    // we also check if the email verification has expired or not by using greater than ($gt) the current date 
    // If the date is smaller than the current date that means the token has expired
    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpiry: { $gt: Date.now() }
    })
    if (!user) {
        throw new ApiError(400, "Token is invalid or expired");
    }

    //cleaning up unnecessary data 
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;

    user.isEmailVerified = true;

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, { isEmailVerified: true }, "Email is Verified"));

});

const resendEmailVerification = asyncHandler(async (req, res) => {

    // it can only be set by the user who is logged in 
    const user = await User.findById(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // Case where the user is trying to resent the verification code but is already verified
    if (user.isEmailVerified) {
        throw new ApiError(409, "Email is already verified");
    }

    // simply send the verificatoin email like normal user registration
    const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false }); // don't need to validate anything before saving as we are only creating a single user 

    // sending account creation confirmation email to the new user
    await sendEmail(
        {
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unHashedToken}`
            ),

        }
    );

    return res.status(200).json(new ApiResponse(200, {}, "Mail has been sent to your email ID"));

});
// we can resend the access token if it has expired by using the refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized access");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired");
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        // generate the access token 
        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);


        // update the DB 
        user.refreshToken = newRefreshToken;

        await user.save();

        return res
            .status(200)
            .cookie("accessToken", accessToken)
            .cookie("refreshToken", newRefreshToken)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            )

    } catch (error) {
        throw new ApiError(401, "Invalid refresh token");
    }

});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "User not found", []);
    }

    const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = tokenExpiry;

    await user.save({ validateBeforeSave: false });

    await sendEmail(
        {
            email: user?.email,
            subject: "Password reset request",
            mailgenContent: forgotPasswordMailgenContent(
                user.username,
                `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`
            ),
        }
    );

    return res.status(200).json(new ApiResponse(200, {}, "Password reset mail has been sent on your mail ID"));

});

const resetForgotPassword = asyncHandler(async (req, res) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;


    let hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: { $gt: Date.now() }

    })
    if (!user) {
        throw new ApiError(489, "Token is invalid or expired")
    }

    // set new password and remove these 2 fields in the DB
    user.forgotPasswordExpiry = undefined;
    user.forgotPasswordToken = undefined;

    user.password = newPassword;

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset successfully")
    );

});


const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));

});

//const getCurrentUser = asyncHandler(async(req, res) => {});


export {
    registerUser, login, logoutUser, getCurrentUser, verifyEmail, resendEmailVerification, refreshAccessToken, forgotPasswordRequest, resetForgotPassword, changeCurrentPassword
};
