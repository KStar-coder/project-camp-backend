import mongoose, { Schema } from "mongoose";

const noteSchema = new Schema(
    {
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String,
            required: [true, "Note content is required"],
            trim: true,
            maxlength: 5000,
        },
    },
    {
        timestamps: true
    }
);

export const Note = mongoose.model("Note", noteSchema);