import mongoose from "mongoose";

import { ProjectMember } from "../models/project-member.model.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * validateProjectPermission([roles]) - must run AFTER verifyJWT.
 * Pass the roles allowed on the route; pass nothing to allow any member.
 * Gives the user it's role in the project
 */

export const validateProjectPermission = (roles = []) => asyncHandler(async (req, res, next) => {
    const { projectId } = req.params;

    // checking if it's a valid project ID
    if (!mongoose.isValidObjectId(projectId)) {
        throw new ApiError(400, "Invalid project id");
    }

    // finding the current logged in user's role in the current project
    const membership = await ProjectMember.findOne({
        project: projectId,
        user: req.user._id,
    });

    // Non-members get the same 404 as a missing project,
    // so the API doesn't reveal which projects exist.
    if (!membership) {
        throw new ApiError(404, "Project not found");
    }

    if (roles.length > 0 && !roles.includes(membership.role)) {
        throw new ApiError(403, "You do not have permission to perform this action");
    }

    req.projectMember = membership; // controllers can read req.projectMember.role
    next();

});