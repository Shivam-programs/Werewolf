import express from "express";
import {
    getMessages,
    getPlayers,
} from "../controllers/messageController.js";

const router = express.Router();

router.get("/players/:roomCode", getPlayers);
router.get("/messages/:roomCode", getMessages);

export default router;