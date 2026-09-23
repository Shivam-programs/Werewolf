import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../ui/Button";

const roleIcons = {
  Werewolf: "🐺",
  Knight: "🛡️",
  Seer: "🔮",
  Villager: "🏘️",
};

const cardVariant = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.8 + i * 0.08, type: "spring", stiffness: 260, damping: 22 },
  }),
};

export function GameOver({ result, onPlayAgain, joiningNextRound, onHome }) {
  if (!result) return null;

  const isWolves = result.winner === "Werewolves";

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 grid place-items-center overflow-auto bg-black/80 p-5 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.92, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-2xl"
          >
            {/* Winner Banner */}
            <div
              className={`rounded-t-3xl border border-b-0 p-8 text-center sm:p-10 ${
                isWolves
                  ? "border-rose-500/15 bg-gradient-to-br from-rose-950/80 via-zinc-950/70 to-red-950/80"
                  : "border-amber-500/15 bg-gradient-to-br from-amber-950/80 via-zinc-950/70 to-yellow-950/80"
              }`}
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="mb-4 text-5xl"
              >
                {isWolves ? "🐺" : "☀️"}
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="eyebrow"
              >
                The final bell
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={`font-display mt-2 text-4xl sm:text-5xl ${
                  isWolves ? "text-rose-100" : "text-amber-100"
                }`}
              >
                {isWolves ? "The pack prevails" : "Dawn breaks triumphant"}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="mt-3 text-sm text-zinc-400"
              >
                {isWolves
                  ? "The wolves have consumed the village."
                  : "The village has rooted out the darkness."}
              </motion.p>
            </div>

            {/* Player Results */}
            <div className="rounded-b-3xl border border-white/8 bg-zinc-950/80 p-6 sm:p-8">
              <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">
                All roles revealed
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {result.players?.map((player, i) => {
                  const isWinner =
                    (isWolves && player.role === "Werewolf") ||
                    (!isWolves && player.role !== "Werewolf");
                  const isDead = player.alive === false;

                  return (
                    <motion.div
                      key={player.name}
                      custom={i}
                      variants={cardVariant}
                      initial="hidden"
                      animate="show"
                      className={`relative overflow-hidden rounded-xl border p-3 ${
                        isWinner
                          ? isWolves
                            ? "border-rose-500/20 bg-rose-950/20"
                            : "border-amber-500/20 bg-amber-950/20"
                          : "border-white/5 bg-white/[.02]"
                      }`}
                    >
                      {/* Winner indicator */}
                      {isWinner && (
                        <div
                          className={`absolute right-2 top-2 text-[10px] font-bold ${
                            isWolves ? "text-rose-400" : "text-amber-400"
                          }`}
                        >
                          ★
                        </div>
                      )}
                      <div className="mb-1.5 text-xl">
                        {roleIcons[player.role] || "🏘️"}
                      </div>
                      <p
                        className={`truncate text-sm font-bold ${
                          isDead ? "text-zinc-500 line-through" : "text-zinc-200"
                        }`}
                      >
                        {player.name}
                      </p>
                      <p
                        className={`mt-0.5 text-xs font-semibold ${
                          player.role === "Werewolf"
                            ? "text-rose-300"
                            : "text-amber-300/70"
                        }`}
                      >
                        {player.role}
                      </p>
                      {isDead && (
                        <p className="mt-1 text-[10px] text-zinc-600">
                          ☠ Fallen
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  onClick={onPlayAgain}
                  loading={joiningNextRound}
                  disabled={joiningNextRound}
                >
                  {joiningNextRound ? "Joining next round…" : "⟳ Play again"}
                </Button>
                <Button variant="ghost" onClick={onHome}>
                  Return home
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
