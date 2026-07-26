import toast from "react-hot-toast";
import { useGameStore } from "../../store/gameStore";
import { socket } from "../../services/socket";
import { PlayerList } from "../../components/players/PlayerList";
import { Button } from "../../components/ui/Button";

export default function WaitingRoom({ onLeave }) {
  const { roomCode, players, playerName, host } = useGameStore();
  const isHost = host === playerName;
  const ready = players.length === 7;
  const copy = async () => {
    await navigator.clipboard?.writeText(roomCode);
    toast.success("Room code copied.");
  };
  const share = async () => {
    const text = `Join my Werewolf game in Howl & Hollow. Room code: ${roomCode}`;
    if (navigator.share)
      await navigator.share({ title: "Howl & Hollow", text });
    else {
      await navigator.clipboard?.writeText(text);
      toast.success("Invite copied.");
    }
  };
  const start = () => socket.emit("startGame", { roomCode });
  return (
    <main className="game-shell">
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <header className="mb-8 flex items-center justify-between">
          <a href="/" className="font-display text-2xl text-zinc-100">
            WARE <span className="text-amber-200">WOLF</span>
          </a>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
            Waiting room
          </span>
        </header>
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <PlayerList waiting />
          <section className="panel flex min-h-120 flex-col justify-center p-6 text-center sm:p-10">
            <p className="eyebrow">Your invitation</p>
            <p className="mt-4 font-mono text-4xl font-black tracking-[.22em] text-amber-200 sm:text-5xl">
              {roomCode}
            </p>
            <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-zinc-400">
              Share this code with the people you trust least. The game begins
              when all seven seats are taken.
            </p>
            <div className="mx-auto mt-6 flex w-full max-w-sm gap-3">
              <Button variant="ghost" onClick={copy} className="flex-1">
                Copy code
              </Button>
              <Button variant="ghost" onClick={share} className="flex-1">
                Share
              </Button>
            </div>
            <div className="mt-10 rounded-2xl border border-white/8 bg-black/20 p-5">
              <p className="text-sm font-semibold text-zinc-200">
                {isHost
                  ? ready
                    ? "The village is complete."
                    : `Waiting for ${7 - players.length} more player${7 - players.length === 1 ? "" : "s"}.`
                  : "Waiting for the host to begin..."}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {isHost
                  ? "Only you can begin the hunt."
                  : "The host will call the first night."}
              </p>
              {isHost && (
                <Button
                  onClick={start}
                  disabled={!ready}
                  className="mt-5 w-full"
                >
                  {ready ? "Begin the hunt" : "Village incomplete"}
                </Button>
              )}
            </div>
            <button
              onClick={onLeave}
              className="mt-6 text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-rose-200"
            >
              Leave room
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
