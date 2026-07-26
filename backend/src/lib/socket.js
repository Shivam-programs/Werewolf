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
    playerDisconnected,
} from "../controllers/gameController.js";

const app = express();
const server = http.createServer(app);

const allowedOrigin =
    process.env.FRONTEND_URL || "http://localhost:5173";

const io = new Server(server, {
    cors: {
        origin: [allowedOrigin],
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

io.on("connection", (socket) => {

    console.log(`Connected : ${socket.id}`);

    /*
    Register player after joining room
    */

    socket.on(
        "registerPlayer",
        ({ roomCode, playerName }) => {

            socket.join(roomCode);

            socket.data.roomCode = roomCode;
            socket.data.playerName = playerName;

            socketMap[socket.id] = {
                roomCode,
                playerName,
            };

            reconnectPlayer(
                roomCode,
                playerName,
                socket.id
            );

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



    socket.on(
        "sendPublicMessage",
        ({ roomCode, message }) => {

            sendPublicMessage(
                roomCode,
                socket.id,
                message
            );

        }
    );

    socket.on(
        "sendWerewolfMessage",
        ({ roomCode, message }) => {

            sendWerewolfMessage(
                roomCode,
                socket.id,
                message
            );

        }
    );

    /*
    Public Vote
    */

    socket.on("publicVote", ({ roomCode, target }) => {
        const result = publicVote(roomCode, socket.id, target);

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

    socket.on(
        "werewolfVote",
        ({ roomCode, target }) => {

            werewolfVote(
                roomCode,
                socket.id,
                target
            );

        }
    );

    /*
    Knight Protect
    */

    socket.on(
        "knightProtect",
        ({ roomCode, target }) => {

            knightProtect(
                roomCode,
                socket.id,
                target
            );

        }
    );

    /*
    Seer Peek
    */

    socket.on(
        "seerPeek",
        ({ roomCode, target }) => {

            const result =
                seerPeek(
                    roomCode,
                    socket.id,
                    target
                );

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

            playerDisconnected(
                player.roomCode,
                socket.id
            );

            delete socketMap[socket.id];

        }

    });

});

export {
    app,
    server,
    io,
};