import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import job from "./lib/cron.js";
import {app, server} from "./lib/socket.js";
import messageRoutes from "./routes/messageRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
dotenv.config();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use("/api", (req, res) => {
    res.json({ message: "API is working" });
});
app.use("/api/messages", messageRoutes);
app.use("/api/games", gameRoutes);
const publicDir = path.join(process.cwd(), "public");
// if the public directory exists, serve the static files
// this is for the production build
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));

    app.get("/{*any}", (req, res, next) => {
        res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
    });
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (process.env.NODE_ENV === "production") job.start();
});