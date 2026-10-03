import mongoose, { Schema } from "mongoose";

const subTaskSchema = new Schema(
    {
        title: {
            type: String,
            required: [true, "Subtask title is required"],
            trim: true,
            maxlength: 200,
        },
        task: {
            type: Schema.Types.ObjectId,
            ref: "Task",
            required: true,
            index: true,
        },
        // The PRD's subtask routes only carry :projectId and :subTaskId (no task id),
        // so we store the project here and can check ownership with
        // SubTask.findOne({ _id: subTaskId, project: projectId })
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true,
        },
        isCompleted: {
            type: Boolean,
            default: false,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

export const SubTask = mongoose.model("SubTask", subTaskSchema);