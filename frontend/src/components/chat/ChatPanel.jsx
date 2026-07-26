import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { socket } from "../../services/socket";

function Feed({ messages, accent }) {
  const endRef = useRef(null);
  useEffect(
    () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
    [messages],
  );
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      {messages.length === 0 && (
        <p className="mt-7 text-center text-xs italic text-zinc-600">
          No voices yet.
        </p>
      )}
      {messages.map((message, index) => (
        <div key={`${message.timestamp}-${index}`}>
          <p className={`mb-1 text-xs font-bold ${accent}`}>{message.sender}</p>
          <p className="rounded-xl rounded-tl-sm bg-white/.045 px-3 py-2 text-sm leading-relaxed text-zinc-300">
            {message.message}
          </p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

export function ChatPanel() {
  const { roomCode, ownRole, messages, werewolfMessages } = useGameStore();
  const [text, setText] = useState("");
  const [tab, setTab] = useState("public");
  const isWolf = ownRole === "Werewolf";
  const privateActive = tab === "pack" && isWolf;
  const send = (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    socket.emit(privateActive ? "sendWerewolfMessage" : "sendPublicMessage", {
      roomCode,
      message,
    });
    setText("");
  };
  return (
    <section className="panel flex min-h-85 flex-col p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-white/[.07] pb-3">
        <button
          onClick={() => setTab("public")}
          className={`text-sm font-semibold ${!privateActive ? "text-amber-200" : "text-zinc-500"}`}
        >
          Village
        </button>
        {isWolf && (
          <button
            onClick={() => setTab("pack")}
            className={`ml-3 text-sm font-semibold ${privateActive ? "text-rose-200" : "text-zinc-500"}`}
          >
            Pack
          </button>
        )}
      </div>
      <Feed
        messages={privateActive ? werewolfMessages : messages}
        accent={privateActive ? "text-rose-200" : "text-amber-200"}
      />
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={
            privateActive ? "Whisper to the pack..." : "Speak to the village..."
          }
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 text-sm outline-none focus:border-amber-300/50"
        />
        <button
          className="grid h-10 w-10 place-items-center rounded-lg bg-amber-300 text-zinc-950 transition hover:bg-amber-200"
          aria-label="Send message"
        >
          ↑
        </button>
      </form>
    </section>
  );
}
