// import express from "express";
// import { getMessages,getPlayers,sendMessage } from "../controllers/messageController.js";

// const router = express.Router();
// router.get("/players/:roomCode", getPlayers);
// router.get("/messages/:roomCode", getMessages);
// router.post("/messages", sendMessage);

// export default router;

import express from "express";
import {
    getMessages,
    getPlayers,
} from "../controllers/messageController.js";

const router = express.Router();

router.get("/players/:roomCode", getPlayers);
router.get("/messages/:roomCode", getMessages);

export default router;