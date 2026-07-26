import { useEffect, useState } from "react";

export function Countdown({ endsAt }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Number(endsAt || 0) - Date.now()),
  );
  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, Number(endsAt || 0) - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return (
    <span className="font-mono text-sm font-bold tabular-nums text-amber-200">
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
