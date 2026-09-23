import { useEffect } from "react";
import toast from "react-hot-toast";
import { ensureSocket, socket, subscribeSocket } from "../services/socket";
import { useGameStore } from "../store/gameStore";
import { buildGameEvent } from "../lib/gameEvents";
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

    // A late event from a previous game must never mutate the current one.
    const isStaleRound = (roundId) => {
      const current = store.getState().roundId;
      return typeof roundId === "number" && current > 0 && roundId !== current;
    };

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
      playerLeft: ({ player, players } = {}) => {
        if (players) store.getState().setPlayers(players);
        const { phase } = store.getState();
        if (player && ["night", "day", "voting"].includes(phase)) {
          // Leaving mid-game effectively removes a player from the hunt.
          store.getState().pushEvent(
            buildGameEvent("removed", {
              player,
              message: "left the game and can no longer take part.",
            }),
          );
          store.getState().setHighlightedPlayer(player);
        } else if (player) {
          toast(`${player} left the room.`, { icon: "👋" });
        }
      },
      playerConnected: ({ player, players }) => {
        if (players) store.getState().setPlayers(players);
        if (player) toast(`${player} reconnected.`, { icon: "✓" });
      },
      playerDisconnected: ({ player, players }) => {
        if (players) store.getState().setPlayers(players);
        if (player) toast(`${player} lost connection.`, { icon: "⚡" });
      },
      queueUpdated: (players) => store.getState().setReplayPlayers(players),
      hostChanged: ({ host }) => store.getState().setHost(host),

      // ---- Server-driven major game events (personal + broadcast) ----
      gameEvent: (data) => {
        const event = buildGameEvent(data?.kind, data || {});
        if (!event) return;
        store.getState().pushEvent(event);
        if (event.sound) play(event.sound);
      },

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

      // ---- Seer action events (private to the seer) ----
      actionError: (result) => toast.error(result.message),
      seerResult: (result) => {
        if (!result.success) return toast.error(result.message);
        store.getState().revealPlayerRole(result);
        store.getState().markActionSubmitted();
        play(result.role === "Werewolf" ? "seerWolf" : "seerVillager");
        store.getState().pushEvent(
          buildGameEvent("seerResult", {
            player: result.player,
            message: `You see ${result.player} as ${result.role}.`,
          }),
        );
        return undefined;
      },

      // ---- Night resolution ----
      nightEnded: ({ roundId, eliminatedPlayer, players }) => {
        if (isStaleRound(roundId)) return;
        store.getState().setPlayers(players);
        if (eliminatedPlayer) {
          play("killed");
          store.getState().pushEvent(
            buildGameEvent("eliminated", {
              player: eliminatedPlayer,
              message: "did not survive the night.",
            }),
          );
          store.getState().setHighlightedPlayer(eliminatedPlayer);
          injectSystemMessage(store, `${eliminatedPlayer} did not survive the night.`, "☠");
        } else {
          injectSystemMessage(store, "The night passed without a victim.", "☾");
        }
      },

      // ---- Voting resolution ----
      votingEnded: ({ roundId, eliminatedPlayer, players }) => {
        if (isStaleRound(roundId)) return;
        store.getState().setPlayers(players);
        if (eliminatedPlayer) {
          play("voteKick");
          store.getState().pushEvent(
            buildGameEvent("votedOut", {
              player: eliminatedPlayer,
              message: "was cast out by the village.",
            }),
          );
          store.getState().setHighlightedPlayer(eliminatedPlayer);
          injectSystemMessage(store, `${eliminatedPlayer} was cast out by the village.`, "⚖");
        } else {
          injectSystemMessage(store, "The vote ended in a tie. No one was eliminated.", "⚖");
        }
      },

      // ---- Game over ----
      gameEnded: (result) => {
        // Ignore an ending that belongs to an already-finished round.
        if (isStaleRound(result?.roundId)) return;
        // setGameResult clears any pending event so the result screen is the
        // single, authoritative presentation of the ending.
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
