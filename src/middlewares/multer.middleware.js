import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { ApiError } from "../utils/api-error.js";
import { UPLOAD_DIR } from "../utils/file.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_FILES_PER_REQUEST = 5;

// allowlist: MIME type -> the extension we will save the file with.
// We never trust the name or extension the client sends.
const ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
};

// make sure the folder exists (it is empty in git, so it may be missing on a fresh clone)
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    // random name -> no collisions, no path tricks, and URLs can't be guessed
    filename: (req, file, cb) =>
        cb(null, `${crypto.randomUUID()}${ALLOWED_TYPES[file.mimetype]}`),
});

const fileFilter = (req, file, cb) => {
    if (!Object.hasOwn(ALLOWED_TYPES, file.mimetype)) {
        return cb(new ApiError(400, `File type "${file.mimetype}" is not allowed`));
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST },
});

/**
 * Use on routes that accept attachments. Files go in the form field "attachments".
 * If the request is plain JSON (not multipart) it just calls next().
 * Multer's own errors are converted to ApiError so the global error handler returns JSON.
 */
export const uploadAttachments = (req, res, next) => {
    upload.array("attachments", MAX_FILES_PER_REQUEST)(req, res, (err) => {
        if (!err) return next();

        if (err instanceof ApiError) return next(err);

        if (err instanceof multer.MulterError) {
            const messages = {
                LIMIT_FILE_SIZE: `Each file must be ${MAX_FILE_SIZE / (1024 * 1024)} MB or smaller`,
                LIMIT_FILE_COUNT: `You can upload at most ${MAX_FILES_PER_REQUEST} files at a time`,
                LIMIT_UNEXPECTED_FILE: `Upload files using the field name "attachments" (max ${MAX_FILES_PER_REQUEST})`,
            };
            return next(new ApiError(400, messages[err.code] || err.message));
        }

        return next(err);
    });
};