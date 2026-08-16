import { User } from "../models/user.model.js";
import { ApiResponse } from '../utils/api-response.js'
import { ApiError } from '../utils/api-error.js'
import { asyncHandler } from '../utils/async-handler.js';
import mailgen from "mailgen";
import { emailVerificationMailgenContent, sendEmail } from "../utils/mail.js";


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
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`
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


export {
    registerUser
};
