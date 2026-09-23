import { create } from "zustand";

const savedSession = JSON.parse(sessionStorage.getItem("howl-hollow-session") || "null");

const persist = (state) => sessionStorage.setItem("howl-hollow-session", JSON.stringify({
  roomCode: state.roomCode, playerName: state.playerName, playerId: state.playerId,
}));

export const useGameStore = create((set) => ({
  roomCode: savedSession?.roomCode || "",
  playerName: savedSession?.playerName || "",
  playerId: savedSession?.playerId || "",
  players: [],
  host: "",
  phase: "waiting",
  day: 0,
  // Authoritative round identifier from the server. Changes whenever a brand
  // new game begins, letting the client drop stale previous-game state.
  roundId: 0,
  phaseEndTime: null,
  ownRole: null,
  roleRevealId: 0,
  werewolfTeammates: [],
  revealedRoles: {},
  messages: [],
  werewolfMessages: [],
  voteSubmitted: false,
  actionSubmitted: false,
  gameResult: null,
  // Player whose card should pulse while a major elimination event plays.
  highlightedPlayer: null,
  setHighlightedPlayer: (highlightedPlayer) => set({ highlightedPlayer }),

  // Prioritised queue of major game events (medium/high/critical).
  eventQueue: [],
  pushEvent: (event) => set((state) => {
    if (!event || state.eventQueue.some((queued) => queued.id === event.id)) return state;
    return { eventQueue: [...state.eventQueue, event] };
  }),
  dismissEvent: (id) => set((state) => ({
    eventQueue: state.eventQueue.filter((event) => event.id !== id),
  })),
  clearEvents: () => set({ eventQueue: [] }),

  // Connection status: "connected" | "disconnected" | "reconnecting"
  connectionStatus: "disconnected",
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setSession: ({ roomCode, playerName, playerId = "", players = [], host = playerName }) => set((state) => {
    const next = { ...state, roomCode, playerName, playerId, players, host };
    persist(next);
    return next;
  }),
  setPlayers: (players) => set({ players }),
  // The replay lobby is a fresh round: nobody is eliminated and no previous
  // game role may be shown. This mirrors the server's prepareNewRound state.
  setReplayPlayers: (players = []) => set({
    players: players.map((player) => ({ ...player, role: null, alive: true })),
  }),
  setHost: (host) => set({ host }),
  setRoomState: ({ host, phase, day, endsAt, players, role, teammates, messages, werewolfMessages, roundId }) => set((state) => {
    const roundChanged = typeof roundId === "number" && roundId > 0 && roundId !== state.roundId;
    return {
      host,
      phase,
      day,
      phaseEndTime: endsAt || null,
      players,
      ownRole: role,
      werewolfTeammates: teammates || [],
      roundId: typeof roundId === "number" ? roundId : state.roundId,
      roleRevealId: role && role !== state.ownRole ? state.roleRevealId + 1 : state.roleRevealId,
      // Restore chat history on reconnect (only if the server sent messages)
      ...(messages ? { messages } : {}),
      ...(werewolfMessages ? { werewolfMessages } : {}),
      // A fresh round supersedes everything that belonged to the last game.
      ...(roundChanged
        ? { revealedRoles: {}, gameResult: null, eventQueue: [], voteSubmitted: false, actionSubmitted: false, highlightedPlayer: null }
        : {}),
    };
  }),
  setPhase: ({ phase, day, endsAt, players, roundId }) => set((state) => {
    const roundChanged = typeof roundId === "number" && roundId > 0 && roundId !== state.roundId;
    return {
      phase,
      day,
      phaseEndTime: endsAt || null,
      voteSubmitted: false,
      actionSubmitted: false,
      ...(players ? { players } : {}),
      ...(typeof roundId === "number" ? { roundId } : {}),
      ...(roundChanged
        ? { revealedRoles: {}, gameResult: null, eventQueue: [], highlightedPlayer: null }
        : {}),
    };
  }),
  setRole: ({ role, teammates = [] }) => set((state) => ({
    ownRole: role,
    werewolfTeammates: teammates,
    revealedRoles: {},
    roleRevealId: state.roleRevealId + 1,
    // New game → discard the finished game's result screen and events.
    gameResult: null,
    eventQueue: [],
    highlightedPlayer: null,
    voteSubmitted: false,
    actionSubmitted: false,
    // Role assignment marks the instant the server starts a fresh round, at
    // which point every player is alive and no role is public. Resetting here
    // guarantees the previous game's revealed roles/eliminations can never
    // leak into the new one — even if an older server never re-broadcast them.
    players: state.players.map((player) => ({ ...player, role: null, alive: true })),
  })),
  revealPlayerRole: ({ player, role }) => set((state) => ({
    revealedRoles: { ...state.revealedRoles, [player]: role },
  })),
  addMessage: (message, privateMessage = false) => set((state) => ({
    [privateMessage ? "werewolfMessages" : "messages"]: [...state[privateMessage ? "werewolfMessages" : "messages"], message],
  })),
  markVoteSubmitted: () => set({ voteSubmitted: true }),
  markActionSubmitted: () => set({ actionSubmitted: true }),
  setGameResult: (gameResult) => set({ gameResult, phase: "ended", phaseEndTime: null, eventQueue: [] }),
  resetRound: () => set({
    ownRole: null,
    werewolfTeammates: [],
    revealedRoles: {},
    messages: [],
    werewolfMessages: [],
    voteSubmitted: false,
    actionSubmitted: false,
    gameResult: null,
    eventQueue: [],
    highlightedPlayer: null,
  }),
  enterReplayQueue: () => set((state) => ({
    phase: "waiting",
    day: 0,
    phaseEndTime: null,
    ownRole: null,
    werewolfTeammates: [],
    revealedRoles: {},
    messages: [],
    werewolfMessages: [],
    voteSubmitted: false,
    actionSubmitted: false,
    gameResult: null,
    eventQueue: [],
    highlightedPlayer: null,
    // Immediately strip the finished game's reveals from the player list so
    // no role can flicker under a name after "Play again".
    players: state.players.map((player) => ({ ...player, role: null, alive: true })),
  })),
  leave: () => {
    sessionStorage.removeItem("howl-hollow-session");
    set({ roomCode: "", playerName: "", playerId: "", players: [], host: "", phase: "waiting", day: 0, roundId: 0, phaseEndTime: null, ownRole: null, werewolfTeammates: [], revealedRoles: {}, messages: [], werewolfMessages: [], voteSubmitted: false, actionSubmitted: false, gameResult: null, eventQueue: [], highlightedPlayer: null, connectionStatus: "disconnected" });
  },
}));
