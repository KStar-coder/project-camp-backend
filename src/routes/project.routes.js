import { Router } from "express";
import {
    getProjects,
    createProject,
    getProjectById,
    updateProject,
    deleteProject,
    getProjectMembers,
    addProjectMember,
    updateProjectMemberRole,
    removeProjectMember,
} from "../controllers/project.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateProjectPermission } from "../middlewares/permission.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
    createProjectValidator,
    updateProjectValidator,
    addMemberValidator,
    updateMemberRoleValidator,
    memberIdParamValidator,
} from "../validators/project.validators.js";
import { UserRolesEnum } from "../utils/constants.js";

const router = Router();

// every project route needs a logged-in user
router.use(verifyJWT);

router
    .route("/")
    .get(getProjects)
    .post(createProjectValidator(), validate, createProject);

router
    .route("/:projectId")
    .get(validateProjectPermission(), getProjectById)
    .put(
        validateProjectPermission([UserRolesEnum.ADMIN]),
        updateProjectValidator(),
        validate,
        updateProject
    )
    .delete(validateProjectPermission([UserRolesEnum.ADMIN]), deleteProject);

router
    .route("/:projectId/members")
    .get(validateProjectPermission(), getProjectMembers)
    .post(
        validateProjectPermission([UserRolesEnum.ADMIN]),
        addMemberValidator(),
        validate,
        addProjectMember
    );

router
    .route("/:projectId/members/:userId")
    .put(
        validateProjectPermission([UserRolesEnum.ADMIN]),
        updateMemberRoleValidator(),
        validate,
        updateProjectMemberRole
    )
    .delete(
        validateProjectPermission([UserRolesEnum.ADMIN]),
        memberIdParamValidator(),
        validate,
        removeProjectMember
    );

export default router;