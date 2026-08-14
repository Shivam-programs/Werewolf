import { randomUUID } from "crypto";
import { roles } from "../models/roles.js";
import { rooms } from "../models/rooms.js";
import { io } from "../lib/socket.js";

const MAX_PLAYERS = 7;

const PHASES = {
    WAITING: "waiting",
    NIGHT: "night",
    DAY: "day",
    VOTING: "voting",
    ENDED: "ended",
};

const NIGHT_DURATION = 60 * 1000;
const DAY_DURATION = 60 * 1000;
const VOTING_DURATION = 30 * 1000;

function getRoom(roomCode) {
    return rooms[roomCode] || null;
}

function getPlayer(room, playerName) {
    return room.players.find((player) => player.name === playerName);
}

function getPlayerByPlayerId(room, playerId) {
    return room.players.find((player) => player.playerId === playerId);
}

export function getPlayerBySocket(room, socketId) {
    return room.players.find((player) => player.socketId === socketId);
}

function getActivePlayers(room) {
    return room.players.filter((player) => player.connected && Boolean(player.socketId) && !player.afk);
}

function getRoomOccupancy(room) {
    return {
        activePlayers: room.players.filter((player) => player.connected && !player.afk).length,
        disconnectedPlayers: room.players.filter((player) => !player.connected && player.afk).length,
        totalPlayers: room.players.length,
    };
}

export function getPublicPlayers(room) {
    const visiblePlayers = room.replayQueue
        ? room.players.filter((player) => player.ready)
        : room.players;

    return visiblePlayers.map((player) => ({
        name: player.name,
        alive: player.alive,
        role: player.alive ? null : player.role,
        connected: player.connected,
        afk: Boolean(player.afk),
        ready: player.ready,
    }));
}

export function getRoomState(roomCode, socketId) {
    const room = getRoom(roomCode);

    if (!room) {
        return { success: false, message: "Room not found." };
    }

    const player = getPlayerBySocket(room, socketId);

    if (!player) {
        return { success: false, message: "Player not found in this room." };
    }

    return {
        success: true,
        room: {
            host: room.host,
            started: room.started,
            phase: room.replayQueue && player.ready ? PHASES.WAITING : room.phase,
            day: room.replayQueue && player.ready ? 0 : room.day,
            endsAt: room.replayQueue && player.ready ? null : room.phaseEndTime,
            players: getPublicPlayers(room),
            role: room.started ? player.role : null,
            teammates: room.started && player.role === "Werewolf"
                ? room.players
                    .filter((otherPlayer) => otherPlayer.role === "Werewolf" && otherPlayer.name !== player.name)
                    .map((otherPlayer) => otherPlayer.name)
                : [],
        },
    };
}

function getAlivePlayer(room, playerName) {
    return room.players.find((player) => player.name === playerName && player.alive);
}

function clearRoomTimer(room) {
    if (!room.timer) return;

    clearTimeout(room.timer);
    room.timer = null;
}

function emitPhase(roomCode, room) {
    io.to(roomCode).emit("phaseChanged", {
        phase: room.phase,
        day: room.day,
        endsAt: room.phaseEndTime,
    });
}

function validateGameRunning(room) {
    if (!room.started) {
        return {
            success: false,
            message: "Game has not started.",
        };
    }

    return { success: true };
}

function validateAlive(player) {
    if (!player.alive) {
        return {
            success: false,
            message: "Dead players cannot perform actions.",
        };
    }

    return { success: true };
}

function validateTarget(room, actorName, targetName, { allowSelf = false } = {}) {
    if (!allowSelf && actorName === targetName) {
        return {
            success: false,
            message: "You cannot target yourself.",
        };
    }

    const actor = getAlivePlayer(room, actorName);
    const target = getAlivePlayer(room, targetName);

    if (!target) {
        return {
            success: false,
            message: "Target must be alive.",
        };
    }

    if (actor?.role === "Werewolf" && target?.role === "Werewolf") {
        return {
            success: false,
            message: "Werewolves cannot target another werewolf.",
        };
    }

    return {
        success: true,
        target,
    };
}

function validatePhase(room, phase) {
    if (room.phase !== phase) {
        return {
            success: false,
            message: `Action allowed only during ${phase}.`,
        };
    }

    return { success: true };
}

function validateRole(player, role) {
    if (player.role !== role) {
        return {
            success: false,
            message: `Only ${role} can perform this action.`,
        };
    }

    return { success: true };
}

function hasSubmittedVote(votes, playerName) {
    return Object.prototype.hasOwnProperty.call(votes || {}, playerName);
}

function haveAllLivingPlayersVoted(room) {
    const livingPlayers = room.players.filter((player) => player.alive);

    return livingPlayers.length > 0 && livingPlayers.every((player) => hasSubmittedVote(room.publicVotes, player.name));
}

function haveAllLivingNightRolesActed(room) {
    const requiredActors = room.players.filter((player) => player.alive && ["Werewolf", "Knight", "Seer"].includes(player.role));

    return requiredActors.every((player) => {
        if (player.role === "Werewolf") {
            return hasSubmittedVote(room.werewolfVotes, player.name);
        }

        if (player.role === "Knight") {
            return Boolean(room.knightAction);
        }

        return room.seerAction?.seer === player.socketId;
    });
}

function assignRoles(room) {
    const shuffledRoles = [...roles];

    for (let i = shuffledRoles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledRoles[i], shuffledRoles[j]] = [shuffledRoles[j], shuffledRoles[i]];
    }

    room.players.forEach((player, index) => {
        player.role = shuffledRoles[index];
    });
}

function sendRoles(roomCode, room) {
    room.players.forEach((player) => {
        const socket = io.sockets.sockets.get(player.socketId);

        if (!socket) return;

        const data = { role: player.role };

        if (player.role === "Werewolf") {
            data.teammates = room.players
                .filter((candidate) => candidate.role === "Werewolf" && candidate.name !== player.name)
                .map((candidate) => candidate.name);
        }

        socket.emit("roleAssigned", data);
    });
}

function createRoom(playerName) {
    return {
        host: playerName,
        started: false,
        replayQueue: false,
        phase: PHASES.WAITING,
        phaseEndTime: null,
        timer: null,
        day: 0,
        players: [
            {
                name: playerName,
                playerId: randomUUID(),
                socketId: null,
                alive: true,
                connected: true,
                afk: false,
                ready: false,
                role: null,
            },
        ],
        publicMessages: [],
        werewolfMessages: [],
        publicVotes: {},
        werewolfVotes: {},
        werewolfTarget: null,
        knightAction: null,
        seerAction: null,
        // Guards to prevent double-processing when simultaneous actions arrive
        processingNight: false,
        processingVoting: false,
    };
}

export function createGameRoom(roomCode, playerName) {
    if (!roomCode || !playerName) {
        return {
            success: false,
            statusCode: 400,
            message: "Room code and player name are required.",
        };
    }

    const trimmedName = playerName.trim();

    if (rooms[roomCode]) {
        return {
            success: false,
            statusCode: 400,
            message: "Room already exists.",
        };
    }

    rooms[roomCode] = createRoom(trimmedName);

    console.log(
        `[ROOM_CREATE] room=${roomCode} host=${trimmedName} activePlayers=1 disconnectedPlayers=0 totalPlayers=1 maxPlayers=${MAX_PLAYERS}`,
    );

    return {
        success: true,
        statusCode: 201,
        roomCode,
        room: rooms[roomCode],
        playerId: rooms[roomCode].players[0].playerId,
    };
}

export function joinRoom(roomCode, playerName) {
    if (typeof playerName !== "string") {
        return {
            success: false,
            statusCode: 400,
            message: "Player name is required.",
        };
    }

    const trimmedName = playerName.trim();

    if (!trimmedName) {
        return {
            success: false,
            statusCode: 400,
            message: "Player name cannot be empty.",
        };
    }

    const room = getRoom(roomCode);

    if (room) {
        const { activePlayers, disconnectedPlayers, totalPlayers } = getRoomOccupancy(room);
        console.log(
            `[JOIN_ATTEMPT] room=${roomCode} roomStatus=${room.started ? "PLAYING" : "WAITING"} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers} maxPlayers=${MAX_PLAYERS}`,
        );
    }

    if (!room) {
        return {
            success: false,
            statusCode: 404,
            message: "Room not found.",
        };
    }

    if (room.started) {
        return {
            success: false,
            statusCode: 400,
            message: "Game already started.",
        };
    }

    if (room.replayQueue) {
        const replaceablePlayer = room.players.find((player) => !player.ready);
        if (replaceablePlayer) {
            const wasHost = room.host === replaceablePlayer.name;
            room.players = room.players.filter((player) => player !== replaceablePlayer);

            if (wasHost) {
                room.host = room.players[0]?.name || trimmedName;
                io.to(roomCode).emit("hostChanged", { host: room.host });
            }
        }
    }

    if (room.players.length >= MAX_PLAYERS) {
        const { activePlayers, disconnectedPlayers, totalPlayers } = getRoomOccupancy(room);
        console.log(
            `[ROOM_FULL] room=${roomCode} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers} maxPlayers=${MAX_PLAYERS}`,
        );
        return {
            success: false,
            statusCode: 400,
            message: "Room is full.",
        };
    }

    if (room.players.some((player) => player.name === trimmedName)) {
        return {
            success: false,
            statusCode: 400,
            message: "Player already exists.",
        };
    }

    room.players.push({
        name: trimmedName,
        playerId: randomUUID(),
        socketId: null,
        connected: true,
        afk: false,
        alive: true,
        ready: false,
        role: null,
    });

    if (room.replayQueue) {
        room.players[room.players.length - 1].ready = true;
    }

    io.to(roomCode).emit("playerJoined", getPublicPlayers(room));

    const { activePlayers, disconnectedPlayers, totalPlayers } = getRoomOccupancy(room);
    console.log(
        `[JOINED] room=${roomCode} player=${trimmedName} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers}`,
    );

    return {
        success: true,
        statusCode: 200,
        room,
        playerId: room.players[room.players.length - 1].playerId,
    };
}

export function startGame(roomCode, socketId) {
    const room = getRoom(roomCode);

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    const host = getPlayerBySocket(room, socketId);

    if (!host) {
        return {
            success: false,
            message: "Player not found.",
        };
    }

    if (room.host !== host.name) {
        return {
            success: false,
            message: "Only the host can start the game.",
        };
    }

    if (room.started) {
        return {
            success: false,
            message: "Game already started.",
        };
    }

    const { activePlayers, disconnectedPlayers, totalPlayers } = getRoomOccupancy(room);
    console.log(
        `[START_REQUEST] room=${roomCode} host=${host.name} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers} replayQueue=${room.replayQueue}`,
    );

    const readyPlayers = room.replayQueue
        ? room.players.filter((player) => player.ready && player.connected && Boolean(player.socketId))
        : getActivePlayers(room);

    if (readyPlayers.length !== MAX_PLAYERS) {
        return {
            success: false,
            message: `Exactly ${MAX_PLAYERS} players required.`,
        };
    }

    prepareNewRound(room);
    assignRoles(room);

    console.log(`[GAME] START_REQUEST room=${roomCode} host=${host.name} activePlayers=${readyPlayers.length}`);

    room.started = true;
    room.replayQueue = false;
    room.day = 0;

    sendRoles(roomCode, room);
    startNight(roomCode);

    console.log(`[GAME] STARTED room=${roomCode} players=${room.players.length}`);

    return {
        success: true,
        message: "Game started.",
    };
}

function prepareNewRound(room) {
    clearRoomTimer(room);

    room.day = 0;
    room.phase = PHASES.WAITING;
    room.phaseEndTime = null;
    room.publicVotes = {};
    room.werewolfVotes = {};
    room.werewolfTarget = null;
    room.knightAction = null;
    room.seerAction = null;
    room.publicMessages = [];
    room.werewolfMessages = [];

    room.players.forEach((player) => {
        player.role = null;
        player.ready = false;
        player.alive = true;
        player.afk = false;
    });
}

export function queueForNextRound(roomCode, socketId) {
    const room = getRoom(roomCode);

    if (!room || room.phase !== PHASES.ENDED) {
        return { success: false, message: "The previous game has not ended." };
    }

    const player = getPlayerBySocket(room, socketId);
    if (!player) {
        return { success: false, message: "Player not found." };
    }

    if (!room.replayQueue) {
        clearRoomTimer(room);
        room.replayQueue = true;
        room.publicMessages = [];
        room.werewolfMessages = [];
        room.players.forEach((roomPlayer) => {
            roomPlayer.ready = false;
        });
    }

    player.ready = true;
    io.to(roomCode).emit("queueUpdated", getPublicPlayers(room));

    return { success: true, players: getPublicPlayers(room) };
}

function startNight(roomCode) {
    const room = getRoom(roomCode);

        if (!room || !room.started) return; // Ensure room exists and game has started

    clearRoomTimer(room);

    room.day++;
    room.phase = PHASES.NIGHT;
    room.phaseEndTime = Date.now() + NIGHT_DURATION;
    room.publicVotes = {};
    room.werewolfVotes = {};
    room.werewolfTarget = null;
    room.knightAction = null;
    room.seerAction = null;

    emitPhase(roomCode, room);

    room.timer = setTimeout(() => {
        resolveNightActions(roomCode);
    }, NIGHT_DURATION);
}

function resolveNightActions(roomCode) {
    const room = getRoom(roomCode);

    if (!room) return;

    if (room.processingNight) {
        console.log(`[GAME] resolveNightActions skipped (already processing) room=${roomCode}`);
        return;
    }

    room.processingNight = true;

    let eliminatedPlayer = null;
    let protectedPlayerName = null;

    const votes = Object.values(room.werewolfVotes || {});

    let targetName = null;

    if (votes.length === 1) {
        targetName = votes[0];
    } else if (votes.length >= 2) {
        if (votes[0] === votes[1]) {
            targetName = votes[0];
        } else {
            targetName = votes[Math.floor(Math.random() * votes.length)];
        }
    }

    const target = getAlivePlayer(room, targetName);
    const protectedPlayer = getAlivePlayer(room, room.knightAction);

    if (target) {
        if (protectedPlayer && target.name === protectedPlayer.name) {
            protectedPlayerName = target.name;
        } else {
            target.alive = false;
            eliminatedPlayer = target.name;
        }
    }

    room.werewolfVotes = {};
    room.knightAction = null;
    room.seerAction = null;

    io.to(roomCode).emit("nightEnded", {
        eliminatedPlayer,
        protectedPlayer: protectedPlayerName,
        players: getPublicPlayers(room),
    });
    // allow checkGameOver/startDay to proceed, but ensure the processing flag
    // is cleared so future nights can be resolved normally.
    if (checkGameOver(roomCode, { reason: "nightResolution", triggeredBy: "resolveNightActions" })) {
        room.processingNight = false;
        return;
    }

    startDay(roomCode);
    room.processingNight = false;
}

function startDay(roomCode) {
    const room = getRoom(roomCode);

    if (!room) return;

    clearRoomTimer(room);

    room.phase = PHASES.DAY;
    room.phaseEndTime = Date.now() + DAY_DURATION;

    emitPhase(roomCode, room);

    room.timer = setTimeout(() => {
        startVoting(roomCode);
    }, DAY_DURATION);
}

function startVoting(roomCode) {
    const room = getRoom(roomCode);

    if (!room) return;

    clearRoomTimer(room);

    room.phase = PHASES.VOTING;
    room.publicVotes = {};
    room.phaseEndTime = Date.now() + VOTING_DURATION;

    emitPhase(roomCode, room);

    room.timer = setTimeout(() => {
        endVoting(roomCode);
    }, VOTING_DURATION);
}

function endVoting(roomCode) {
    const room = getRoom(roomCode);

    if (!room) return;

    if (room.processingVoting) {
        console.log(`[GAME] endVoting skipped (already processing) room=${roomCode}`);
        return;
    }

    room.processingVoting = true;

    clearRoomTimer(room);

    const counts = {};

    Object.values(room.publicVotes).forEach((target) => {
        counts[target] = (counts[target] || 0) + 1;
    });

    let eliminatedPlayer = null;
    let highestVotes = 0;
    let tie = false;

    for (const player in counts) {
        if (counts[player] > highestVotes) {
            highestVotes = counts[player];
            eliminatedPlayer = player;
            tie = false;
        } else if (counts[player] === highestVotes) {
            tie = true;
        }
    }

    if (eliminatedPlayer && !tie) {
        const target = getAlivePlayer(room, eliminatedPlayer);
        if (target) {
            target.alive = false;
        }
    } else {
        eliminatedPlayer = null;
    }

    room.publicVotes = {};

    io.to(roomCode).emit("votingEnded", {
        eliminatedPlayer,
        players: getPublicPlayers(room),
    });
    if (checkGameOver(roomCode, { reason: "votingResolution", triggeredBy: "endVoting" })) {
        room.processingVoting = false;
        return;
    }

    startNight(roomCode);
    room.processingVoting = false;
}

function checkGameOver(roomCode, { reason = "unknown", triggeredBy = "unknown" } = {}) {
    const room = getRoom(roomCode);

    if (!room || !room.started) return false;

    const alivePlayers = room.players.filter((player) => player.alive);
    const aliveWerewolves = alivePlayers.filter((player) => player.role === "Werewolf").length;
    const aliveVillagers = alivePlayers.length - aliveWerewolves;

    let winner = null;

    if (aliveWerewolves === 0) {
        winner = "Villagers";
    } else if (aliveWerewolves >= aliveVillagers) {
        winner = "Werewolves";
    }

    if (!winner) {
        return false;
    }

    console.log(
        `[GAME_END] room=${roomCode} reason=${reason} triggeredBy=${triggeredBy} alivePlayers=${alivePlayers.length} aliveWerewolves=${aliveWerewolves} aliveVillagers=${aliveVillagers} winner=${winner}`,
    );

    clearRoomTimer(room);
    room.started = false;
    room.phase = PHASES.ENDED;
    room.phaseEndTime = null;

    io.to(roomCode).emit("gameEnded", {
        winner,
        players: room.players,
    });

    return true;
}

export function publicVote(roomCode, socketId, targetName) {
    const room = getRoom(roomCode);

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    let validation = validateGameRunning(room);
    if (!validation.success) return validation;

    validation = validatePhase(room, PHASES.VOTING);
    if (!validation.success) return validation;

    const voter = room.players.find((player) => player.socketId === socketId);
    if (!voter) {
        return {
            success: false,
            message: "Player not found.",
        };
    }

    validation = validateAlive(voter);
    if (!validation.success) return validation;

    validation = validateTarget(room, voter.name, targetName);
    if (!validation.success) return validation;

    room.publicVotes[voter.name] = targetName;

    if (haveAllLivingPlayersVoted(room)) {
        endVoting(roomCode);
    }

    return {
        success: true,
        message: "Vote recorded.",
    };
}

export function werewolfVote(roomCode, socketId, targetName) {
    const room = getRoom(roomCode);

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    let validation = validateGameRunning(room);
    if (!validation.success) return validation;

    validation = validatePhase(room, PHASES.NIGHT);
    if (!validation.success) return validation;

    const werewolf = getPlayerBySocket(room, socketId);
    if (!werewolf) {
        return {
            success: false,
            message: "Player not found.",
        };
    }

    validation = validateAlive(werewolf);
    if (!validation.success) return validation;

    validation = validateRole(werewolf, "Werewolf");
    if (!validation.success) return validation;

    validation = validateTarget(room, werewolf.name, targetName);
    if (!validation.success) return validation;

    if (!room.werewolfVotes) {
        room.werewolfVotes = {};
    }

    room.werewolfVotes[werewolf.name] = targetName;

    if (haveAllLivingNightRolesActed(room)) {
        resolveNightActions(roomCode);
    }

    return {
        success: true,
        message: "Werewolf vote recorded.",
    };
}

export function knightProtect(roomCode, socketId, targetName) {
    const room = getRoom(roomCode);

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    let validation = validateGameRunning(room);
    if (!validation.success) return validation;

    validation = validatePhase(room, PHASES.NIGHT);
    if (!validation.success) return validation;

    const knight = getPlayerBySocket(room, socketId);
    if (!knight) {
        return {
            success: false,
            message: "Player not found.",
        };
    }

    validation = validateAlive(knight);
    if (!validation.success) return validation;

    validation = validateRole(knight, "Knight");
    if (!validation.success) return validation;

    validation = validateTarget(room, knight.name, targetName, { allowSelf: true });
    if (!validation.success) return validation;

    room.knightAction = targetName;

    if (haveAllLivingNightRolesActed(room)) {
        resolveNightActions(roomCode);
    }

    return {
        success: true,
        message: "Protection saved.",
    };
}

export function seerPeek(roomCode, socketId, targetName) {
    const room = getRoom(roomCode);

    if (!room) {
        return {
            success: false,
            message: "Room not found.",
        };
    }

    let validation = validateGameRunning(room);
    if (!validation.success) return validation;

    validation = validatePhase(room, PHASES.NIGHT);
    if (!validation.success) return validation;

    const seer = getPlayerBySocket(room, socketId);
    if (!seer) {
        return {
            success: false,
            message: "Player not found.",
        };
    }

    validation = validateAlive(seer);
    if (!validation.success) return validation;

    validation = validateRole(seer, "Seer");
    if (!validation.success) return validation;

    if (room.seerAction?.seer === socketId) {
        return {
            success: false,
            message: "You have already used your ability tonight.",
        };
    }

    validation = validateTarget(room, seer.name, targetName);
    if (!validation.success) return validation;

    const target = getPlayer(room, targetName);

    room.seerAction = {
        seer: socketId,
        target: target.name,
    };

    if (haveAllLivingNightRolesActed(room)) {
        resolveNightActions(roomCode);
    }

    return {
        success: true,
        player: target.name,
        role: target.role,
    };
}

export function playerDisconnected(roomCode, socketId, playerId = null) {
    const room = getRoom(roomCode);

    if (!room) return;

    let player = null;

    if (playerId) {
        player = getPlayerByPlayerId(room, playerId);
    }

    if (!player) {
        player = getPlayerBySocket(room, socketId);
    }

    if (!player) return;

    if (player.socketId !== socketId && playerId) {
        return;
    }

    player.lastSocketId = socketId;
    player.socketId = null;
    player.afk = true;
    player.connected = false;

    console.log(`[PLAYER] DISCONNECTED_GRACE room=${roomCode} player=${player.name} playerId=${player.playerId} socketId=${socketId}`);

    io.to(roomCode).emit("playerDisconnected", {
        player: player.name,
        players: getPublicPlayers(room),
    });

    if (room.host === player.name) {
        transferHost(roomCode, room);
    }
}

export function removeDisconnectedPlayer(roomCode, socketId, playerId = null) {
    const room = getRoom(roomCode);

    if (!room) return;

    let player = null;

    if (playerId) {
        player = getPlayerByPlayerId(room, playerId);
    }

    if (!player) {
        player = getPlayerBySocket(room, socketId);
    }

    if (!player) return;

    if (player.socketId !== socketId && playerId) {
        return;
    }

    if (player.connected) {
        return;
    }

    const removedPlayerName = player.name;
    const wasHost = room.host === player.name;

    room.players = room.players.filter((currentPlayer) => currentPlayer !== player);

    if (room.players.length === 0) {
        clearRoomTimer(room);
        delete rooms[roomCode];
        console.log(`[DISCONNECT_REMOVED] room=${roomCode} player=${removedPlayerName} roomDeleted=true`);
        return;
    }

    if (wasHost) {
        transferHost(roomCode, room);
    }

    io.to(roomCode).emit("playerLeft", getPublicPlayers(room));

    const { activePlayers, disconnectedPlayers, totalPlayers } = getRoomOccupancy(room);
    console.log(
        `[DISCONNECT_REMOVED] room=${roomCode} player=${removedPlayerName} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers}`,
    );

    checkGameOver(roomCode, { reason: "disconnectTimeout", triggeredBy: removedPlayerName });
}

function transferHost(roomCode, room) {
    const eligiblePlayers = room.replayQueue
        ? room.players.filter((player) => player.ready && player.connected && Boolean(player.socketId))
        : room.players.filter((player) => player.connected && Boolean(player.socketId));

    const nextHost = eligiblePlayers.find((player) => player.connected && player.socketId !== null);

    if (!nextHost) {
        room.host = null;
        return;
    }

    room.host = nextHost.name;

    io.to(roomCode).emit("hostChanged", { host: nextHost.name });
}

export function reconnectPlayer(roomCode, playerName, socketId, playerId = null) {
    const room = getRoom(roomCode);

    if (!room) {
        return { success: false, playerId: null };
    }

    let player = null;

    if (playerId) {
        player = getPlayerByPlayerId(room, playerId);
    }

    if (!player) {
        player = getPlayer(room, playerName);
    }

    if (!player) {
        return { success: false, playerId: null };
    }

    if (!player.playerId) {
        player.playerId = randomUUID();
    }

    player.socketId = socketId;
    player.afk = false;
    player.connected = true;

    console.log(`[PLAYER] RECONNECTED room=${roomCode} player=${player.name} playerId=${player.playerId} oldSocketId=${player.lastSocketId || "unknown"} socketId=${socketId}`);

    player.lastSocketId = null;

    return { success: true, playerId: player.playerId };
}

export function resetGame(roomCode) {
    const room = getRoom(roomCode);

    if (!room) return;

    clearRoomTimer(room);
    room.started = false;
    room.replayQueue = false;
    room.day = 0;
    room.phase = PHASES.WAITING;
    room.phaseEndTime = null;
    room.publicVotes = {};
    room.werewolfVotes = {};
    room.publicMessages = [];
    room.werewolfMessages = [];
    room.werewolfTarget = {};
    room.knightAction = null;
    room.seerAction = null;
    room.werewolfVotes = {};
    room.actionTracker = { night: {}, voting: {} };
    room.processingNight = false;
    room.processingVoting = false;

    room.players.forEach((player) => {
        player.role = null;
        player.ready = false;
        player.alive = true;
        player.afk = false;
    });

    io.to(roomCode).emit("gameReset");
}

export function leaveRoom(roomCode, playerName, socketId = null, playerId = null) {
    const room = getRoom(roomCode);

    if (!room) return;

    let player = null;

    if (playerId) {
        player = getPlayerByPlayerId(room, playerId);
    }

    if (!player) {
        player = getPlayer(room, playerName);
    }

    if (!player) return;

    if (socketId && player.socketId && player.socketId !== socketId) {
        return;
    }

    room.players = room.players.filter((currentPlayer) => currentPlayer !== player);

    if (room.players.length === 0) {
        clearRoomTimer(room);
        delete rooms[roomCode];
        return;
    }

    if (room.host === player.name) {
        room.host = room.players[0].name;
    }

    io.to(roomCode).emit("playerLeft", getPublicPlayers(room));
}
