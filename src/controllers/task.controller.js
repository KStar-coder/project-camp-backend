import { Task } from "../models/task.model.js";
import { SubTask } from "../models/subtask.model.js";
import { ProjectMember } from "../models/project-member.model.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { UserRolesEnum } from "../utils/constants.js";
import { removeStoredFiles } from "../utils/file.js";

const MAX_ATTACHMENTS_PER_TASK = 10;
const USER_FIELDS = "username fullName avatar";

// A task can only be assigned to someone who belongs to the same project
const ensureProjectMember = async (projectId, userId) => {
    const isMember = await ProjectMember.exists({ project: projectId, user: userId });

    if (!isMember) {
        throw new ApiError(400, "Assignee must be a member of this project");
    }
};

// multer file -> the metadata we keep on the task
const toAttachment = (file) => ({
    url: `/images/${file.filename}`,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
});

/* ------------------------------- TASKS ------------------------------- */

// GET /api/v1/tasks/:projectId?status=todo  -> any member
const getTasks = asyncHandler(async (req, res) => {
    const filter = { project: req.params.projectId };

    if (typeof req.query.status === "string") {
        filter.status = req.query.status;
    }

    const tasks = await Task.find(filter)
        .populate("assignedTo", USER_FIELDS)
        .populate("assignedBy", USER_FIELDS)
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, tasks, "Tasks fetched successfully"));
});

// POST /api/v1/tasks/:projectId  -> Admin / Project Admin. multipart or JSON
const createTask = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { title, description, assignedTo, status } = req.body;
    const files = req.files || [];

    if (assignedTo) {
        await ensureProjectMember(projectId, assignedTo);
    }

    const task = await Task.create({
        title,
        description,
        project: projectId,
        assignedTo: assignedTo || undefined,
        assignedBy: req.user._id,
        status, // undefined -> schema default ("todo")
        attachments: files.map(toAttachment),
    });

    await task.populate([
        { path: "assignedTo", select: USER_FIELDS },
        { path: "assignedBy", select: USER_FIELDS },
    ]);

    return res
        .status(201)
        .json(new ApiResponse(201, task, "Task created successfully"));
});

// GET /api/v1/tasks/:projectId/t/:taskId  -> any member (includes subtasks)
const getTaskById = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, project: projectId })
        .populate("assignedTo", USER_FIELDS)
        .populate("assignedBy", USER_FIELDS);

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    const subtasks = await SubTask.find({ task: taskId }).sort({ createdAt: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, { ...task.toObject(), subtasks }, "Task fetched successfully"));
});

// PUT /api/v1/tasks/:projectId/t/:taskId  -> Admin / Project Admin
// Any new files are ADDED to the task's existing attachments.
const updateTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;
    const { title, description, assignedTo, status } = req.body ?? {};
    const files = req.files || [];

    const task = await Task.findOne({ _id: taskId, project: projectId });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    const nothingSent =
        [title, description, assignedTo, status].every((value) => value === undefined) &&
        files.length === 0;

    if (nothingSent) {
        throw new ApiError(400, "Provide at least one field to update, or attach a file");
    }

    if (assignedTo) {
        await ensureProjectMember(projectId, assignedTo);
        task.assignedTo = assignedTo;
    }
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;

    if (files.length > 0) {
        if (task.attachments.length + files.length > MAX_ATTACHMENTS_PER_TASK) {
            throw new ApiError(400, `A task can have at most ${MAX_ATTACHMENTS_PER_TASK} attachments`);
        }
        task.attachments.push(...files.map(toAttachment));
    }

    await task.save();
    await task.populate([
        { path: "assignedTo", select: USER_FIELDS },
        { path: "assignedBy", select: USER_FIELDS },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, task, "Task updated successfully"));
});

// DELETE /api/v1/tasks/:projectId/t/:taskId  -> Admin / Project Admin
const deleteTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.findOneAndDelete({ _id: taskId, project: projectId });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    await SubTask.deleteMany({ task: taskId });
    await removeStoredFiles(task.attachments);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Task deleted successfully"));
});

/* ------------------------------ SUBTASKS ----------------------------- */

// POST /api/v1/tasks/:projectId/t/:taskId/subtasks  -> Admin / Project Admin
const createSubTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;
    const { title } = req.body;

    // the task must exist AND belong to this project
    const task = await Task.exists({ _id: taskId, project: projectId });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    const subTask = await SubTask.create({
        title,
        task: taskId,
        project: projectId,
        createdBy: req.user._id,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, subTask, "Subtask created successfully"));
});

// PUT /api/v1/tasks/:projectId/st/:subTaskId  -> any member, but members can only toggle completion
const updateSubTask = asyncHandler(async (req, res) => {
    const { projectId, subTaskId } = req.params;
    const { title, isCompleted } = req.body ?? {};

    if (title === undefined && isCompleted === undefined) {
        throw new ApiError(400, "Provide title and/or isCompleted to update");
    }

    // req.projectMember was attached by validateProjectPermission
    if (req.projectMember.role === UserRolesEnum.MEMBER && title !== undefined) {
        throw new ApiError(403, "Members can only change a subtask's completion status");
    }

    const subTask = await SubTask.findOne({ _id: subTaskId, project: projectId });

    if (!subTask) {
        throw new ApiError(404, "Subtask not found");
    }

    if (title !== undefined) subTask.title = title;
    if (isCompleted !== undefined) subTask.isCompleted = isCompleted;

    await subTask.save();

    return res
        .status(200)
        .json(new ApiResponse(200, subTask, "Subtask updated successfully"));
});

// DELETE /api/v1/tasks/:projectId/st/:subTaskId  -> Admin / Project Admin
const deleteSubTask = asyncHandler(async (req, res) => {
    const { projectId, subTaskId } = req.params;

    const subTask = await SubTask.findOneAndDelete({ _id: subTaskId, project: projectId });

    if (!subTask) {
        throw new ApiError(404, "Subtask not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Subtask deleted successfully"));
});

export {
    getTasks,
    createTask,
    getTaskById,
    updateTask,
    deleteTask,
    createSubTask,
    updateSubTask,
    deleteSubTask,
};