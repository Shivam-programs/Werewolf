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

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

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

function getConnectedPlayers(room) {
    return room.players.filter((player) => player.connected && !player.afk);
}

function getRoomOccupancy(room) {
    return {
        activePlayers: room.players.filter((player) => player.connected && !player.afk).length,
        disconnectedPlayers: room.players.filter((player) => !player.connected || player.afk).length,
        totalPlayers: room.players.length,
    };
}

// ---------------------------------------------------------------------------
// Public player list (safe to send to clients — never includes socketId)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Full room state for a specific player (sent on connect/reconnect)
// ---------------------------------------------------------------------------

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
            // Include chat history so a reconnecting player can restore their chat
            messages: room.publicMessages || [],
            werewolfMessages: room.started && player.role === "Werewolf"
                ? (room.werewolfMessages || [])
                : [],
        },
    };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

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

// FIX B9: Exclude disconnected (afk) players from vote completion check
function haveAllLivingPlayersVoted(room) {
    const votingPlayers = room.players.filter((player) => player.alive && player.connected && !player.afk);

    return votingPlayers.length > 0 && votingPlayers.every((player) => hasSubmittedVote(room.publicVotes, player.name));
}

// FIX B8: Exclude disconnected (afk) players from night action completion check
// FIX B4: Compare seerAction.seer against player.name (stable) instead of socketId
function haveAllLivingNightRolesActed(room) {
    const requiredActors = room.players.filter(
        (player) => player.alive && player.connected && !player.afk && ["Werewolf", "Knight", "Seer"].includes(player.role)
    );

    return requiredActors.every((player) => {
        if (player.role === "Werewolf") {
            return hasSubmittedVote(room.werewolfVotes, player.name);
        }

        if (player.role === "Knight") {
            return Boolean(room.knightAction);
        }

        // FIX B4: Use player.name (stable) instead of socketId
        return room.seerAction?.seer === player.name;
    });
}

// ---------------------------------------------------------------------------
// Role assignment
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Room creation & joining
// ---------------------------------------------------------------------------

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

    if (!trimmedName) {
        return {
            success: false,
            statusCode: 400,
            message: "Player name cannot be empty.",
        };
    }

    if (rooms[roomCode]) {
        return {
            success: false,
            statusCode: 400,
            message: "Room already exists.",
        };
    }

    rooms[roomCode] = createRoom(trimmedName);

    console.log(
        `[ROOM] CREATED room=${roomCode} host=${trimmedName} activePlayers=1 disconnectedPlayers=0 totalPlayers=1 maxPlayers=${MAX_PLAYERS}`,
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
            `[ROOM] JOIN_ATTEMPT room=${roomCode} roomStatus=${room.started ? "PLAYING" : "WAITING"} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers} maxPlayers=${MAX_PLAYERS}`,
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
            `[ROOM] FULL room=${roomCode} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers} maxPlayers=${MAX_PLAYERS}`,
        );
        return {
            success: false,
            statusCode: 400,
            message: "Room is full.",
        };
    }

    // FIX B11: Synchronous guard against duplicate player names
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
        `[ROOM] JOINED room=${roomCode} player=${trimmedName} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers}`,
    );

    return {
        success: true,
        statusCode: 200,
        room,
        playerId: room.players[room.players.length - 1].playerId,
    };
}

// ---------------------------------------------------------------------------
// Game start
// ---------------------------------------------------------------------------

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
        `[GAME] START_REQUEST room=${roomCode} host=${host.name} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers} replayQueue=${room.replayQueue}`,
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
    room.processingNight = false;
    room.processingVoting = false;

    room.players.forEach((player) => {
        player.role = null;
        player.ready = false;
        player.alive = true;
        player.afk = false;
    });
}

// ---------------------------------------------------------------------------
// Replay queue (play again)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

function startNight(roomCode) {
    const room = getRoom(roomCode);

    if (!room || !room.started) return;

    clearRoomTimer(room);

    room.day++;
    room.phase = PHASES.NIGHT;
    room.phaseEndTime = Date.now() + NIGHT_DURATION;
    room.publicVotes = {};
    room.werewolfVotes = {};
    room.werewolfTarget = null;
    room.knightAction = null;
    room.seerAction = null;
    room.processingNight = false;

    emitPhase(roomCode, room);

    room.timer = setTimeout(() => {
        resolveNightActions(roomCode);
    }, NIGHT_DURATION);
}

function resolveNightActions(roomCode) {
    const room = getRoom(roomCode);

    if (!room) return;

    // FIX B6 (timer safety): If we're no longer in NIGHT, bail out to prevent
    // a stale timer from corrupting the current phase.
    if (room.phase !== PHASES.NIGHT) {
        console.log(`[GAME] resolveNightActions skipped (phase=${room.phase}, expected=night) room=${roomCode}`);
        return;
    }

    if (room.processingNight) {
        console.log(`[GAME] resolveNightActions skipped (already processing) room=${roomCode}`);
        return;
    }

    room.processingNight = true;

    // FIX B7: Use try/finally so the processing flag is always cleared
    try {
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

        if (checkGameOver(roomCode, { reason: "nightResolution", triggeredBy: "resolveNightActions" })) {
            return;
        }

        startDay(roomCode);
    } finally {
        room.processingNight = false;
    }
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
    room.processingVoting = false;

    emitPhase(roomCode, room);

    room.timer = setTimeout(() => {
        endVoting(roomCode);
    }, VOTING_DURATION);
}

function endVoting(roomCode) {
    const room = getRoom(roomCode);

    if (!room) return;

    // Timer safety: If we're no longer in VOTING, bail out
    if (room.phase !== PHASES.VOTING) {
        console.log(`[GAME] endVoting skipped (phase=${room.phase}, expected=voting) room=${roomCode}`);
        return;
    }

    if (room.processingVoting) {
        console.log(`[GAME] endVoting skipped (already processing) room=${roomCode}`);
        return;
    }

    room.processingVoting = true;

    // FIX B7: Use try/finally so the processing flag is always cleared
    try {
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
            return;
        }

        startNight(roomCode);
    } finally {
        room.processingVoting = false;
    }
}

// ---------------------------------------------------------------------------
// Win condition
// ---------------------------------------------------------------------------

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
        `[GAME] ENDED room=${roomCode} reason=${reason} triggeredBy=${triggeredBy} alivePlayers=${alivePlayers.length} aliveWerewolves=${aliveWerewolves} aliveVillagers=${aliveVillagers} winner=${winner}`,
    );

    clearRoomTimer(room);
    room.started = false;
    room.phase = PHASES.ENDED;
    room.phaseEndTime = null;

    // Security: Send player data without socketIds
    const safePlayers = room.players.map((player) => ({
        name: player.name,
        role: player.role,
        alive: player.alive,
        connected: player.connected,
    }));

    io.to(roomCode).emit("gameEnded", {
        winner,
        players: safePlayers,
    });

    return true;
}

// ---------------------------------------------------------------------------
// Player actions: Public vote
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Player actions: Werewolf vote
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Player actions: Knight protect
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Player actions: Seer peek
// ---------------------------------------------------------------------------

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

    // FIX B4: Use player.name (stable) instead of socketId to check duplicate seer actions
    if (room.seerAction?.seer === seer.name) {
        return {
            success: false,
            message: "You have already used your ability tonight.",
        };
    }

    validation = validateTarget(room, seer.name, targetName);
    if (!validation.success) return validation;

    const target = getPlayer(room, targetName);

    // FIX B4: Store player.name instead of socketId
    room.seerAction = {
        seer: seer.name,
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

// ---------------------------------------------------------------------------
// Disconnect / reconnect / leave
// ---------------------------------------------------------------------------

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

    // If the player has already reconnected with a different socket, ignore
    // this stale disconnect event.
    if (player.socketId && player.socketId !== socketId) {
        console.log(`[PLAYER] DISCONNECT_IGNORED (stale socket) room=${roomCode} player=${player.name} currentSocket=${player.socketId} staleSocket=${socketId}`);
        return;
    }

    player.lastSocketId = socketId;
    player.socketId = null;
    player.afk = true;
    player.connected = false;

    console.log(`[PLAYER] DISCONNECTED room=${roomCode} player=${player.name} playerId=${player.playerId} socketId=${socketId}`);

    io.to(roomCode).emit("playerDisconnected", {
        player: player.name,
        players: getPublicPlayers(room),
    });

    // Transfer host if the disconnected player was host
    if (room.host === player.name) {
        transferHost(roomCode, room);
    }

    // If a night-role player disconnects, check if all remaining connected
    // night-role players have acted so we can advance the phase
    if (room.started && room.phase === PHASES.NIGHT && !room.processingNight) {
        if (haveAllLivingNightRolesActed(room)) {
            resolveNightActions(roomCode);
        }
    }

    // Same for voting phase
    if (room.started && room.phase === PHASES.VOTING && !room.processingVoting) {
        if (haveAllLivingPlayersVoted(room)) {
            endVoting(roomCode);
        }
    }
}

export function removeDisconnectedPlayer(roomCode, socketId, playerId = null) {
    const room = getRoom(roomCode);

    if (!room) return;

    let player = null;

    if (playerId) {
        player = getPlayerByPlayerId(room, playerId);
    }

    if (!player && socketId) {
        player = getPlayerBySocket(room, socketId);
    }

    if (!player) return;

    // FIX B2: If the player has reconnected (connected is true), don't remove them.
    // This now works correctly because B1 ensures disconnected players have connected=false.
    if (player.connected) {
        console.log(`[PLAYER] REMOVE_SKIPPED (reconnected) room=${roomCode} player=${player.name}`);
        return;
    }

    const removedPlayerName = player.name;
    const wasHost = room.host === player.name;

    // During an active game, mark the player dead instead of removing them
    // to keep the game state consistent.
    if (room.started && room.phase !== PHASES.ENDED) {
        player.alive = false;
        console.log(`[PLAYER] ELIMINATED_BY_TIMEOUT room=${roomCode} player=${removedPlayerName}`);

        io.to(roomCode).emit("playerLeft", getPublicPlayers(room));

        if (wasHost) {
            transferHost(roomCode, room);
        }

        checkGameOver(roomCode, { reason: "disconnectTimeout", triggeredBy: removedPlayerName });
        return;
    }

    // In lobby or ended phase, remove the player entirely
    room.players = room.players.filter((currentPlayer) => currentPlayer !== player);

    if (room.players.length === 0) {
        clearRoomTimer(room);
        delete rooms[roomCode];
        console.log(`[ROOM] DELETED room=${roomCode} reason=empty lastPlayer=${removedPlayerName}`);
        return;
    }

    if (wasHost) {
        transferHost(roomCode, room);
    }

    io.to(roomCode).emit("playerLeft", getPublicPlayers(room));

    const { activePlayers, disconnectedPlayers, totalPlayers } = getRoomOccupancy(room);
    console.log(
        `[PLAYER] REMOVED room=${roomCode} player=${removedPlayerName} activePlayers=${activePlayers} disconnectedPlayers=${disconnectedPlayers} totalPlayers=${totalPlayers}`,
    );
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
        return { success: false, playerId: null, players: [] };
    }

    let player = null;

    if (playerId) {
        player = getPlayerByPlayerId(room, playerId);
    }

    if (!player) {
        player = getPlayer(room, playerName);
    }

    if (!player) {
        return { success: false, playerId: null, players: [] };
    }

    if (!player.playerId) {
        player.playerId = randomUUID();
    }

    // If the player already has a different active socket, disconnect the old one
    if (player.socketId && player.socketId !== socketId) {
        const oldSocket = io.sockets.sockets.get(player.socketId);
        if (oldSocket) {
            // Clear socket data so the old socket's disconnect handler won't
            // re-trigger playerDisconnected for this player
            oldSocket.data.roomCode = null;
            oldSocket.data.playerId = null;
            oldSocket.data.playerName = null;
            oldSocket.leave(roomCode);
            oldSocket.disconnect(true);
        }
    }

    player.socketId = socketId;
    player.afk = false;
    player.connected = true;

    console.log(`[PLAYER] RECONNECTED room=${roomCode} player=${player.name} playerId=${player.playerId} socketId=${socketId}`);

    player.lastSocketId = null;

    return { success: true, playerId: player.playerId, players: getPublicPlayers(room) };
}

// ---------------------------------------------------------------------------
// Reset game (full reset to lobby state)
// ---------------------------------------------------------------------------

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
    room.werewolfTarget = null;
    room.knightAction = null;
    room.seerAction = null;
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

// ---------------------------------------------------------------------------
// Intentional leave
// ---------------------------------------------------------------------------

// FIX B5: During active games, mark the player as dead/disconnected instead
// of removing them, and trigger a game-over check.
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

    // Ensure the requesting socket owns this player
    if (socketId && player.socketId && player.socketId !== socketId) {
        return;
    }

    const wasHost = room.host === player.name;

    if (room.started && room.phase !== PHASES.ENDED) {
        // During an active game, mark the player dead/disconnected rather
        // than removing them from the players array.
        player.alive = false;
        player.connected = false;
        player.afk = true;
        player.socketId = null;

        console.log(`[PLAYER] LEFT_DURING_GAME room=${roomCode} player=${player.name}`);

        if (wasHost) {
            transferHost(roomCode, room);
        }

        io.to(roomCode).emit("playerLeft", getPublicPlayers(room));

        // Leaving during night/voting may advance the phase if all remaining
        // connected players have acted.
        if (room.phase === PHASES.NIGHT && !room.processingNight && haveAllLivingNightRolesActed(room)) {
            resolveNightActions(roomCode);
        }
        if (room.phase === PHASES.VOTING && !room.processingVoting && haveAllLivingPlayersVoted(room)) {
            endVoting(roomCode);
        }

        checkGameOver(roomCode, { reason: "playerLeft", triggeredBy: player.name });
        return;
    }

    // In lobby or ended phase: remove the player entirely.
    room.players = room.players.filter((currentPlayer) => currentPlayer !== player);

    if (room.players.length === 0) {
        clearRoomTimer(room);
        delete rooms[roomCode];
        console.log(`[ROOM] DELETED room=${roomCode} reason=empty lastPlayer=${playerName}`);
        return;
    }

    if (wasHost) {
        room.host = room.players[0].name;
        io.to(roomCode).emit("hostChanged", { host: room.host });
    }

    io.to(roomCode).emit("playerLeft", getPublicPlayers(room));
}
