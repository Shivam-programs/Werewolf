import { motion } from "framer-motion";
import { useGameStore } from "../../store/gameStore";

export function PlayerList({ waiting = false }) {
  const { players, playerName, host, phase, ownRole, werewolfTeammates, revealedRoles } = useGameStore();

  // FIX B12: During a game, show ALL players (including disconnected ones)
  // with a visual indicator. In the waiting room, hide disconnected players
  // who have been removed from the room.
  const isInGame = phase !== "waiting" && phase !== "ended";
  const visiblePlayers = isInGame
    ? players
    : players.filter((player) => player.connected !== false && !player.afk);

  const alivePlayers = visiblePlayers.filter((p) => p.alive !== false);

  return (
    <section className="panel flex min-h-0 flex-col p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow">The village</p>
          <h2 className="font-display text-xl text-zinc-50">
            Players <span className="text-zinc-500">{visiblePlayers.length}/7</span>
          </h2>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
          {alivePlayers.length} alive
        </span>
      </div>
      <div className="space-y-2 overflow-auto pr-1">
        {visiblePlayers.map((player, index) => {
          const revealedRole = revealedRoles[player.name];
          const teammateRole =
            ownRole === "Werewolf" && werewolfTeammates.includes(player.name)
              ? "Werewolf"
              : null;
          // Dead players' roles are supplied by the server and remain visible
          // to every player for the rest of the round.
          const visibleRole = player.alive === false
            ? player.role
            : revealedRole || teammateRole;

          const isDisconnected = player.afk || player.connected === false;
          const isDead = player.alive === false;

          return (
            <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            key={player.name}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isDead ? "border-rose-500/15 bg-rose-950/15 opacity-55" : isDisconnected ? "border-yellow-500/15 bg-yellow-950/10 opacity-65" : "border-white/7 bg-white/[.025]"} ${player.name === playerName ? "ring-1 ring-amber-300/40" : ""}`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-black ${isDead ? "bg-rose-500/15 text-rose-300" : isDisconnected ? "bg-yellow-500/15 text-yellow-300" : "bg-zinc-800 text-amber-200"}`}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-200">
                {player.name}{" "}
                {player.name === playerName && (
                  <span className="text-xs text-amber-200">(you)</span>
                )}
                {visibleRole && (
                  <span className="ml-1.5 text-xs text-rose-200">
                    ({visibleRole})
                  </span>
                )}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                {isDead
                  ? "Fallen"
                  : isDisconnected
                    ? "Disconnected"
                    : "Alive"}
              </p>
            </div>
            {waiting && player.name === host && (
              <span title="Host" className="text-amber-200">
                ♛
              </span>
            )}
            {isDisconnected && !isDead && (
              <span title="Disconnected" className="text-xs text-yellow-300">⚡</span>
            )}
            </motion.div>
          );
        })}
        {/* FIX B13: Fixed CSS typo - was "h-14.5items-center" */}
        {Array.from({ length: Math.max(0, 7 - visiblePlayers.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex h-14 items-center gap-3 rounded-xl border border-dashed border-white/7 px-3 text-sm text-zinc-600"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.025]">
              ?
            </span>{" "}
            Awaiting hunter...
          </div>
        ))}
      </div>
    </section>
  );
}
