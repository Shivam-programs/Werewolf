import express from "express";
import {
    createGame,
    joinGame,
} from "../controllers/gameController.js";

const router = express.Router();

router.post("/createGame", createGame);
router.post("/joinGame/:roomCode", joinGame);

export default router;