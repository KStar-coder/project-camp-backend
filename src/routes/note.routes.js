import { Router } from "express";
import {
    getNotes,
    createNote,
    getNoteById,
    updateNote,
    deleteNote
} from "../controllers/note.controller.js"

import { verifyJWT } from "../middlewares/auth.middleware";
import { validateProjectPermission } from "../middlewares/permission.middleware";
import { validate } from "../middlewares/validator.middleware";

import {
    createNoteValidator,
    updateNoteValidator,
    noteIdParamValidator
} from "../validators/note.validators.js";
import { UserRolesEnum } from "../utils/constants";

const router = Router();

const adminOnly = [UserRolesEnum.ADMIN];

router.use(verifyJWT);

router.route("/:projectId")
    .get(validateProjectPermission(), getNotes)
    .post(validateProjectPermission(adminOnly), createNoteValidator(), validate, createNote);


router.route("/:projectId/n/:noteId")
    .get(validateProjectPermission(), noteIdParamValidator(), validate, getNoteById)
    .put(validateProjectPermission(adminOnly), updateNoteValidator(), validate, updateNote)
    .delete(validateProjectPermission(adminOnly), noteIdParamValidator(), validate, deleteNote);

export default router;