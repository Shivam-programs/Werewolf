import { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useGameStore } from "../../store/gameStore";
import { socket } from "../../services/socket";
import { useGameSounds } from "../../hooks/useGameSounds";
import { Button } from "../ui/Button";

const copy = {
  Werewolf: {
    heading: "Choose a victim",
    event: "werewolfVote",
    label: "Mark victim",
    icon: "🐺",
    accent: "border-rose-400 bg-rose-400/10 text-rose-100",
  },
  Knight: {
    heading: "Choose a player to protect",
    event: "knightProtect",
    label: "Grant protection",
    icon: "🛡️",
    accent: "border-sky-400 bg-sky-400/10 text-sky-100",
  },
  Seer: {
    heading: "Choose a player to inspect",
    event: "seerPeek",
    label: "Reveal role",
    icon: "🔮",
    accent: "border-violet-400 bg-violet-400/10 text-violet-100",
  },
};

const votingCopy = {
  heading: "Cast your vote",
  event: "publicVote",
  label: "Submit vote",
  icon: "⚖",
  accent: "border-amber-300 bg-amber-300/10 text-amber-100",
};

function PassiveState({ icon, title, text }) {
  return (
    <div className="action-copy">
      <span className="action-icon">{icon}</span>
      <div>
        <p className="font-semibold text-zinc-100">{title}</p>
        <p className="mt-1 text-sm">{text}</p>
      </div>
    </div>
  );
}

export function ActionPanel() {
  const { play } = useGameSounds();
  const {
    roomCode,
    playerName,
    players,
    phase,
    ownRole,
    werewolfTeammates,
    actionSubmitted,
    voteSubmitted,
    markActionSubmitted,
    markVoteSubmitted,
  } = useGameStore();
  const [selected, setSelected] = useState("");

  const alivePlayers = players.filter((p) => p.alive !== false);
  const currentPlayer = players.find((p) => p.name === playerName);
  const isAlive = currentPlayer?.alive !== false;

  const eligibleTargets =
    phase === "night" && ownRole === "Werewolf"
      ? alivePlayers.filter(
          (p) => p.name !== playerName && !werewolfTeammates.includes(p.name),
        )
      : phase === "night" && ownRole === "Knight"
        ? alivePlayers
        : alivePlayers.filter((p) => p.name !== playerName);

  const selectedTarget = eligibleTargets.some((p) => p.name === selected)
    ? selected
    : "";

  const actionConfig = phase === "voting" ? votingCopy : copy[ownRole] || null;
  const submitted = phase === "voting" ? voteSubmitted : actionSubmitted;

  if (phase === "day")
    return (
      <PassiveState
        icon="☼"
        title="The village is awake."
        text="Discuss what you think. The vote begins when the sun sets."
      />
    );
  if (phase !== "night" && phase !== "voting")
    return (
      <PassiveState
        icon="◌"
        title="The village holds its breath."
        text="Waiting for the next phase."
      />
    );
  if (!isAlive)
    return (
      <PassiveState
        icon="☠"
        title="You have fallen."
        text="You can observe, but cannot take part in any actions or votes."
      />
    );
  if (phase === "night" && !actionConfig)
    return (
      <PassiveState
        icon="☾"
        title="Night has fallen."
        text="Keep still. Your only task is to survive until dawn."
      />
    );

  const submit = () => {
    if (!selectedTarget) return toast.error("Choose a player first.");

    const event = actionConfig.event;
    const callback = (result) => {
      if (result?.success) {
        if (phase === "voting") {
          markVoteSubmitted();
          toast.success(`Your vote for ${selectedTarget} is sealed.`);
        } else {
          markActionSubmitted();
          if (event === "knightProtect") play("select");
          toast.success(result.message);
        }
      } else {
        toast.error(result?.message || "Your action could not be saved.");
      }
    };

    socket.emit(event, { roomCode, target: selectedTarget }, callback);
  };

  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{actionConfig.icon}</span>
          <div>
            <p className="eyebrow">
              {phase === "voting" ? "Judgement" : ownRole}
            </p>
            <h2 className="font-display text-2xl text-zinc-50">
              {actionConfig.heading}
            </h2>
          </div>
        </div>
        {submitted && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200"
          >
            ✓ Submitted
          </motion.span>
        )}
      </div>

      {}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {eligibleTargets.map((player) => {
          const playerNumber =
            players.findIndex(({ name }) => name === player.name) + 1;
          const isDisconnected = player.afk || player.connected === false;
          const isSelected = selectedTarget === player.name;

          return (
            <motion.button
              whileHover={!submitted ? { scale: 1.02, y: -1 } : {}}
              whileTap={!submitted ? { scale: 0.98 } : {}}
              disabled={submitted}
              onClick={() => setSelected(player.name)}
              key={player.name}
              className={`relative rounded-xl border p-3 text-left text-sm transition ${
                isSelected
                  ? actionConfig.accent
                  : "border-white/8 bg-white/[.025] text-zinc-300 hover:border-white/15 hover:bg-white/[.04]"
              } ${submitted ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="mb-2 grid h-7 w-7 place-items-center rounded-md bg-black/20 text-xs font-bold">
                {playerNumber}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {player.name}
                  {isDisconnected && (
                    <span className="ml-1 text-xs text-yellow-300">⚡</span>
                  )}
                </span>
                {submitted && isSelected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-base text-emerald-300"
                  >
                    ✓
                  </motion.span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>

      <Button
        disabled={submitted || !eligibleTargets.length}
        onClick={submit}
        className="mt-4 w-full"
      >
        {submitted ? "✓ Action locked" : actionConfig.label}
      </Button>
    </section>
  );
}
