import {
    createGameRoom,
    joinRoom,
    startGame,
    queueForNextRound,
    publicVote,
    werewolfVote,
    knightProtect,
    seerPeek,
    playerDisconnected,
    reconnectPlayer,
    removeDisconnectedPlayer,
    resetGame,
    leaveRoom,
    getRoomState,
    getPlayerBySocket,
    getPublicPlayers,
} from "../services/gameService.js";

export { getRoomState, getPlayerBySocket, getPublicPlayers };

export async function createGame(req, res) {
    try {
        const result = createGameRoom(req.body.roomCode, req.body.playerName);

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: result.message,
            });
        }

        return res.status(result.statusCode).json(result);
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

export async function joinGame(req, res) {
    try {
        const result = joinRoom(req.params.roomCode, req.body.playerName);

        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                message: result.message,
            });
        }

        return res.status(result.statusCode).json(result);
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

export { startGame, queueForNextRound, publicVote, werewolfVote, knightProtect, seerPeek, playerDisconnected, reconnectPlayer, removeDisconnectedPlayer, resetGame, leaveRoom };
