import { useEffect } from "react";
import toast from "react-hot-toast";
import { ensureSocket, socket, subscribeSocket } from "../services/socket";
import { useGameStore } from "../store/gameStore";
import { buildGameEvent } from "../lib/gameEvents";
import { useGameSounds } from "./useGameSounds";

function injectSystemMessage(store, text, icon = "✦") {
  store.getState().addMessage({
    sender: null,
    message: text,
    system: true,
    icon,
    timestamp: Date.now(),
  });
}

export function useGameSocket() {
  const roomCode = useGameStore((s) => s.roomCode);
  const playerName = useGameStore((s) => s.playerName);
  const playerId = useGameStore((s) => s.playerId);
  const { play } = useGameSounds();

  useEffect(() => {
    if (!roomCode || !playerName) return undefined;

    const store = useGameStore;

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

      error: (message) =>
        toast.error(message || "The server rejected that action."),
      roomError: (message) => toast.error(message),

      roomState: (result) => {
        if (!result.success)
          return toast.error(
            result.message || "This room is no longer available.",
          );
        store.getState().setRoomState(result.room);
      },

      playerJoined: (players) => store.getState().setPlayers(players),
      playerLeft: ({ player, players } = {}) => {
        if (players) store.getState().setPlayers(players);
        const { phase } = store.getState();
        if (player && ["night", "day", "voting"].includes(phase)) {
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

      gameEvent: (data) => {
        const event = buildGameEvent(data?.kind, data || {});
        if (!event) return;
        store.getState().pushEvent(event);
        if (event.sound) play(event.sound);
      },

      phaseChanged: (data) => {
        store.getState().setPhase(data);

        const labels = {
          night: ["☾", "Night has fallen."],
          day: ["☼", "A new day begins."],
          voting: ["⚖", "The vote has begun."],
        };
        const label = labels[data.phase];
        if (label) injectSystemMessage(store, label[1], label[0]);
      },

      roleAssigned: (data) => store.getState().setRole(data),

      newPublicMessage: (message) => store.getState().addMessage(message),
      newWerewolfMessage: (message) =>
        store.getState().addMessage(message, true),
      publicMessageResult: (result) =>
        result.success || toast.error(result.message || "Message failed."),
      werewolfMessageResult: (result) =>
        result.success || toast.error(result.message || "Message failed."),

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
          injectSystemMessage(
            store,
            `${eliminatedPlayer} did not survive the night.`,
            "☠",
          );
        } else {
          injectSystemMessage(store, "The night passed without a victim.", "☾");
        }
      },

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
          injectSystemMessage(
            store,
            `${eliminatedPlayer} was cast out by the village.`,
            "⚖",
          );
        } else {
          injectSystemMessage(
            store,
            "The vote ended in a tie. No one was eliminated.",
            "⚖",
          );
        }
      },

      gameEnded: (result) => {
        if (isStaleRound(result?.roundId)) return;

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

      gameReset: () => {
        store.getState().resetRound();
        toast("A new hunt begins.", { icon: "✦" });
      },
    });

    return cleanup;
  }, [roomCode, playerName, playerId, play]);
}
