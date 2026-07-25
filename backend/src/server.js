import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import job from "./lib/cron.js";
dotenv.config();

const publicDir = path.join(process.cwd(), "public");
// if the public directory exists, serve the static files
// this is for the production build
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));

    app.get("/{*any}", (req, res, next) => {
        res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
    });
}

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL,
    },
});

app.use(express.json());

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    socket.on("hello", (message) => {
        console.log(message);
    });
    socket.emit("welcome", "Welcome to the server!");

    socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (process.env.NODE_ENV === "production") job.start();
});