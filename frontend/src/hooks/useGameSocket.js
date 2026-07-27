import { useEffect } from "react";
import toast from "react-hot-toast";
import { api } from "../services/api";
import { ensureSocket, socket, subscribeSocket } from "../services/socket";
import { useGameStore } from "../store/gameStore";
import { useGameSounds } from "./useGameSounds";

export function useGameSocket() {
  const { roomCode, playerName, ownRole, setPlayers, setPhase, setRole, addMessage, revealPlayerRole, setGameResult, resetRound } = useGameStore();
  const { play } = useGameSounds();
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
      playerDisconnected: ({ players }) => setPlayers(players),
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
        play(result.role === "Werewolf" ? "seerWolf" : "seerVillager");
        return toast.success(`${result.player} is ${result.role}.`);
      },
      nightEnded: ({ eliminatedPlayer, protectedPlayer, players }) => {
        setPlayers(players);
        if (eliminatedPlayer) play("killed");
        else if (protectedPlayer) play("protected");
        const message = eliminatedPlayer
          ? `${eliminatedPlayer} did not survive the night.`
          : protectedPlayer
            ? `The Knight protected ${protectedPlayer}.`
            : "The night passed without a victim.";
        toast(message, { icon: "☾" });
      },
      votingEnded: ({ eliminatedPlayer, players }) => {
        setPlayers(players);
        if (eliminatedPlayer) play("voteKick");
        toast(eliminatedPlayer ? `${eliminatedPlayer} was cast out.` : "The vote ended in a tie.", { icon: "⚖" });
      },
      gameEnded: (result) => {
        setGameResult(result);
        const won =
          (result.winner === "Werewolves" && ownRole === "Werewolf") ||
          (result.winner === "Villagers" && ownRole !== null && ownRole !== "Werewolf");
        if (won) play("winner");
        else if (ownRole !== null) play("defeat");
      },
      gameReset: () => { resetRound(); toast("A new hunt begins.", { icon: "✦" }); },
    });
    refreshPlayers();
    return cleanup;
  }, [roomCode, playerName, ownRole, setPlayers, setPhase, setRole, addMessage, revealPlayerRole, setGameResult, resetRound, play]);
}
