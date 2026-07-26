import { motion } from "framer-motion";

const styles = {
  primary: "bg-amber-300 text-zinc-950 shadow-[0_0_28px_rgba(252,211,77,.22)] hover:bg-amber-200",
  ghost: "border border-white/10 bg-white/[.03] text-zinc-100 hover:border-amber-200/40 hover:bg-white/[.07]",
  danger: "border border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20",
};

export function Button({ children, variant = "primary", className = "", loading, disabled, ...props }) {
  return <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} disabled={disabled || loading}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>
    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
    {children}
  </motion.button>;
}
