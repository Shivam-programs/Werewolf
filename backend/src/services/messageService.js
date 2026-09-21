// services/messageService.js

import { rooms } from "../models/rooms.js";
import { io } from "../lib/socket.js";
import { getPlayerBySocket } from "../controllers/gameController.js";

const MAX_MESSAGE_LENGTH = 500;

export function sendPublicMessage(roomCode, socketId, message) {
    const room = rooms[roomCode];

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    // Validate and trim the message
    if (typeof message !== "string" || !message.trim()) {
        return {
            success: false,
            message: "Message cannot be empty.",
        };
    }

    const trimmedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);

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
        message: trimmedMessage,
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

export function sendWerewolfMessage(roomCode, socketId, message) {

    const room = rooms[roomCode];

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    // Validate and trim the message
    if (typeof message !== "string" || !message.trim()) {
        return {
            success: false,
            message: "Message cannot be empty.",
        };
    }

    const trimmedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);

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
        message: trimmedMessage,
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