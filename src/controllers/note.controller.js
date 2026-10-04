import { Note } from "../models/note.model";
import { ApiError } from "../utils/api-error";
import { ApiResponse } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

const USER_FIELDS = "username, fullname, avatar";

// GET /api/v1/notes/:projectId -> any member
const getNotes = asyncHandler(async (req, res) => {
    const notes = await Note.find({ project: req.params.projectId })
        .populate("createdBy", USER_FIELDS).sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, notes, "Notes fetched successfully"));
});

// POST /api/v1/notes/:projectId -> Admin only
const createNote = asyncHandler(async (req, res) => {
    const { content } = req.body;

    const note = await Note.create({
        project: req.params.projectId,
        createdBy: req.user._id,
        content,
    });

    await note.populate("createdBy", USER_FIELDS);

    return res.status(200).json(new ApiResponse(200, note, "Note created successfully"));

});

// GET /api/v1/notes/:projectId/n/:noteId -> any member
const getNoteById = asyncHandler(async (req, res) => {
    const { projectId, noteId } = req.params;

    // filtering by project as well so that a note ID from another project returns 404
    const note = await Note.findOne({ _id: noteId, project: projectId }).populate(
        "createdBy",
        USER_FIELDS
    );

    if (!note) {
        throw new ApiError(404, "Note not found");
    }

    return res.status(200).json(new ApiResponse(200, note, "Note fetched by noteId and projectId successfully"));
});

// PUT /api/v1/notes/:projectId/n/:noteId -> admin only
const updateNote = asyncHandler(async (req, res) => {
    const { projectId, noteId } = req.params;
    const { content } = req.body;

    // finding the appropriate project note and setting it's new content
    const note = await Note.findOne(
        { id: noteId, project: projectId },
        { $set: { content } },
        { new: true, runValidators: true }

    ).populate(
        "createdBy",
        USER_FIELDS
    );

    if (!note) {
        throw new ApiError(404, "Note not found");
    }

    return res.status(200).json(new ApiResponse(200, note, "Note updated successfully"));
});

// PUT /api/v1/notes/:projectId/n/:noteId -> admin only
const deleteNote = asyncHandler(async (req, res) => {
    const { projectId, noteId } = req.params;

    const note = await Note.findOneAndDelete({ id: noteId, project: projectId });

    if (!note) {
        throw new ApiError(404, "Note not found");
    }

    return res.status(200, {}, "Note deleted successfully");
});

export { getNotes, createNote, getNoteById, updateNote, deleteNote };

