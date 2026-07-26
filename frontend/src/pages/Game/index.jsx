import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../store/gameStore";
import { socket } from "../../services/socket";
import { PlayerList } from "../../components/players/PlayerList";
import { ChatPanel } from "../../components/chat/ChatPanel";
import { ActionPanel } from "../../components/game/ActionPanel";
import { RoleReveal } from "../../components/game/RoleReveal";
import { GameOver } from "../../components/game/GameOver";
import { Countdown } from "../../components/ui/Countdown";

const phaseLabels = {
  night: ["Night", "☾", "The wolves are listening."],
  day: ["Day", "☼", "The village gathers to speak."],
  voting: ["Voting", "⚖", "The village passes judgement."],
  ended: ["Ended", "✦", "The truth is known."],
  waiting: ["Waiting", "◌", "The village is gathering."],
};

export default function Game() {
  const navigate = useNavigate();
  const {
    roomCode,
    phase,
    day,
    phaseEndTime,
    ownRole,
    roleRevealId,
    werewolfTeammates,
    gameResult,
    playerName,
    leave,
  } = useGameStore();
  const [title, icon, description] = phaseLabels[phase] || phaseLabels.waiting;
  const home = () => {
    socket.disconnect();
    leave();
    navigate("/");
  };
  return (
    <main className="game-shell">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl text-zinc-100 sm:text-2xl">
              WERE <span className="text-amber-200">WOLF</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-zinc-600">
              Room {roomCode}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-zinc-500 sm:inline">
              You are <b className="text-zinc-200">{playerName}</b>
            </span>
            {ownRole && (
              <span className="rounded-full border border-amber-200/20 bg-amber-200/5] px-3 py-1.5 text-xs font-bold text-amber-100">
                {ownRole}
              </span>
            )}
          </div>
        </header>
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <PlayerList />
          <section className="min-w-0 space-y-4">
            <motion.section
              key={phase}
              initial={{ opacity: 0.5, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`phase-card phase-${phase} p-6 sm:p-8`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">
                    {phase === "night"
                      ? "The moon watches"
                      : "Village chronicle"}
                  </p>
                  <h1 className="font-display mt-2 text-4xl text-zinc-50 sm:text-5xl">
                    {icon} {title}
                    {day > 0 && <span className="text-zinc-500"> · {day}</span>}
                  </h1>
                  <p className="mt-3 text-sm text-zinc-300">{description}</p>
                </div>
                <Countdown endsAt={phaseEndTime} />
              </div>
            </motion.section>
            <ActionPanel />
          </section>
          <ChatPanel />
        </div>
      </div>
      {ownRole && <RoleReveal key={roleRevealId} role={ownRole} Teammates={werewolfTeammates} />}
      <GameOver
        result={gameResult}
        onPlayAgain={() => socket.emit("startGame", { roomCode })}
        onHome={home}
      />
    </main>
  );
}
