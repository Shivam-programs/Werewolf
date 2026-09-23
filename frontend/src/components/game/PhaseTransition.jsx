import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const phases = {
  night: {
    icon: "☾",
    title: "NIGHT HAS FALLEN",
    subtitle: "The wolves are listening.",
    bg: "from-indigo-950/95 via-zinc-950/90 to-purple-950/95",
    glow: "text-indigo-200",
  },
  day: {
    icon: "☼",
    title: "A NEW DAY BEGINS",
    subtitle: "The village gathers to speak.",
    bg: "from-amber-950/90 via-zinc-950/85 to-orange-950/90",
    glow: "text-amber-200",
  },
  voting: {
    icon: "⚖",
    title: "THE VOTE BEGINS",
    subtitle: "Decide who to cast out.",
    bg: "from-rose-950/90 via-zinc-950/85 to-red-950/90",
    glow: "text-rose-200",
  },
};

export function PhaseTransition({ phase, suspended = false }) {
  const [dismissedPhase, setDismissedPhase] = useState(null);

  useEffect(() => {
    if (!phases[phase]) return undefined;
    // Wait for a major game event to clear before announcing the new phase so
    // the two centre-screen overlays are shown one after another, never at once.
    if (suspended) return undefined;
    const timer = window.setTimeout(() => setDismissedPhase(phase), 1800);
    return () => window.clearTimeout(timer);
  }, [phase, suspended]);

  const info = phases[phase];
  if (!info) return null;

  return (
    <AnimatePresence>
      {dismissedPhase !== phase && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className={`phase-overlay bg-gradient-to-br ${info.bg} backdrop-blur-md`}
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 15 }}
              className="phase-overlay__icon"
            >
              <span className={info.glow}>{info.icon}</span>
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="phase-overlay__title"
            >
              {info.title}
            </motion.h1>
            <motion.p
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.3 }}
              className="phase-overlay__subtitle"
            >
              {info.subtitle}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
