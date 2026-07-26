import { useEffect } from "react";
import toast from "react-hot-toast";
import { api } from "../services/api";
import { ensureSocket, socket, subscribeSocket } from "../services/socket";
import { useGameStore } from "../store/gameStore";

export function useGameSocket() {
  const { roomCode, playerName, setPlayers, setPhase, setRole, addMessage, revealPlayerRole, setGameResult, resetRound } = useGameStore();
  useEffect(() => {
    if (!roomCode || !playerName) return undefined;
    const register = () => socket.emit("registerPlayer", { roomCode, playerName });
    const refreshPlayers = async () => { try { const data = await api.getPlayers(roomCode); setPlayers(data.players || data); } catch { /* Room may have been deleted. */ } };
    ensureSocket();
    if (socket.connected) register();
    const cleanup = subscribeSocket({
      connect: register,
      disconnect: () => toast.error("Connection lost. Reconnecting..."),
      connect_error: () => toast.error("Unable to reach the game server."),
      playerJoined: setPlayers,
      playerLeft: setPlayers,
      playerConnected: refreshPlayers,
      phaseChanged: setPhase,
      roleAssigned: (data) => { setRole(data); },
      newPublicMessage: (message) => addMessage(message),
      newWerewolfMessage: (message) => addMessage(message, true),
      publicMessageResult: (result) => result.success || toast.error(result.message || "Message failed."),
      werewolfMessageResult: (result) => result.success || toast.error(result.message || "Message failed."),
      actionError: (result) => toast.error(result.message),
      seerResult: (result) => {
        if (!result.success) return toast.error(result.message);
        revealPlayerRole(result);
        return toast.success(`${result.player} is ${result.role}.`);
      },
      nightEnded: ({ eliminatedPlayer, players }) => { setPlayers(players); toast(eliminatedPlayer ? `${eliminatedPlayer} did not survive the night.` : "The night passed without a victim.", { icon: "☾" }); },
      votingEnded: ({ eliminatedPlayer, players }) => { setPlayers(players); toast(eliminatedPlayer ? `${eliminatedPlayer} was cast out.` : "The vote ended in a tie.", { icon: "⚖" }); },
      gameEnded: setGameResult,
      gameReset: () => { resetRound(); toast("A new hunt begins.", { icon: "✦" }); },
    });
    refreshPlayers();
    return cleanup;
  }, [roomCode, playerName, setPlayers, setPhase, setRole, addMessage, revealPlayerRole, setGameResult, resetRound]);
}
