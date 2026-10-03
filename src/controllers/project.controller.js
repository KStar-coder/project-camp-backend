import mongoose from "mongoose";
import { Project } from "../models/project.model.js";
import { ProjectMember } from "../models/project-member.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { UserRolesEnum } from "../utils/constants.js";

/**
 * A project must always keep at least one admin, otherwise nobody can manage it.
 * Call this BEFORE demoting or removing someone who is currently an admin.
 */
const ensureAnotherAdminExists = async (projectId) => {
    const adminCount = await ProjectMember.countDocuments({
        project: projectId,
        role: UserRolesEnum.ADMIN,
    });

    if (adminCount <= 1) {
        throw new ApiError(
            400,
            "A project must have at least one admin. Promote another member to admin first."
        );
    }
};

// GET /api/v1/projects  -> every project the logged-in user belongs to, with member count
const getProjects = asyncHandler(async (req, res) => {
    const projects = await ProjectMember.aggregate([
        // 1. all memberships of the current user
        { $match: { user: new mongoose.Types.ObjectId(req.user._id) } },
        // 2. attach the project document ("project" becomes an array, so we unwind it)
        {
            $lookup: {
                from: "projects",
                localField: "project",
                foreignField: "_id",
                as: "project",
            },
        },
        { $unwind: "$project" },
        // 3. attach all memberships of that project so we can count them
        {
            $lookup: {
                from: "projectmembers",
                localField: "project._id",
                foreignField: "project",
                as: "members",
            },
        },
        // 4. shape the output
        {
            $project: {
                _id: "$project._id",
                name: "$project.name",
                description: "$project.description",
                createdBy: "$project.createdBy",
                createdAt: "$project.createdAt",
                myRole: "$role",
                memberCount: { $size: "$members" },
            },
        },
        { $sort: { createdAt: -1 } },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, projects, "Projects fetched successfully"));
});

// POST /api/v1/projects  -> any logged-in user can create; the creator becomes its admin
const createProject = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    const project = await Project.create({
        name,
        description,
        createdBy: req.user._id,
    });

    try {
        await ProjectMember.create({
            user: req.user._id,
            project: project._id,
            role: UserRolesEnum.ADMIN,
        });
    } catch (error) {
        // no transaction here, so undo the project manually if the membership failed
        await Project.findByIdAndDelete(project._id);
        throw error;
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            { ...project.toObject(), myRole: UserRolesEnum.ADMIN, memberCount: 1 },
            "Project created successfully"
        )
    );
});

// GET /api/v1/projects/:projectId  -> any member of the project
const getProjectById = asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.projectId).populate(
        "createdBy",
        "username fullName avatar"
    );

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const memberCount = await ProjectMember.countDocuments({ project: project._id });

    return res.status(200).json(
        new ApiResponse(
            200,
            // req.projectMember was attached by validateProjectPermission
            { ...project.toObject(), myRole: req.projectMember.role, memberCount },
            "Project fetched successfully"
        )
    );
});

// PUT /api/v1/projects/:projectId  -> admin only
const updateProject = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
        throw new ApiError(400, "Provide at least one field to update: name or description");
    }

    const project = await Project.findByIdAndUpdate(
        req.params.projectId,
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, project, "Project updated successfully"));
});

// DELETE /api/v1/projects/:projectId  -> admin only
const deleteProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    const project = await Project.findByIdAndDelete(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // clean up everything that belongs to the project
    await ProjectMember.deleteMany({ project: projectId });
    // TODO (steps 4 and 5): also delete this project's tasks, subtasks and notes here

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Project deleted successfully"));
});

// GET /api/v1/projects/:projectId/members  -> any member of the project
const getProjectMembers = asyncHandler(async (req, res) => {
    const memberships = await ProjectMember.find({ project: req.params.projectId })
        .populate("user", "username fullName email avatar")
        .sort({ createdAt: 1 });

    const members = memberships
        .filter((membership) => membership.user) // skip memberships whose user was deleted
        .map((membership) => ({
            userId: membership.user._id,
            username: membership.user.username,
            fullName: membership.user.fullName,
            email: membership.user.email,
            avatar: membership.user.avatar,
            role: membership.role,
            joinedAt: membership.createdAt,
        }));

    return res
        .status(200)
        .json(new ApiResponse(200, members, "Project members fetched successfully"));
});

// POST /api/v1/projects/:projectId/members  -> admin only. Body: { email, role? }
const addProjectMember = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { email, role } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "No registered user found with that email");
    }

    const alreadyMember = await ProjectMember.findOne({
        project: projectId,
        user: user._id,
    });

    if (alreadyMember) {
        throw new ApiError(409, "User is already a member of this project");
    }

    const membership = await ProjectMember.create({
        project: projectId,
        user: user._id,
        role: role || UserRolesEnum.MEMBER,
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                userId: user._id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                role: membership.role,
                joinedAt: membership.createdAt,
            },
            "Member added successfully"
        )
    );
});

// PUT /api/v1/projects/:projectId/members/:userId  -> admin only. Body: { role }
const updateProjectMemberRole = asyncHandler(async (req, res) => {
    const { projectId, userId } = req.params;
    const { role } = req.body;

    const membership = await ProjectMember.findOne({ project: projectId, user: userId });

    if (!membership) {
        throw new ApiError(404, "Member not found in this project");
    }

    // demoting an admin -> make sure that isn't the last one
    if (membership.role === UserRolesEnum.ADMIN && role !== UserRolesEnum.ADMIN) {
        await ensureAnotherAdminExists(projectId);
    }

    membership.role = role;
    await membership.save();

    return res.status(200).json(
        new ApiResponse(200, { userId, role: membership.role }, "Member role updated successfully")
    );
});

// DELETE /api/v1/projects/:projectId/members/:userId  -> admin only
const removeProjectMember = asyncHandler(async (req, res) => {
    const { projectId, userId } = req.params;

    const membership = await ProjectMember.findOne({ project: projectId, user: userId });

    if (!membership) {
        throw new ApiError(404, "Member not found in this project");
    }

    // removing an admin -> make sure that isn't the last one
    if (membership.role === UserRolesEnum.ADMIN) {
        await ensureAnotherAdminExists(projectId);
    }

    await membership.deleteOne();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Member removed successfully"));
});

export {
    getProjects,
    createProject,
    getProjectById,
    updateProject,
    deleteProject,
    getProjectMembers,
    addProjectMember,
    updateProjectMemberRole,
    removeProjectMember,
};