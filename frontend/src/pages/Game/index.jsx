import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../store/gameStore";
import { ensureSocket, socket } from "../../services/socket";
import { PlayerList } from "../../components/players/PlayerList";
import { ChatPanel } from "../../components/chat/ChatPanel";
import { ActionPanel } from "../../components/game/ActionPanel";
import { RoleReveal } from "../../components/game/RoleReveal";
import { GameOver } from "../../components/game/GameOver";
import { PhaseTransition } from "../../components/game/PhaseTransition";
import { GameStartOverlay } from "../../components/game/GameStartOverlay";
import { GameEventOverlay } from "../../components/game/GameEvent";
import { Countdown } from "../../components/ui/Countdown";
import { useGameSounds } from "../../hooks/useGameSounds";

const PHASE_DURATION = { night: 60_000, day: 60_000, voting: 30_000 };

const phaseLabels = {
  night: ["Night", "☾", "The wolves are listening."],
  day: ["Day", "☼", "The village gathers to speak."],
  voting: ["Voting", "⚖", "The village passes judgement."],
  ended: ["Ended", "✦", "The truth is known."],
  waiting: ["Waiting", "◌", "The village is gathering."],
};

const roleIcons = {
  Werewolf: "🐺",
  Knight: "🛡️",
  Seer: "🔮",
  Villager: "🏘️",
};

function ConnectionBanner() {
  const status = useGameStore((s) => s.connectionStatus);
  const [showSuccess, setShowSuccess] = useState(false);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current !== "connected" && status === "connected") {
      setShowSuccess(true);
      const t = window.setTimeout(() => setShowSuccess(false), 2000);
      prevStatus.current = status;
      return () => window.clearTimeout(t);
    }
    prevStatus.current = status;
    return undefined;
  }, [status]);

  return (
    <AnimatePresence>
      {status !== "connected" && (
        <motion.div
          key="disconnected"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-yellow-500/90 px-4 py-2 text-sm font-bold text-zinc-950 backdrop-blur-sm"
        >
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
          {status === "reconnecting"
            ? "Reconnecting to the game server…"
            : "Connection lost. Attempting to reconnect…"}
        </motion.div>
      )}
      {showSuccess && (
        <motion.div
          key="connected"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-emerald-500/90 px-4 py-2 text-sm font-bold text-zinc-950 backdrop-blur-sm"
        >
          ✓ Connection restored
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const mobileTabs = [
  { key: "players", label: "Players", icon: "👥" },
  { key: "game", label: "Game", icon: "⚔" },
  { key: "chat", label: "Chat", icon: "💬" },
];

function MobileTabBar({ active, onChange }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/8 bg-zinc-950/95 backdrop-blur-md xl:hidden">
      {mobileTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
            active === tab.key ? "text-amber-200" : "text-zinc-500"
          }`}
        >
          <span className="text-base">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function Game() {
  const navigate = useNavigate();
  const { play, enable, disable } = useGameSounds();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [joiningNextRound, setJoiningNextRound] = useState(false);
  const [mobileTab, setMobileTab] = useState("game");
  const {
    roomCode,
    phase,
    day,
    phaseEndTime,
    ownRole,
    roleRevealId,
    werewolfTeammates,
    gameResult,
    eventQueue,
    playerName,
    leave,
    enterReplayQueue,
  } = useGameStore();

  const hasPendingEvent = eventQueue.length > 0;

  useEffect(() => {
    if (["night", "day", "voting"].includes(phase)) play(phase);
  }, [phase, play]);

  const [title, icon, description] = phaseLabels[phase] || phaseLabels.waiting;

  const home = () => {
    socket.emit("leaveRoom", { roomCode, playerName });
    socket.disconnect();
    leave();
    navigate("/");
  };

  const toggleSound = () => {
    if (soundEnabled) disable();
    else enable();
    setSoundEnabled((s) => !s);
  };

  const playAgain = () => {
    if (joiningNextRound) return;
    if (!socket.connected) {
      ensureSocket();
      toast.error(
        "Reconnecting to the game server. Please try again in a moment.",
      );
      return;
    }
    setJoiningNextRound(true);
    socket
      .timeout(5_000)
      .emit("queueForNextRound", { roomCode }, (error, result) => {
        setJoiningNextRound(false);
        if (error) {
          toast.error("Could not join the next round. Please try again.");
          return;
        }
        if (result?.success) {
          enterReplayQueue();
          return;
        }
        toast.error(result?.message || "Could not join the next round.");
      });
  };

  return (
    <main className="game-shell" data-phase={phase}>
      <ConnectionBanner />
      <PhaseTransition phase={phase} suspended={hasPendingEvent} />
      <GameStartOverlay phase={phase} />

      <div className="mx-auto max-w-[1600px] px-4 py-4 pb-20 sm:px-6 sm:py-6 xl:pb-6">
        {}
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl text-zinc-100 sm:text-2xl">
              WERE <span className="text-amber-200">WOLF</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-zinc-600">
              Room {roomCode}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {}
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={!soundEnabled}
              aria-label={
                soundEnabled ? "Mute game sounds" : "Enable game sounds"
              }
              title={soundEnabled ? "Mute sounds" : "Enable sounds"}
              className="rounded-lg border border-white/10 bg-white/[.03] px-2 py-1.5 text-xs font-bold text-zinc-200 transition hover:border-amber-200/40 hover:bg-white/[.07]"
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>

            {}
            <span className="hidden text-xs text-zinc-500 sm:inline">
              You are <b className="text-zinc-200">{playerName}</b>
            </span>

            {}
            {ownRole && (
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold sm:px-3 sm:py-1.5 ${
                  ownRole === "Werewolf"
                    ? "border-rose-500/20 bg-rose-500/[.08] text-rose-200"
                    : ownRole === "Seer"
                      ? "border-violet-500/20 bg-violet-500/[.08] text-violet-200"
                      : ownRole === "Knight"
                        ? "border-sky-500/20 bg-sky-500/[.08] text-sky-200"
                        : "border-amber-200/20 bg-amber-200/[.05] text-amber-100"
                }`}
              >
                <span>{roleIcons[ownRole] || "🏘️"}</span>
                <span className="hidden sm:inline">{ownRole}</span>
              </span>
            )}
          </div>
        </header>

        {}
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          {}
          <div className={mobileTab !== "players" ? "hidden xl:block" : ""}>
            <PlayerList />
          </div>

          {}
          <div className={mobileTab !== "game" ? "hidden xl:block" : ""}>
            <section className="min-w-0 space-y-4">
              {}
              <motion.section
                key={phase}
                initial={{ opacity: 0.5, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`phase-card phase-${phase} p-5 sm:p-8`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">
                      {phase === "night"
                        ? "The moon watches"
                        : phase === "voting"
                          ? "The scales of justice"
                          : "Village chronicle"}
                    </p>
                    <h1 className="font-display mt-2 text-3xl text-zinc-50 sm:text-5xl">
                      {icon} {title}
                      {day > 0 && (
                        <span className="text-zinc-500"> · {day}</span>
                      )}
                    </h1>
                    <p className="mt-2 text-sm text-zinc-300 sm:mt-3">
                      {description}
                    </p>
                  </div>
                  <Countdown
                    endsAt={phaseEndTime}
                    totalDuration={PHASE_DURATION[phase]}
                  />
                </div>
              </motion.section>

              {}
              <ActionPanel />
            </section>
          </div>

          {}
          <div className={mobileTab !== "chat" ? "hidden xl:block" : ""}>
            <ChatPanel />
          </div>
        </div>
      </div>

      {}
      <MobileTabBar active={mobileTab} onChange={setMobileTab} />

      {}
      <GameEventOverlay />

      {}
      {ownRole && (
        <RoleReveal
          key={roleRevealId}
          role={ownRole}
          Teammates={werewolfTeammates}
        />
      )}

      {}
      <GameOver
        result={gameResult}
        onPlayAgain={playAgain}
        joiningNextRound={joiningNextRound}
        onHome={home}
      />
    </main>
  );
}
