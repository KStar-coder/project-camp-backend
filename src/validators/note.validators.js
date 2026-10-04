import { body, param } from "express-validator";

const contentRule = () =>
    body("content")
        .trim()
        .notEmpty()
        .withMessage("Note content is required")
        .isLength({ max: 5000 })
        .withMessage("Note content cannot exceed 5000 characters");

const createNoteValidator = () => {
    return [contentRule()];
};

// PUT replaces the note's content, so content is required here too
const updateNoteValidator = () => {
    return [
        param("noteId").isMongoId().withMessage("Invalid note id"),
        contentRule(),
    ];
};

const noteIdParamValidator = () => {
    return [param("noteId").isMongoId().withMessage("Invalid note id")];
};

export { createNoteValidator, updateNoteValidator, noteIdParamValidator };