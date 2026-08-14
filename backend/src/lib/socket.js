import dotenv from "dotenv";
dotenv.config();
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { sendPublicMessage, sendWerewolfMessage } from "../services/messageService.js";

import {
    startGame,
    publicVote,
    werewolfVote,
    knightProtect,
    seerPeek,
    reconnectPlayer,
    queueForNextRound,
    playerDisconnected,
    removeDisconnectedPlayer,
    getRoomState,
    leaveRoom,
} from "../controllers/gameController.js";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "https://werewolf-jloc.onrender.com"
].filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});

const disconnectTimers = new Map();
const RECONNECT_GRACE_MS = 20_000;

io.on("connection", (socket) => {

    console.log(`Connected : ${socket.id}`);

    /*
    Register player after joining room
    */

    socket.on("registerPlayer", ({ roomCode, playerName, playerId }) => {

        if (typeof roomCode !== "string" || typeof playerName !== "string") {
            socket.emit("roomError", "Invalid room registration.");
            return;
        }

        const reconnectResult = reconnectPlayer(
            roomCode,
            playerName,
            socket.id,
            playerId || null
        );

        if (!reconnectResult.success) {
            socket.emit("roomError", "This room is no longer available.");
            return;
        }

        const pendingDisconnect = disconnectTimers.get(`${roomCode}:${reconnectResult.playerId}`);
        if (pendingDisconnect) {
            clearTimeout(pendingDisconnect);
            disconnectTimers.delete(`${roomCode}:${reconnectResult.playerId}`);
        }

        socket.join(roomCode);

        socket.data.roomCode = roomCode;
        socket.data.playerName = playerName;
        socket.data.playerId = reconnectResult.playerId;

        console.log(`[PLAYER] REGISTERED room=${roomCode} player=${playerName} playerId=${reconnectResult.playerId} socketId=${socket.id}`);

        socket.emit("roomState", getRoomState(roomCode, socket.id));

        io.to(roomCode).emit("playerConnected", playerName);
    });

    /*
    Host starts game
    */

    socket.on("startGame", ({ roomCode }) => {
        const result = startGame(roomCode, socket.id);

        if (!result.success) {
            socket.emit("error", result.message);
        }
    });

    socket.on("leaveRoom", ({ roomCode, playerName }) => {
        if (typeof roomCode !== "string" || typeof playerName !== "string") {
            return;
        }

        const timerKey = `${roomCode}:${socket.data?.playerId || playerName}`;
        const pendingDisconnect = disconnectTimers.get(timerKey);
        if (pendingDisconnect) {
            clearTimeout(pendingDisconnect);
            disconnectTimers.delete(timerKey);
        }

        leaveRoom(roomCode, playerName, socket.id, socket.data?.playerId || null);
        socket.leave(roomCode);
        socket.data.roomCode = null;
        socket.data.playerName = null;
        socket.data.playerId = null;
    });

    socket.on("queueForNextRound", ({ roomCode }, callback) => {
        const result = queueForNextRound(roomCode, socket.id);

        if (callback) callback(result);
        if (!result.success) socket.emit("error", result.message);
    });



    socket.on("sendPublicMessage", ({ roomCode, message }) => {
        const result = sendPublicMessage(roomCode, socket.id, message);

        socket.emit("publicMessageResult", result);
    });

    socket.on("sendWerewolfMessage", ({ roomCode, message }) => {
        const result = sendWerewolfMessage(roomCode, socket.id, message);

        socket.emit("werewolfMessageResult", result);
    });
    /*
    Public Vote
    */

    socket.on("publicVote", ({ roomCode, target }, callback) => {
        const result = publicVote(roomCode, socket.id, target);

        if (callback) {
            callback(result);
        }

        if (!result.success) {
            socket.emit("actionError", {
                action: "publicVote",
                message: result.message,
            });
            return;
        }

        socket.emit("actionSuccess", {
            action: "publicVote",
            message: result.message,
        });
    });

    /*
    Werewolf Vote
    */

    socket.on("werewolfVote", ({ roomCode, target }, callback) => {
        const result = werewolfVote(roomCode, socket.id, target);

        if (callback) {
            callback(result);
        }
    });
    /*
    Knight Protect
    */

    socket.on("knightProtect", ({ roomCode, target }, callback) => {
        const result = knightProtect(roomCode, socket.id, target);

        if (callback) {
            callback(result);
        }
    });

    /*
    Seer Peek
    */

    socket.on(
        "seerPeek",
        ({ roomCode, target }, callback) => {

            const result = seerPeek(roomCode, socket.id, target);

            // Emit the seer result to the requesting socket only.
            // Do NOT also call the callback to avoid delivering the same
            // success notification twice (callback + event). The client
            // will handle the private `seerResult` event.
            socket.emit("seerResult", result);

        }
    );

    /*
    Disconnect
    */

    socket.on("disconnect", () => {
        const roomCode = socket.data?.roomCode;
        const playerId = socket.data?.playerId;

        console.log(`[PLAYER] DISCONNECTED room=${roomCode || "unknown"} playerId=${playerId || "unknown"} socketId=${socket.id}`);

        if (!roomCode || !playerId) return;

        const timerKey = `${roomCode}:${playerId}`;
        const existingTimer = disconnectTimers.get(timerKey);
        if (existingTimer) clearTimeout(existingTimer);

        const disconnectTimer = setTimeout(() => {
            removeDisconnectedPlayer(roomCode, socket.id, playerId);
            disconnectTimers.delete(timerKey);
        }, RECONNECT_GRACE_MS);

        disconnectTimers.set(timerKey, disconnectTimer);
    });

});

export {
    app,
    server,
    io,
};
