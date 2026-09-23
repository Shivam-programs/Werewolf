import { useEffect, useState } from "react";

const CIRCUMFERENCE = 2 * Math.PI * 30; // r=30

export function Countdown({ endsAt, totalDuration }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Number(endsAt || 0) - Date.now()),
  );

  useEffect(() => {
    if (!endsAt) return undefined;
    const update = () =>
      setRemaining(Math.max(0, Number(endsAt) - Date.now()));
    update();
    const timer = window.setInterval(update, 250); // smoother ring
    return () => window.clearInterval(timer);
  }, [endsAt]);

  if (!endsAt) return null;

  const totalMs = totalDuration || 60_000;
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const fraction = Math.min(remaining / totalMs, 1);
  const offset = CIRCUMFERENCE * (1 - fraction);

  // Urgency tier
  const urgency =
    seconds > 30
      ? "calm"
      : seconds > 10
        ? "attention"
        : seconds > 5
          ? "urgent"
          : "critical";

  return (
    <div
      className={`countdown-ring countdown--${urgency}`}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <svg viewBox="0 0 64 64">
        <circle className="countdown-ring__track" cx="32" cy="32" r="30" />
        <circle
          className="countdown-ring__progress"
          cx="32"
          cy="32"
          r="30"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="countdown-ring__text">
        <span
          className={`font-mono font-black tabular-nums leading-none ${
            urgency === "critical"
              ? "text-lg text-red-400"
              : urgency === "urgent"
                ? "text-lg text-red-400"
                : "text-base text-amber-200"
          }`}
        >
          {minutes}:{String(secs).padStart(2, "0")}
        </span>
        {seconds <= 10 && (
          <span className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
            sec
          </span>
        )}
      </div>
    </div>
  );
}
