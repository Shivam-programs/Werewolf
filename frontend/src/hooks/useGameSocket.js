import { useEffect } from "react";
import toast from "react-hot-toast";
import { ensureSocket, socket, subscribeSocket } from "../services/socket";
import { useGameStore } from "../store/gameStore";
import { useGameSounds } from "./useGameSounds";

/**
 * FIX B10: The previous version included many store action references and
 * `ownRole` in the useEffect dependency array. This caused the entire
 * listener setup to be torn down and rebuilt every time the role changed
 * (and on every render due to Zustand selector identity).
 *
 * The fix: only depend on the three identity values (roomCode, playerName,
 * playerId). Inside every handler, read current state via
 * `useGameStore.getState()` so we always have the latest value without
 * needing it in the dependency array.
 */
export function useGameSocket() {
  const roomCode = useGameStore((s) => s.roomCode);
  const playerName = useGameStore((s) => s.playerName);
  const playerId = useGameStore((s) => s.playerId);
  const { play } = useGameSounds();

  useEffect(() => {
    if (!roomCode || !playerName) return undefined;

    const store = useGameStore;

    const register = () => {
      socket.emit("registerPlayer", {
        roomCode,
        playerName,
        playerId: playerId || null,
      });
    };

    ensureSocket();
    if (socket.connected) register();

    const cleanup = subscribeSocket({
      // ---- Connection lifecycle ----
      connect: () => {
        store.getState().setConnectionStatus("connected");
        register();
      },
      disconnect: () => {
        store.getState().setConnectionStatus("disconnected");
        toast.error("Connection lost. Reconnecting…");
      },
      reconnect_attempt: () => {
        store.getState().setConnectionStatus("reconnecting");
      },
      connect_error: () => {
        store.getState().setConnectionStatus("reconnecting");
        toast.error("Unable to reach the game server.");
      },

      // ---- Server errors ----
      error: (message) =>
        toast.error(message || "The server rejected that action."),
      roomError: (message) => toast.error(message),

      // ---- Room state (full sync on connect/reconnect) ----
      roomState: (result) => {
        if (!result.success)
          return toast.error(
            result.message || "This room is no longer available.",
          );
        store.getState().setRoomState(result.room);
      },

      // ---- Player list updates ----
      // The server now pushes the full players array in playerConnected,
      // so we no longer need an HTTP round-trip.
      playerJoined: (players) => store.getState().setPlayers(players),
      playerLeft: (players) => store.getState().setPlayers(players),
      playerConnected: ({ players }) => {
        if (players) store.getState().setPlayers(players);
      },
      playerDisconnected: ({ players }) => {
        if (players) store.getState().setPlayers(players);
      },
      queueUpdated: (players) => store.getState().setPlayers(players),
      hostChanged: ({ host }) => store.getState().setHost(host),

      // ---- Phase changes ----
      phaseChanged: (data) => store.getState().setPhase(data),

      // ---- Role assignment ----
      roleAssigned: (data) => store.getState().setRole(data),

      // ---- Chat messages ----
      newPublicMessage: (message) => store.getState().addMessage(message),
      newWerewolfMessage: (message) =>
        store.getState().addMessage(message, true),
      publicMessageResult: (result) =>
        result.success || toast.error(result.message || "Message failed."),
      werewolfMessageResult: (result) =>
        result.success || toast.error(result.message || "Message failed."),

      // ---- Seer action events ----
      actionError: (result) => toast.error(result.message),
      seerResult: (result) => {
        if (!result.success) return toast.error(result.message);
        store.getState().revealPlayerRole(result);
        store.getState().markActionSubmitted();
        play(result.role === "Werewolf" ? "seerWolf" : "seerVillager");
        return toast.success(`${result.player} is ${result.role}.`);
      },

      // ---- Night resolution ----
      nightEnded: ({ eliminatedPlayer, protectedPlayer, players }) => {
        store.getState().setPlayers(players);
        if (eliminatedPlayer) play("killed");
        else if (protectedPlayer) play("protected");
        const message = eliminatedPlayer
          ? `${eliminatedPlayer} did not survive the night.`
          : protectedPlayer
            ? `The Knight protected ${protectedPlayer}.`
            : "The night passed without a victim.";
        toast(message, { icon: "☾" });
      },

      // ---- Voting resolution ----
      votingEnded: ({ eliminatedPlayer, players }) => {
        store.getState().setPlayers(players);
        if (eliminatedPlayer) play("voteKick");
        toast(
          eliminatedPlayer
            ? `${eliminatedPlayer} was cast out.`
            : "The vote ended in a tie.",
          { icon: "⚖" },
        );
      },

      // ---- Game over ----
      gameEnded: (result) => {
        store.getState().setGameResult(result);
        const { ownRole } = store.getState();
        const won =
          (result.winner === "Werewolves" && ownRole === "Werewolf") ||
          (result.winner === "Villagers" &&
            ownRole !== null &&
            ownRole !== "Werewolf");
        if (won) play("winner");
        else if (ownRole !== null) play("defeat");
      },

      // ---- Game reset ----
      gameReset: () => {
        store.getState().resetRound();
        toast("A new hunt begins.", { icon: "✦" });
      },
    });

    return cleanup;
    // Only re-register when identity changes, not on every store action ref change
  }, [roomCode, playerName, playerId, play]);
}
