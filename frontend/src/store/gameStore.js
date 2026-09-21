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

  // Connection status: "connected" | "disconnected" | "reconnecting"
  connectionStatus: "disconnected",
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setSession: ({ roomCode, playerName, playerId = "", players = [], host = playerName }) => set((state) => {
    const next = { ...state, roomCode, playerName, playerId, players, host };
    persist(next);
    return next;
  }),
  setPlayers: (players) => set({ players }),
  setHost: (host) => set({ host }),
  setRoomState: ({ host, phase, day, endsAt, players, role, teammates, messages, werewolfMessages }) => set((state) => ({
    host,
    phase,
    day,
    phaseEndTime: endsAt || null,
    players,
    ownRole: role,
    werewolfTeammates: teammates || [],
    roleRevealId: role && role !== state.ownRole ? state.roleRevealId + 1 : state.roleRevealId,
    // Restore chat history on reconnect (only if the server sent messages)
    ...(messages ? { messages } : {}),
    ...(werewolfMessages ? { werewolfMessages } : {}),
  })),
  setPhase: ({ phase, day, endsAt }) => set({ phase, day, phaseEndTime: endsAt || null, voteSubmitted: false, actionSubmitted: false }),
  setRole: ({ role, teammates = [] }) => set((state) => ({ ownRole: role, werewolfTeammates: teammates, revealedRoles: {}, roleRevealId: state.roleRevealId + 1 })),
  revealPlayerRole: ({ player, role }) => set((state) => ({
    revealedRoles: { ...state.revealedRoles, [player]: role },
  })),
  addMessage: (message, privateMessage = false) => set((state) => ({
    [privateMessage ? "werewolfMessages" : "messages"]: [...state[privateMessage ? "werewolfMessages" : "messages"], message],
  })),
  markVoteSubmitted: () => set({ voteSubmitted: true }),
  markActionSubmitted: () => set({ actionSubmitted: true }),
  setGameResult: (gameResult) => set({ gameResult, phase: "ended", phaseEndTime: null }),
  resetRound: () => set({
    ownRole: null,
    werewolfTeammates: [],
    revealedRoles: {},
    messages: [],
    werewolfMessages: [],
    voteSubmitted: false,
    actionSubmitted: false,
    gameResult: null,
  }),
  enterReplayQueue: () => set({
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
  }),
  leave: () => {
    sessionStorage.removeItem("howl-hollow-session");
    set({ roomCode: "", playerName: "", playerId: "", players: [], host: "", phase: "waiting", day: 0, phaseEndTime: null, ownRole: null, werewolfTeammates: [], revealedRoles: {}, messages: [], werewolfMessages: [], voteSubmitted: false, actionSubmitted: false, gameResult: null, connectionStatus: "disconnected" });
  },
}));
