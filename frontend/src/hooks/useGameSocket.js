import { useEffect } from "react";
import toast from "react-hot-toast";
import { ensureSocket, socket, subscribeSocket } from "../services/socket";
import { useGameStore } from "../store/gameStore";
import { useGameSounds } from "./useGameSounds";

/**
 * Helper: inject a system-style message into the public chat.
 * System messages have `sender: null` and `system: true` so
 * the ChatPanel can render them as centered dividers.
 */
function injectSystemMessage(store, text, icon = "✦") {
  store.getState().addMessage({
    sender: null,
    message: text,
    system: true,
    icon,
    timestamp: Date.now(),
  });
}

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
      phaseChanged: (data) => {
        store.getState().setPhase(data);
        // Inject phase change as system message in chat
        const labels = {
          night: ["☾", "Night has fallen."],
          day: ["☼", "A new day begins."],
          voting: ["⚖", "The vote has begun."],
        };
        const label = labels[data.phase];
        if (label) injectSystemMessage(store, label[1], label[0]);
      },

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
        if (eliminatedPlayer) {
          play("killed");
          // Center-screen dramatic event
          store.getState().setGameEvent({
            icon: "☠",
            title: `${eliminatedPlayer} has fallen`,
            subtitle: "They did not survive the night.",
            accent: "text-rose-100",
          });
          injectSystemMessage(store, `${eliminatedPlayer} did not survive the night.`, "☠");
        } else if (protectedPlayer) {
          play("protected");
          store.getState().setGameEvent({
            icon: "🛡️",
            title: "The Knight prevails",
            subtitle: `${protectedPlayer} was protected from the wolves.`,
            accent: "text-sky-100",
          });
          injectSystemMessage(store, `The Knight protected ${protectedPlayer}.`, "🛡️");
        } else {
          injectSystemMessage(store, "The night passed without a victim.", "☾");
        }
        // Keep the toast as secondary notification
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
        if (eliminatedPlayer) {
          play("voteKick");
          store.getState().setGameEvent({
            icon: "⚖",
            title: `${eliminatedPlayer} was cast out`,
            subtitle: "The village has spoken.",
            accent: "text-amber-100",
          });
          injectSystemMessage(store, `${eliminatedPlayer} was cast out by the village.`, "⚖");
        } else {
          injectSystemMessage(store, "The vote ended in a tie. No one was eliminated.", "⚖");
        }
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
