import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../ui/Button";

export function GameOver({ result, onPlayAgain, joiningNextRound, onHome }) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 grid place-items-center bg-black/75 p-5 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="panel w-full max-w-xl p-7 text-center sm:p-10"
          >
            <p className="eyebrow">The final bell</p>
            <h2 className="font-display mt-2 text-4xl text-zinc-50 sm:text-5xl">
              {result.winner} win
            </h2>
            <p className="mt-3 text-zinc-400">
              The village has learned the truth.
            </p>
            <div className="my-7 grid grid-cols-2 gap-2 text-left sm:grid-cols-3">
              {result.players?.map((player) => (
                <div
                  key={player.name}
                  className="rounded-xl border border-white/8 bg-white/3 p-3"
                >
                  <p className="truncate text-sm font-bold text-zinc-200">
                    {player.name}
                  </p>
                  <p className="mt-1 text-xs text-amber-200">{player.role}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={onPlayAgain} loading={joiningNextRound} disabled={joiningNextRound}>
                {joiningNextRound ? "Joining next round" : "Play again"}
              </Button>
              <Button variant="ghost" onClick={onHome}>
                Return home
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
