export function Field({ label, error, className = "", ...props }) {
  return <label className={`block ${className}`}>
    {label && <span className="mb-2 block text-xs font-semibold uppercase tracking-[.18em] text-zinc-400">{label}</span>}
    <input className="h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-300/70 focus:ring-4 focus:ring-amber-300/10" {...props} />
    {error && <span className="mt-1.5 block text-xs text-rose-300">{error}</span>}
  </label>;
}
