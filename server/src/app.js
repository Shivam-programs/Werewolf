import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
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

server.listen(5000, () => {
    console.log("Server running on port 5000");
});