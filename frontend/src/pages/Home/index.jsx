import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../services/api";
import { useGameStore } from "../../store/gameStore";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const roleCards = [
  { icon: "🐺", name: "Werewolf", count: 2, color: "text-rose-300" },
  { icon: "🔮", name: "Seer", count: 1, color: "text-violet-300" },
  { icon: "🛡️", name: "Knight", count: 1, color: "text-sky-300" },
  { icon: "🏘️", name: "Villager", count: 3, color: "text-amber-300" },
];

export default function Home() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const playerName = name.trim();
    const code = (mode === "create" ? roomCode || makeCode() : roomCode)
      .trim()
      .toUpperCase();
    if (!playerName) return toast.error("Tell the village your name first.");
    if (!code) return toast.error("Enter the six-character room code.");
    setLoading(true);
    try {
      const response =
        mode === "create"
          ? await api.createGame(code, playerName)
          : await api.joinGame(code, playerName);
      const room = response.room;
      setSession({
        roomCode: code,
        playerName,
        playerId: response.playerId || "",
        players: room?.players || [],
        host: room?.host || playerName,
      });
      navigate(`/room/${code}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="home-shell">
      <div className="mist mist-one" />
      <div className="mist mist-two" />

      <section className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[.06] px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-amber-100">
            ✦ Social deduction · 7 players
          </div>
          <p className="eyebrow">Suspicion is the greatest weapon</p>
          <h1 className="font-display mt-3 text-6xl leading-[.85] text-zinc-50 sm:text-8xl">
            WERE
            <br />
            <span className="text-amber-200">
              &nbsp;&nbsp;&nbsp; WOLF
            </span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
            The village sleeps lightly. Gather seven souls, hide your loyalties,
            and find the wolves before the moon claims everyone.
          </p>

          {/* Role preview cards */}
          <div className="mt-8 flex flex-wrap gap-3">
            {roleCards.map((role) => (
              <motion.div
                key={role.name}
                whileHover={{ y: -2, scale: 1.03 }}
                className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.03] px-3 py-2 text-xs"
              >
                <span className="text-base">{role.icon}</span>
                <span className={`font-bold ${role.color}`}>{role.count}×</span>
                <span className="text-zinc-400">{role.name}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Form panel */}
        <motion.section
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="panel relative overflow-hidden p-6 sm:p-8"
        >
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-200/10 blur-3xl" />
          <div className="relative">
            <p className="eyebrow">Enter the woods</p>
            <h2 className="font-display mt-2 text-3xl text-zinc-50">
              Find your village
            </h2>

            {/* Mode tabs */}
            <div className="mt-6 grid grid-cols-2 rounded-xl bg-black/20 p-1">
              <button
                onClick={() => setMode("create")}
                className={`rounded-lg py-2.5 text-sm font-bold transition ${
                  mode === "create"
                    ? "bg-white/10 text-amber-100 shadow"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Create room
              </button>
              <button
                onClick={() => setMode("join")}
                className={`rounded-lg py-2.5 text-sm font-bold transition ${
                  mode === "join"
                    ? "bg-white/10 text-amber-100 shadow"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Join room
              </button>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field
                label="Your name"
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Raven"
                autoComplete="nickname"
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Field
                    label={
                      mode === "create" ? "Room code (optional)" : "Room code"
                    }
                    value={roomCode}
                    maxLength={6}
                    onChange={(e) =>
                      setRoomCode(e.target.value.toUpperCase())
                    }
                    placeholder={
                      mode === "create" ? "Generated for you" : "e.g. M0ON7"
                    }
                  />
                </motion.div>
              </AnimatePresence>
              <Button type="submit" loading={loading} className="mt-2 w-full">
                {mode === "create"
                  ? "Create the village"
                  : "Join the village"}{" "}
                <span>→</span>
              </Button>
            </form>

            <p className="mt-5 text-center text-xs leading-relaxed text-zinc-600">
              A room needs exactly seven players before the hunt can begin.
            </p>
          </div>
        </motion.section>
      </section>
    </main>
  );
}
