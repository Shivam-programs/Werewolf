import express from "express";
import dotenv from "dotenv";
dotenv.config();
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import job from "./lib/cron.js";
import {app, server} from "./lib/socket.js";
import messageRoutes from "./routes/messageRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";


app.use(express.json());
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use("/api/health", (req, res) => {
    res.json({ message: "API is working" });
});

app.use("/api/messages", messageRoutes);
app.use("/api/games", gameRoutes);

const publicDir = path.join(process.cwd(), "public");

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
