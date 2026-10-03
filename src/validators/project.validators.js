import { body, param } from "express-validator";
import { AvailableUserRole } from "../utils/constants.js";

const roleMessage = `Role must be one of: ${AvailableUserRole.join(", ")}`;

const createProjectValidator = () => {
    return [
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Project name is required")
            .isLength({ max: 100 })
            .withMessage("Project name cannot exceed 100 characters"),
        body("description")
            .optional()
            .trim()
            .isLength({ max: 1000 })
            .withMessage("Description cannot exceed 1000 characters"),
    ];
};

// PUT /:projectId -> both fields are optional, but if "name" is sent it can't be blank.
// The controller also checks that at least one of them was sent.
const updateProjectValidator = () => {
    return [
        body("name")
            .optional()
            .trim()
            .notEmpty()
            .withMessage("Project name cannot be empty")
            .isLength({ max: 100 })
            .withMessage("Project name cannot exceed 100 characters"),
        body("description")
            .optional()
            .trim()
            .isLength({ max: 1000 })
            .withMessage("Description cannot exceed 1000 characters"),
    ];
};

const addMemberValidator = () => {
    return [
        body("email")
            .trim()
            .toLowerCase()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("role")
            .optional()
            .isIn(AvailableUserRole)
            .withMessage(roleMessage),
    ];
};

const updateMemberRoleValidator = () => {
    return [
        param("userId")
            .isMongoId()
            .withMessage("Invalid user id"),
        body("role")
            .notEmpty()
            .withMessage("Role is required")
            .bail()
            .isIn(AvailableUserRole)
            .withMessage(roleMessage),
    ];
};

const memberIdParamValidator = () => {
    return [
        param("userId")
            .isMongoId()
            .withMessage("Invalid user id"),
    ];
};

export {
    createProjectValidator,
    updateProjectValidator,
    addMemberValidator,
    updateMemberRoleValidator,
    memberIdParamValidator,
};