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
    getRoomState,
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

/*
socket.id
        ↓
{
    socketId :
    roomCode :
    playerName :
}
*/

const socketMap = {};
const disconnectTimers = new Map();
const RECONNECT_GRACE_MS = 20_000;

io.on("connection", (socket) => {

    console.log(`Connected : ${socket.id}`);

    /*
    Register player after joining room
    */

    socket.on(        "registerPlayer",
        ({ roomCode, playerName }) => {

            if (typeof roomCode !== "string" || typeof playerName !== "string") {
                socket.emit("roomError", "Invalid room registration.");
                return;
            }

            const reconnectResult = reconnectPlayer(
                roomCode,
                playerName,
                socket.id
            );

            if (!reconnectResult) {
                socket.emit("roomError", "This room is no longer available.");
                return;
            }

            const pendingDisconnect = disconnectTimers.get(`${roomCode}:${playerName}`);
            if (pendingDisconnect) {
                clearTimeout(pendingDisconnect);
                disconnectTimers.delete(`${roomCode}:${playerName}`);
            }

            socket.join(roomCode);

            socket.data.roomCode = roomCode;
            socket.data.playerName = playerName;

            socketMap[socket.id] = {
                roomCode,
                playerName,
            };

            socket.emit("roomState", getRoomState(roomCode, socket.id));

            io.to(roomCode).emit(
                "playerConnected",
                playerName
            );

        }
    );

    /*
    Host starts game
    */

    socket.on("startGame", ({ roomCode }) => {
        const result = startGame(roomCode, socket.id);

        if (!result.success) {
            socket.emit("error", result.message);
        }
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

            const result =
                seerPeek(
                    roomCode,
                    socket.id,
                    target
                );

            if (callback) {
                callback(result);
            }

            socket.emit(
                "seerResult",
                result
            );

        }
    );

    /*
    Disconnect
    */

    socket.on("disconnect", () => {

        console.log(
            `Disconnected : ${socket.id}`
        );

        const player =
            socketMap[socket.id];

        if (player) {

            const timerKey = `${player.roomCode}:${player.playerName}`;
            const existingTimer = disconnectTimers.get(timerKey);
            if (existingTimer) clearTimeout(existingTimer);

            const disconnectTimer = setTimeout(() => {
                playerDisconnected(player.roomCode, socket.id);
                disconnectTimers.delete(timerKey);
            }, RECONNECT_GRACE_MS);

            disconnectTimers.set(timerKey, disconnectTimer);

            delete socketMap[socket.id];

        }

    });

});

export {
    app,
    server,
    io,
};
