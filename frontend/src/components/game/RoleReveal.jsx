import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const lore = {
  Werewolf: {
    icon: "☾",
    title: "You are a Werewolf",
    text: "Choose a victim with your pack. Keep your hunger concealed.",
    tone: "from-rose-500/25 to-zinc-950",
  },
  Knight: {
    icon: "✦",
    title: "You are the Knight",
    text: "Choose one villager to shield from the night.",
    tone: "from-sky-500/20 to-zinc-950",
  },
  Seer: {
    icon: "◉",
    title: "You are the Seer",
    text: "Look beyond the veil and learn one player's role.",
    tone: "from-violet-500/25 to-zinc-950",
  },
  Villager: {
    icon: "✣",
    title: "You are a Villager",
    text: "Watch closely, discuss wisely, and find the wolves.",
    tone: "from-amber-500/20 to-zinc-950",
  },
};

export function RoleReveal({ role }) {
  const info = lore[role] || lore.Villager;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <AnimatePresence>
      {open && role && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.86, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className={`w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-linear-to-br ${info.tone} p-8 text-center shadow-2xl`}
          >
            <motion.div
              animate={{ rotate: [0, 7, -7, 0] }}
              transition={{ duration: 1.7, repeat: Infinity }}
              className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-white/10 text-4xl text-zinc-50"
            >
              {info.icon}
            </motion.div>
            <p className="eyebrow">The veil has lifted</p>
            <h2 className="font-display mt-2 text-4xl text-zinc-50">
              {info.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xs leading-relaxed text-zinc-300">
              {info.text}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-7 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-zinc-100 hover:bg-white/15"
            >
              I understand
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
