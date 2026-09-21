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

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function validatePayload(socket, fields) {
    for (const [key, value] of Object.entries(fields)) {
        if (!isNonEmptyString(value)) {
            socket.emit("roomError", `Invalid ${key}.`);
            return false;
        }
    }
    return true;
}

io.on("connection", (socket) => {

    console.log(`[SOCKET] CONNECTED socketId=${socket.id}`);

    // -----------------------------------------------------------------------
    // Register player after joining room
    // -----------------------------------------------------------------------

    socket.on("registerPlayer", ({ roomCode, playerName, playerId } = {}) => {

        if (!validatePayload(socket, { roomCode, playerName })) return;

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

        // Cancel any pending disconnect-removal timer for this player
        const timerKey = `${roomCode}:${reconnectResult.playerId}`;
        const pendingDisconnect = disconnectTimers.get(timerKey);
        if (pendingDisconnect) {
            clearTimeout(pendingDisconnect);
            disconnectTimers.delete(timerKey);
        }

        socket.join(roomCode);

        socket.data.roomCode = roomCode;
        socket.data.playerName = playerName;
        socket.data.playerId = reconnectResult.playerId;

        console.log(`[PLAYER] REGISTERED room=${roomCode} player=${playerName} playerId=${reconnectResult.playerId} socketId=${socket.id}`);

        // Send the reconnecting player their full current state
        socket.emit("roomState", getRoomState(roomCode, socket.id));

        // Notify everyone in the room (including the player themselves)
        io.to(roomCode).emit("playerConnected", {
            player: playerName,
            players: reconnectResult.players,
        });
    });

    // -----------------------------------------------------------------------
    // Host starts game
    // -----------------------------------------------------------------------

    socket.on("startGame", ({ roomCode } = {}) => {
        if (!isNonEmptyString(roomCode)) return;

        const result = startGame(roomCode, socket.id);

        if (!result.success) {
            socket.emit("error", result.message);
        }
    });

    // -----------------------------------------------------------------------
    // Intentional leave
    // -----------------------------------------------------------------------

    socket.on("leaveRoom", ({ roomCode, playerName } = {}) => {
        if (!isNonEmptyString(roomCode) || !isNonEmptyString(playerName)) return;

        // Cancel any pending disconnect timer for this player
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

    // -----------------------------------------------------------------------
    // Queue for next round (replay)
    // -----------------------------------------------------------------------

    socket.on("queueForNextRound", ({ roomCode } = {}, callback) => {
        if (!isNonEmptyString(roomCode)) return;

        const result = queueForNextRound(roomCode, socket.id);

        if (callback) callback(result);
        if (!result.success) socket.emit("error", result.message);
    });

    // -----------------------------------------------------------------------
    // Chat messages
    // -----------------------------------------------------------------------

    socket.on("sendPublicMessage", ({ roomCode, message } = {}) => {
        if (!isNonEmptyString(roomCode)) return;
        if (typeof message !== "string") return;

        const result = sendPublicMessage(roomCode, socket.id, message);
        socket.emit("publicMessageResult", result);
    });

    socket.on("sendWerewolfMessage", ({ roomCode, message } = {}) => {
        if (!isNonEmptyString(roomCode)) return;
        if (typeof message !== "string") return;

        const result = sendWerewolfMessage(roomCode, socket.id, message);
        socket.emit("werewolfMessageResult", result);
    });

    // -----------------------------------------------------------------------
    // Public Vote
    // -----------------------------------------------------------------------

    socket.on("publicVote", ({ roomCode, target } = {}, callback) => {
        if (!isNonEmptyString(roomCode) || !isNonEmptyString(target)) return;

        const result = publicVote(roomCode, socket.id, target);

        if (callback) callback(result);

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

    // -----------------------------------------------------------------------
    // Werewolf Vote
    // -----------------------------------------------------------------------

    socket.on("werewolfVote", ({ roomCode, target } = {}, callback) => {
        if (!isNonEmptyString(roomCode) || !isNonEmptyString(target)) return;

        const result = werewolfVote(roomCode, socket.id, target);
        if (callback) callback(result);
    });

    // -----------------------------------------------------------------------
    // Knight Protect
    // -----------------------------------------------------------------------

    socket.on("knightProtect", ({ roomCode, target } = {}, callback) => {
        if (!isNonEmptyString(roomCode) || !isNonEmptyString(target)) return;

        const result = knightProtect(roomCode, socket.id, target);
        if (callback) callback(result);
    });

    // -----------------------------------------------------------------------
    // Seer Peek
    // -----------------------------------------------------------------------

    socket.on("seerPeek", ({ roomCode, target } = {}, callback) => {
        if (!isNonEmptyString(roomCode) || !isNonEmptyString(target)) return;

        const result = seerPeek(roomCode, socket.id, target);

        // Emit the seer result to the requesting socket only.
        // Do NOT also call the callback to avoid delivering the same
        // success notification twice (callback + event). The client
        // will handle the private `seerResult` event.
        socket.emit("seerResult", result);
    });

    // -----------------------------------------------------------------------
    // Disconnect
    // -----------------------------------------------------------------------

    socket.on("disconnect", () => {
        const roomCode = socket.data?.roomCode;
        const playerId = socket.data?.playerId;
        const playerName = socket.data?.playerName;

        console.log(`[SOCKET] DISCONNECTED room=${roomCode || "none"} player=${playerName || "none"} playerId=${playerId || "none"} socketId=${socket.id}`);

        if (!roomCode || !playerId) return;

        // FIX B1: Immediately mark the player as disconnected so other
        // players see the status change and the server stops emitting
        // to a dead socket.
        playerDisconnected(roomCode, socket.id, playerId);

        // Cancel any existing disconnect timer for this player (e.g. from
        // a previous rapid disconnect/reconnect cycle).
        const timerKey = `${roomCode}:${playerId}`;
        const existingTimer = disconnectTimers.get(timerKey);
        if (existingTimer) clearTimeout(existingTimer);

        // FIX B3: After the grace period, remove the player using the
        // stable playerId rather than the now-stale socketId.
        const disconnectTimer = setTimeout(() => {
            removeDisconnectedPlayer(roomCode, null, playerId);
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
