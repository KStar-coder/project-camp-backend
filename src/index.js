import dotenv from 'dotenv';
dotenv.config({
    path: "./.env",
});
import app from './app.js';
import connectDB from './db/index.js'

import express from 'express';
const port = process.env.PORT || 3000;
connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is listening on port ${port}`);
        });
    })
    .catch((err) => {
        console.log("MongoDB Connection Error: ", err);
        process.exit(1);
    })
