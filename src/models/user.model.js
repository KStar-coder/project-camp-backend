import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new Schema
    (
        {
            avatar: {
                type: {
                    url: String,
                    localPath: String,
                },
                default: {
                    url: `https://placehold.co/200`,
                    localPath: ""
                }
            },
            username: {
                type: String,
                required: true,
                trim: true,
                index: true,
                unique: true
            },
            email: {
                type: String,
                required: [true, "Email is required"],
                unique: true,
                lowercase: true,
                trim: true
            },
            fullName: {
                type: String,
                trim: true
            },
            password: {
                type: String,
                required: [true, "Password is required"] // incase password is not given this message pops 
            },
            isEmailVerified: {
                type: Boolean,
                default: false
            },
            refreshToken: {
                type: String
            },
            forgotPasswordToken: {
                type: String
            },
            forgotPasswordExpiry: {
                type: Date
            },
            emailVerificationToken: {
                type: String
            },
            emailVerificationExpiry: {
                type: Date
            }
        },

        {
            timestamps: true
        }
    );

/**
 * using mongoose hooks.
 * pre hook: used to perform an operation to the data right before saving it in the DB 
 * post hook: used to perform an operation to the data right after saving it in the DB
 */

/**
 * here, pre hook is used before saving it to hash the password before saving it in the DB
 * we will not use an arrow function because we need to use the this keyword which we cannot use with an arrow function 
 * the function takes (next) as a parameter to execute whatever is left to be executed after this function
 */

userSchema.pre("save", async function () {
    // if the password field is not modified, will skip this encryption and move to the next steps
    if (!this.isModified("password")) {
        return;
    }
    this.password = await bcrypt.hash(this.password, 10);
})

// Adding properties in the userSchema 

// password validation while logging in
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
}

// generate access token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

// generate refresh token
userSchema.methods.generateRefreshToken = function () {
    jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
}

// generate temporary tokens for email verification etc 
userSchema.methods.generateTemporaryToken = function () {
    const unHashedToken = crypto.randomBytes(20).toString("hex");

    const hashedToken = crypto.createHash("sha256").update(unHashedToken).digest("hex");

    const tokenExpiry = Date.now() + (20 * 60 * 1000) // 20 mins
    return { unHashedToken, hashedToken, tokenExpiry };
}

export const User = mongoose.model("User", userSchema);