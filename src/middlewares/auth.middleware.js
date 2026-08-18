import { ApiError } from "../utils/api-error.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/async-handler.js";
import jwt from "jsonwebtoken";

/**
 * Function to quickly check if the user is online 
 * Intersect the incoming request in the middle ware and append the incoming request with the user information so if we want to check if the user is logged in we can simply do so by checking req.user is present or not.
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry");

        if (!user) {
            throw new ApiError(401, "invalid access token");
        }
        req.user = user;
        next();
    }
    catch (error) {
        throw new ApiError(401, "invalid access token");
    }
})