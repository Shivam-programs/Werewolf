
import {rooms} from "../models/rooms.js";
import {getPublicPlayers} from "../controllers/gameController.js";

export async function getPlayers(req, res) {
    try {
        const { roomCode } = req.params;

        const room = rooms[roomCode];

        if (!room) {
            return res.status(404).json({
                message: "Room not found",
            });
        }

        return res.status(200).json({
            success: true,
            players: getPublicPlayers(room),
        });

    } catch (error) {

        return res.status(500).json({
            message: error.message,
        });

    }
}

export async function getMessages(req, res) {

    try {

        const { roomCode } = req.params;

        const room = rooms[roomCode];

        if (!room) {
            return res.status(404).json({
                message: "Room not found",
            });
        }

        return res.status(200).json({
            messages: room.publicMessages,
        });

    } catch (error) {

        return res.status(500).json({
            message: error.message,
        });

    }

}