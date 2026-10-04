import { ApiError } from "./utils/api-error.js";
import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import { removeStoredFiles } from "./utils/file.js";
import noteRouter from "./routes/note.routes.js"
const app = express();

// basic config 
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// cors config
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
}));

// import the routes
import healthCheckRouter from "./routes/healthcheck.routes.js";
import authrouter from "./routes/auth.routes.js"
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";

app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authrouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);

app.use((req, res, next) => {
    next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

app.use((err, req, res, next) => {
    if (req.files?.length) removeStoredFiles(req.files);

    let statusCode = err.statusCode || 500;
    let message = err.message;

    if (err.code === 11000) {
        statusCode = 409;
        message = "Duplicate value: that record already exists";
    }

    if (statusCode === 500) {
        console.error(err);
        message = "Internal server error";
    }

    res.status(statusCode).json({
        statusCode,
        success: false,
        message,
        errors: err.errors || [],
    });
});



export default app;