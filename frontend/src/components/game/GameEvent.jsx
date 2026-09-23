import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { useGameStore } from "../../store/gameStore";
import { PRIORITY_RANK } from "../../lib/gameEvents";

/**
 * Visual identity per event tone. Each major event family gets its own colour
 * language so the player understands what happened before reading a word.
 */
const TONES = {
  danger: {
    panel: "border-rose-500/30 bg-gradient-to-br from-rose-950/95 via-zinc-950/92 to-red-950/95",
    glow: "shadow-[0_0_90px_-10px_rgba(244,63,94,0.6)]",
    iconWrap: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30",
    title: "text-rose-200/80",
    name: "text-rose-50",
    bar: "bg-rose-400",
  },
  amber: {
    panel: "border-amber-500/30 bg-gradient-to-br from-amber-950/95 via-zinc-950/92 to-yellow-950/95",
    glow: "shadow-[0_0_90px_-10px_rgba(245,158,11,0.55)]",
    iconWrap: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30",
    title: "text-amber-200/80",
    name: "text-amber-50",
    bar: "bg-amber-400",
  },
  sky: {
    panel: "border-sky-500/30 bg-gradient-to-br from-sky-950/95 via-zinc-950/92 to-blue-950/95",
    glow: "shadow-[0_0_90px_-10px_rgba(14,165,233,0.55)]",
    iconWrap: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30",
    title: "text-sky-200/80",
    name: "text-sky-50",
    bar: "bg-sky-400",
  },
  violet: {
    panel: "border-violet-500/30 bg-gradient-to-br from-violet-950/95 via-zinc-950/92 to-purple-950/95",
    glow: "shadow-[0_0_90px_-10px_rgba(139,92,246,0.55)]",
    iconWrap: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30",
    title: "text-violet-200/80",
    name: "text-violet-50",
    bar: "bg-violet-400",
  },
};

// How long each priority lingers. Deliberately brief so play is never blocked.
const DURATION = { medium: 3400, high: 3600, critical: 4400 };

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};
const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
};

/**
 * Queue-driven notification centre for major game events.
 *
 * Only one event is ever visible: the highest-priority entry in the store
 * queue. Lower-priority events wait their turn, so an elimination and a phase
 * change can never overlap. Normal notifications stay on react-hot-toast.
 */
export function GameEventOverlay() {
  const eventQueue = useGameStore((s) => s.eventQueue);
  const dismissEvent = useGameStore((s) => s.dismissEvent);

  const active = useMemo(() => {
    if (!eventQueue.length) return null;
    return eventQueue.reduce((best, event) =>
      (PRIORITY_RANK[event.priority] || 0) > (PRIORITY_RANK[best.priority] || 0)
        ? event
        : best,
    );
  }, [eventQueue]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(
      () => dismissEvent(active.id),
      DURATION[active.priority] || 3200,
    );
    return () => window.clearTimeout(timer);
  }, [active, dismissEvent]);

  const isMajor = active?.priority === "high" || active?.priority === "critical";
  const tone = TONES[active?.tone] || TONES.amber;

  return (
    <AnimatePresence mode="wait">
      {/* ---------- MEDIUM: prominent top banner ---------- */}
      {active && !isMajor && (
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="pointer-events-none fixed inset-x-0 top-14 z-[65] mx-auto flex w-full max-w-md justify-center px-4"
        >
          <div
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md ${tone.panel} ${tone.glow}`}
          >
            <span
              className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-xl ${tone.iconWrap}`}
            >
              {active.icon}
            </span>
            <div className="min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-[.22em] ${tone.title}`}>
                {active.title}
              </p>
              {active.player && (
                <p className={`truncate text-base font-bold ${tone.name}`}>
                  {active.player}
                </p>
              )}
              {active.message && (
                <p className="truncate text-xs text-zinc-400">{active.message}</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ---------- HIGH / CRITICAL: centre-screen event ---------- */}
      {active && isMajor && (
        <motion.div
          key={active.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="pointer-events-none fixed inset-0 z-[70] grid place-items-center px-4 py-10"
        >
          {/* Subtle dimming backdrop */}
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" />

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
            className="relative w-full max-w-lg text-center"
          >
            {/* Icon */}
            <motion.div
              variants={rise}
              className={`mx-auto grid h-20 w-20 place-items-center rounded-2xl text-5xl sm:h-24 sm:w-24 sm:text-6xl ${tone.iconWrap}`}
            >
              <span>{active.icon}</span>
            </motion.div>

            {/* Title */}
            <motion.p
              variants={rise}
              className={`mt-5 text-xs font-black uppercase tracking-[.34em] sm:text-sm ${tone.title}`}
            >
              {active.title}
            </motion.p>

            {/* Player name — deliberately the loudest element */}
            {active.player && (
              <motion.h2
                variants={rise}
                className={`font-display mt-2 break-words text-4xl leading-tight sm:text-6xl ${tone.name}`}
              >
                {active.player}
              </motion.h2>
            )}

            {/* Accent bar */}
            <motion.span
              variants={rise}
              className={`mx-auto mt-4 block h-1 w-16 rounded-full ${tone.bar}`}
            />

            {/* Supporting message */}
            {active.message && (
              <motion.p
                variants={rise}
                className="mx-auto mt-4 max-w-xs text-sm text-zinc-300 sm:text-base"
              >
                {active.message}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
