import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const lore = {
  Werewolf: {
    icon: "🐺",
    title: "Werewolf",
    heading: "You are a Werewolf",
    text: "Choose a victim with your pack each night. Keep your hunger concealed during the day.",
    objective: "Eliminate all villagers without being discovered.",
    tone: "from-rose-950 via-red-950/80 to-zinc-950",
    border: "border-rose-500/20",
    glow: "shadow-[0_0_80px_rgba(225,29,72,0.15)]",
    iconBg: "bg-rose-500/15",
  },
  Knight: {
    icon: "🛡️",
    title: "Knight",
    heading: "You are the Knight",
    text: "Each night, choose one villager to shield from the wolves' attack.",
    objective: "Protect the innocent and outlast the darkness.",
    tone: "from-sky-950 via-blue-950/80 to-zinc-950",
    border: "border-sky-500/20",
    glow: "shadow-[0_0_80px_rgba(14,165,233,0.15)]",
    iconBg: "bg-sky-500/15",
  },
  Seer: {
    icon: "🔮",
    title: "Seer",
    heading: "You are the Seer",
    text: "Each night, peer beyond the veil and discover one player's true identity.",
    objective: "Guide the village with your hidden knowledge.",
    tone: "from-violet-950 via-purple-950/80 to-zinc-950",
    border: "border-violet-500/20",
    glow: "shadow-[0_0_80px_rgba(139,92,246,0.15)]",
    iconBg: "bg-violet-500/15",
  },
  Villager: {
    icon: "🏘️",
    title: "Villager",
    heading: "You are a Villager",
    text: "Watch closely, discuss wisely, and find the wolves hiding among you.",
    objective: "Vote to eliminate the Werewolves before they take over.",
    tone: "from-amber-950 via-yellow-950/80 to-zinc-950",
    border: "border-amber-500/20",
    glow: "shadow-[0_0_80px_rgba(245,158,11,0.15)]",
    iconBg: "bg-amber-500/15",
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18, delayChildren: 0.3 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function RoleReveal({ role, Teammates }) {
  const info = lore[role] || lore.Villager;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {open && role && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-5 backdrop-blur-lg"
        >
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, scale: 0.95 }}
            className={`w-full max-w-md overflow-hidden rounded-3xl border ${info.border} bg-gradient-to-br ${info.tone} ${info.glow} p-8 text-center sm:p-10`}
          >
            {/* Icon */}
            <motion.div
              variants={fadeUp}
              className={`mx-auto mb-5 grid h-24 w-24 place-items-center rounded-2xl ${info.iconBg} text-5xl`}
            >
              <motion.span
                animate={{ rotate: [0, 6, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {info.icon}
              </motion.span>
            </motion.div>

            {/* Eyebrow */}
            <motion.p variants={fadeUp} className="eyebrow">
              The veil has lifted
            </motion.p>

            {/* Title */}
            <motion.h2
              variants={fadeUp}
              className="font-display mt-2 text-4xl text-zinc-50 sm:text-5xl"
            >
              {info.heading}
            </motion.h2>

            {/* Description */}
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-zinc-300"
            >
              {info.text}
            </motion.p>

            {/* Objective */}
            <motion.div
              variants={fadeUp}
              className="mx-auto mt-5 max-w-xs rounded-xl border border-white/8 bg-black/20 px-4 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">
                Your objective
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-200">
                {info.objective}
              </p>
            </motion.div>

            {/* Teammates (Werewolf only) */}
            {Teammates && Teammates.length > 0 && (
              <motion.div
                variants={fadeUp}
                className="mx-auto mt-4 max-w-xs rounded-xl border border-rose-500/10 bg-rose-950/20 px-4 py-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-rose-300/60">
                  Your pack
                </p>
                <p className="mt-1 text-sm font-medium text-rose-100">
                  {Teammates.join(", ")}
                </p>
              </motion.div>
            )}

            {/* Button */}
            <motion.button
              variants={fadeUp}
              onClick={() => setOpen(false)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="mt-7 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-bold text-zinc-100 transition hover:bg-white/15"
            >
              I understand
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
