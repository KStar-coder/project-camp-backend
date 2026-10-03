import fs from "fs/promises";
import path from "path";

// Same folder that app.js serves with express.static("public"),
// so a file saved here is reachable at /images/<filename>
export const UPLOAD_DIR = "./public/images";

/**
 * Deletes uploaded files from disk. Works with both:
 *  - multer file objects (req.files)      -> they have a "filename"
 *  - attachments stored on a task in DB   -> they have a "filename" too
 * It never throws: a file that is already gone is simply ignored.
 */
export const removeStoredFiles = (files = []) =>
    Promise.allSettled(
        files
            .filter((file) => file?.filename)
            .map((file) => fs.unlink(path.join(UPLOAD_DIR, path.basename(file.filename))))
    );