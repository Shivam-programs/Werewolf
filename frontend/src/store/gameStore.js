import { create } from "zustand";

const savedSession = JSON.parse(sessionStorage.getItem("howl-hollow-session") || "null");

const persist = (state) => sessionStorage.setItem("howl-hollow-session", JSON.stringify({
  roomCode: state.roomCode, playerName: state.playerName,
}));

export const useGameStore = create((set) => ({
  roomCode: savedSession?.roomCode || "",
  playerName: savedSession?.playerName || "",
  players: [],
  host: "",
  phase: "waiting",
  day: 0,
  phaseEndTime: null,
  ownRole: null,
  roleRevealId: 0,
  werewolfTeammates: [],
  messages: [],
  werewolfMessages: [],
  voteSubmitted: false,
  actionSubmitted: false,
  gameResult: null,
  setSession: ({ roomCode, playerName, players = [], host = playerName }) => set((state) => {
    const next = { ...state, roomCode, playerName, players, host };
    persist(next);
    return next;
  }),
  setPlayers: (players) => set({ players }),
  setPhase: ({ phase, day, endsAt }) => set({ phase, day, phaseEndTime: endsAt || null, voteSubmitted: false, actionSubmitted: false }),
  setRole: ({ role, teammates = [] }) => set((state) => ({ ownRole: role, werewolfTeammates: teammates, roleRevealId: state.roleRevealId + 1 })),
  addMessage: (message, privateMessage = false) => set((state) => ({
    [privateMessage ? "werewolfMessages" : "messages"]: [...state[privateMessage ? "werewolfMessages" : "messages"], message],
  })),
  markVoteSubmitted: () => set({ voteSubmitted: true }),
  markActionSubmitted: () => set({ actionSubmitted: true }),
  setGameResult: (gameResult) => set({ gameResult, phase: "ended", phaseEndTime: null }),
  resetRound: () => set({ ownRole: null, werewolfTeammates: [], voteSubmitted: false, actionSubmitted: false, gameResult: null }),
  leave: () => {
    sessionStorage.removeItem("howl-hollow-session");
    set({ roomCode: "", playerName: "", players: [], host: "", phase: "waiting", day: 0, phaseEndTime: null, ownRole: null, werewolfTeammates: [], messages: [], werewolfMessages: [], voteSubmitted: false, actionSubmitted: false, gameResult: null });
  },
}));
