import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Shown once when the game transitions from waiting → first night.
 * Displays a brief atmospheric countdown before the role reveal appears.
 */
export function GameStartOverlay({ phase }) {
  const [show, setShow] = useState(false);
  const [count, setCount] = useState(3);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Only trigger on the first transition to night (game start)
    if (phase === "night" && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setShow(true);
      setCount(3);

      const t1 = window.setTimeout(() => setCount(2), 600);
      const t2 = window.setTimeout(() => setCount(1), 1200);
      const t3 = window.setTimeout(() => setShow(false), 1800);

      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
      };
    }
    return undefined;
  }, [phase]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-zinc-950/95 backdrop-blur-lg"
        >
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="eyebrow mb-4"
            >
              The hunt begins
            </motion.p>
            <motion.div
              key={count}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="font-display text-8xl text-amber-200"
            >
              {count}
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.3 }}
              className="mt-4 text-sm text-zinc-500"
            >
              Prepare yourself…
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
