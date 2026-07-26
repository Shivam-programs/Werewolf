// services/messageService.js

import {rooms} from "../models/rooms.js";
import { io } from "../lib/socket.js";
import { getPlayerBySocket } from "../controllers/gameController.js";
export function sendPublicMessage(
    roomCode,
    socketId,
    message
) {
    const room = rooms[roomCode];

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    const player = room.players.find(
        (player) => player.socketId === socketId
    );

    if (!player) {
        return {
            success: false,
            message: "Player not found.",
        };
    }

    if (!player.alive) {
        return {
            success: false,
            message: "Dead players cannot chat.",
        };
    }

    const newMessage = {
        sender: player.name,
        message,
        timestamp: Date.now(),
    };

    room.publicMessages.push(newMessage);

    io.to(roomCode).emit(
        "newPublicMessage",
        newMessage
    );

    return {
        success: true,
    };
}
export function sendWerewolfMessage(
    roomCode,
    socketId,
    message
) {

    const room = rooms[roomCode];

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    const sender = getPlayerBySocket(
        room,
        socketId
    );

    if (!sender) {
        return {
            success: false,
            message: "Player not found.",
        };
    }

    if (!sender.alive) {
        return {
            success: false,
            message: "Dead players cannot chat.",
        };
    }

    if (sender.role !== "Werewolf") {
        return {
            success: false,
            message: "Only werewolves can use this chat.",
        };
    }

    const newMessage = {
        sender: sender.name,
        message,
        timestamp: Date.now(),
    };

    room.werewolfMessages.push(newMessage);

    // Send only to living werewolves
    room.players
        .filter(
            (player) =>
                player.alive &&
                player.role === "Werewolf" &&
                player.socketId
        )
        .forEach((player) => {
            io.to(player.socketId).emit(
                "newWerewolfMessage",
                newMessage
            );
        });

    return {
        success: true,
        data: newMessage,
    };

}