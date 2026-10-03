import { body, param, query } from "express-validator";
import { AvailableTaskStatuses } from "../utils/constants.js";

const statusMessage = `Status must be one of: ${AvailableTaskStatuses.join(", ")}`;

// NOTE: on routes that accept file uploads, multer must run BEFORE these validators,
// because multer is what fills req.body for multipart/form-data requests.

const listTasksValidator = () => {
    return [
        query("status")
            .optional()
            .isIn(AvailableTaskStatuses)
            .withMessage(statusMessage),
    ];
};

const taskIdParamValidator = () => {
    return [param("taskId").isMongoId().withMessage("Invalid task id")];
};

const createTaskValidator = () => {
    return [
        body("title")
            .trim()
            .notEmpty()
            .withMessage("Task title is required")
            .isLength({ max: 200 })
            .withMessage("Title cannot exceed 200 characters"),
        body("description")
            .optional()
            .trim()
            .isLength({ max: 2000 })
            .withMessage("Description cannot exceed 2000 characters"),
        // "falsy" -> an empty string from a form is treated as "not sent"
        body("assignedTo")
            .optional({ values: "falsy" })
            .isMongoId()
            .withMessage("assignedTo must be a valid user id"),
        body("status")
            .optional()
            .isIn(AvailableTaskStatuses)
            .withMessage(statusMessage),
    ];
};

const updateTaskValidator = () => {
    return [
        param("taskId").isMongoId().withMessage("Invalid task id"),
        body("title")
            .optional()
            .trim()
            .notEmpty()
            .withMessage("Title cannot be empty")
            .isLength({ max: 200 })
            .withMessage("Title cannot exceed 200 characters"),
        body("description")
            .optional()
            .trim()
            .isLength({ max: 2000 })
            .withMessage("Description cannot exceed 2000 characters"),
        body("assignedTo")
            .optional({ values: "falsy" })
            .isMongoId()
            .withMessage("assignedTo must be a valid user id"),
        body("status")
            .optional()
            .isIn(AvailableTaskStatuses)
            .withMessage(statusMessage),
    ];
};

const createSubTaskValidator = () => {
    return [
        param("taskId").isMongoId().withMessage("Invalid task id"),
        body("title")
            .trim()
            .notEmpty()
            .withMessage("Subtask title is required")
            .isLength({ max: 200 })
            .withMessage("Title cannot exceed 200 characters"),
    ];
};

const updateSubTaskValidator = () => {
    return [
        param("subTaskId").isMongoId().withMessage("Invalid subtask id"),
        body("title")
            .optional()
            .trim()
            .notEmpty()
            .withMessage("Title cannot be empty")
            .isLength({ max: 200 })
            .withMessage("Title cannot exceed 200 characters"),
        body("isCompleted")
            .optional()
            .isBoolean()
            .withMessage("isCompleted must be true or false")
            .toBoolean(),
    ];
};

const subTaskIdParamValidator = () => {
    return [param("subTaskId").isMongoId().withMessage("Invalid subtask id")];
};

export {
    listTasksValidator,
    taskIdParamValidator,
    createTaskValidator,
    updateTaskValidator,
    createSubTaskValidator,
    updateSubTaskValidator,
    subTaskIdParamValidator,
};