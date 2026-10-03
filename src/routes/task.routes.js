import { Router } from "express";
import {
    getTasks,
    createTask,
    getTaskById,
    updateTask,
    deleteTask,
    createSubTask,
    updateSubTask,
    deleteSubTask,
} from "../controllers/task.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateProjectPermission } from "../middlewares/permission.middleware.js";
import { uploadAttachments } from "../middlewares/multer.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
    listTasksValidator,
    taskIdParamValidator,
    createTaskValidator,
    updateTaskValidator,
    createSubTaskValidator,
    updateSubTaskValidator,
    subTaskIdParamValidator,
} from "../validators/task.validators.js";
import { UserRolesEnum } from "../utils/constants.js";

const router = Router();

const canManageTasks = [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN];

// every task route needs a logged-in user
router.use(verifyJWT);

// Order matters on upload routes:
//   permission check -> multer (saves files, fills req.body) -> validators -> controller
// Permission goes first so someone without access can never write files to disk.

router
    .route("/:projectId")
    .get(validateProjectPermission(), listTasksValidator(), validate, getTasks)
    .post(
        validateProjectPermission(canManageTasks),
        uploadAttachments,
        createTaskValidator(),
        validate,
        createTask
    );

router
    .route("/:projectId/t/:taskId")
    .get(validateProjectPermission(), taskIdParamValidator(), validate, getTaskById)
    .put(
        validateProjectPermission(canManageTasks),
        uploadAttachments,
        updateTaskValidator(),
        validate,
        updateTask
    )
    .delete(
        validateProjectPermission(canManageTasks),
        taskIdParamValidator(),
        validate,
        deleteTask
    );

router
    .route("/:projectId/t/:taskId/subtasks")
    .post(
        validateProjectPermission(canManageTasks),
        createSubTaskValidator(),
        validate,
        createSubTask
    );

router
    .route("/:projectId/st/:subTaskId")
    // any member may call this; the controller restricts members to isCompleted only
    .put(validateProjectPermission(), updateSubTaskValidator(), validate, updateSubTask)
    .delete(
        validateProjectPermission(canManageTasks),
        subTaskIdParamValidator(),
        validate,
        deleteSubTask
    );

export default router;