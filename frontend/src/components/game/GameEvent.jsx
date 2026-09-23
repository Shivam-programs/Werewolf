import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Center-screen dramatic overlay for major game events like eliminations.
 * Shows for ~2.5 seconds, then fades out.
 *
 * Usage:
 *   <GameEvent event={event} />
 *
 * event shape:
 *   { icon: string, title: string, subtitle?: string, accent?: string }
 */
export function GameEvent({ event }) {
  const [dismissedEvent, setDismissedEvent] = useState(null);

  useEffect(() => {
    if (!event) return undefined;
    const timer = window.setTimeout(() => setDismissedEvent(event), 2500);
    return () => window.clearTimeout(timer);
  }, [event]);

  return (
    <AnimatePresence>
      {event && dismissedEvent !== event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-none fixed inset-0 z-[45] grid place-items-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: -10 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 250 }}
              className="mb-3 text-5xl"
            >
              {event.icon}
            </motion.div>
            <h2
              className={`font-display text-3xl sm:text-4xl ${
                event.accent || "text-zinc-50"
              }`}
            >
              {event.title}
            </h2>
            {event.subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mx-auto mt-2 max-w-sm text-sm text-zinc-400"
              >
                {event.subtitle}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
