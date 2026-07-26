import { useState } from "react";
import toast from "react-hot-toast";
import { useGameStore } from "../../store/gameStore";
import { socket } from "../../services/socket";
import { Button } from "../ui/Button";

const copy = { Werewolf: ["Choose a victim", "werewolfVote", "Mark victim"], Knight: ["Choose someone to protect", "knightProtect", "Grant protection"], Seer: ["Choose a player to inspect", "seerPeek", "Reveal role"] };

export function ActionPanel() {
  const { roomCode, playerName, players, phase, ownRole, actionSubmitted, voteSubmitted, markActionSubmitted, markVoteSubmitted } = useGameStore();
  const [selected, setSelected] = useState("");
  const aliveOthers = players.filter((p) => p.alive !== false && p.name !== playerName);
  const castVote = () => { if (!selected) return toast.error("Choose a player first."); socket.emit("publicVote", { roomCode, target: selected }); markVoteSubmitted(); toast.success(`Your vote for ${selected} is sealed.`); };
  if (phase === "day") return <div className="action-copy"><span className="action-icon">☼</span><div><p className="font-semibold text-zinc-100">The village is awake.</p><p>Discuss what you saw. The vote begins when the sun sets.</p></div></div>;
  if (phase !== "night" && phase !== "voting") return <div className="action-copy"><span className="action-icon">◌</span><div><p className="font-semibold text-zinc-100">The village holds its breath.</p><p>Waiting for the next phase.</p></div></div>;
  if (phase === "night" && !copy[ownRole]) return <div className="action-copy"><span className="action-icon">☾</span><div><p className="font-semibold text-zinc-100">Night has fallen.</p><p>Keep still. Your only task is to survive until dawn.</p></div></div>;
  const [heading, event, label] = phase === "voting" ? ["Cast your vote", "publicVote", "Submit vote"] : copy[ownRole];
  const submitted = phase === "voting" ? voteSubmitted : actionSubmitted;
  const submit = () => {
    if (!selected) return toast.error("Choose a player first.");
    if (phase === "voting") return castVote();
    if (event === "seerPeek") { socket.emit(event, { roomCode, target: selected }); markActionSubmitted(); return; }
    socket.emit(event, { roomCode, target: selected }, (result) => {
      if (result?.success) { markActionSubmitted(); toast.success(result.message); } else toast.error(result?.message || "Your action could not be saved.");
    });
  };
  return <section className="panel p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">{phase === "voting" ? "Judgement" : ownRole}</p><h2 className="font-display text-2xl text-zinc-50">{heading}</h2></div>{submitted && <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">Submitted</span>}</div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{aliveOthers.map((player) => <button disabled={submitted} onClick={() => setSelected(player.name)} key={player.name} className={`rounded-xl border p-3 text-left text-sm transition ${selected === player.name ? "border-amber-300 bg-amber-300/10 text-amber-100" : "border-white/8 bg-white/2.5]text-zinc-300 hover:border-white/20"}`}><span className="mb-2 grid h-7 w-7 place-items-center rounded-md bg-black/20 text-xs font-bold">{player.name[0]}</span>{player.name}</button>)}</div>
    <Button disabled={submitted || !aliveOthers.length} onClick={submit} className="mt-4 w-full">{submitted ? "Action locked" : label}</Button>
  </section>;
}
