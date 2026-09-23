import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useGameStore } from "../../store/gameStore";

const avatarColors = [
  "bg-amber-500/20 text-amber-300",
  "bg-sky-500/20 text-sky-300",
  "bg-rose-500/20 text-rose-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-violet-500/20 text-violet-300",
  "bg-orange-500/20 text-orange-300",
  "bg-cyan-500/20 text-cyan-300",
];

function StatusDot({ alive, connected, afk }) {
  if (alive === false)
    return (
      <span className="status-dot bg-zinc-600" title="Eliminated">
        <span className="sr-only">Eliminated</span>
      </span>
    );
  if (afk || connected === false)
    return (
      <span className="status-dot status-dot--disconnected" title="Disconnected">
        <span className="sr-only">Disconnected</span>
      </span>
    );
  return (
    <span className="status-dot status-dot--connected" title="Connected">
      <span className="sr-only">Connected</span>
    </span>
  );
}

export function PlayerList({ waiting = false }) {
  const {
    players,
    playerName,
    host,
    phase,
    ownRole,
    werewolfTeammates,
    revealedRoles,
    highlightedPlayer,
    setHighlightedPlayer,
  } = useGameStore();

  const isInGame = phase !== "waiting" && phase !== "ended";
  // Roles are only ever public during an active game (fallen players) or on the
  // results screen — never while the village is gathering for a new round.
  const showRoles = phase !== "waiting";
  const visiblePlayers = isInGame
    ? players
    : players.filter((p) => p.connected !== false && !p.afk);
  const alivePlayers = visiblePlayers.filter((p) => p.alive !== false);

  // Fade the elimination emphasis shortly after the event has played.
  useEffect(() => {
    if (!highlightedPlayer) return undefined;
    const timer = window.setTimeout(() => setHighlightedPlayer(null), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightedPlayer, setHighlightedPlayer]);

  return (
    <section className="panel flex min-h-0 flex-col p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow">The village</p>
          <h2 className="font-display text-xl text-zinc-50">
            Players{" "}
            <span className="text-zinc-500">
              {visiblePlayers.length}/7
            </span>
          </h2>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
          {alivePlayers.length} alive
        </span>
      </div>

      {/* Player list */}
      <div className="thin-scroll space-y-2 overflow-auto pr-1">
        <AnimatePresence mode="popLayout">
          {visiblePlayers.map((player, index) => {
            const revealedRole = revealedRoles[player.name];
            const teammateRole =
              ownRole === "Werewolf" && werewolfTeammates.includes(player.name)
                ? "Werewolf"
                : null;
            const visibleRole = showRoles
              ? player.alive === false
                ? player.role
                : revealedRole || teammateRole
              : null;

            const isDisconnected = player.afk || player.connected === false;
            const isDead = player.alive === false;
            const isYou = player.name === playerName;
            const isHost = player.name === host;
            const isHighlighted = player.name === highlightedPlayer;
            const initial = player.name.charAt(0).toUpperCase();
            const color = avatarColors[index % avatarColors.length];

            return (
              <motion.div
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0, scale: isHighlighted ? [1, 1.045, 1] : 1 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: index * 0.03, type: "spring", stiffness: 300, damping: 25 }}
                key={player.name}
                className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300 ${
                  isDead
                    ? "border-rose-500/10 bg-rose-950/10 opacity-50"
                    : isDisconnected
                      ? "border-yellow-500/10 bg-yellow-950/5 opacity-60"
                      : "border-white/7 bg-white/[.025] hover:bg-white/[.04]"
                } ${isYou ? "border-l-2 border-l-amber-400/60" : ""} ${
                  isHighlighted ? "ring-2 ring-rose-400/70" : ""
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black ${
                      isDead ? "bg-zinc-800 text-zinc-500 line-through" : color
                    }`}
                  >
                    {isDead ? "✕" : initial}
                  </span>
                  {/* Status dot */}
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <StatusDot
                      alive={player.alive}
                      connected={player.connected}
                      afk={player.afk}
                    />
                  </span>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-200">
                    <span className="truncate">{player.name}</span>
                    {isYou && (
                      <span className="flex-shrink-0 text-[10px] font-bold text-amber-300/70">
                        YOU
                      </span>
                    )}
                    {visibleRole && (
                      <span
                        className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          visibleRole === "Werewolf"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {visibleRole}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                    {isDead
                      ? "☠ Fallen"
                      : isDisconnected
                        ? "⚡ Away"
                        : isHost && waiting
                          ? "👑 Host"
                          : "● In game"}
                  </p>
                </div>

                {/* Host crown (in game) */}
                {isHost && !waiting && (
                  <span
                    title="Host"
                    className="text-sm text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.4)]"
                  >
                    ♛
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 7 - visiblePlayers.length) }).map(
          (_, i) => (
            <div
              key={`empty-${i}`}
              className="flex h-[54px] items-center gap-3 rounded-xl border border-dashed border-white/7 px-3 text-sm text-zinc-600"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/[.02] text-zinc-700">
                ?
              </span>
              <span className="animate-pulse">Awaiting hunter…</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
