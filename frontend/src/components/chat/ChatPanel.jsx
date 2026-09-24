import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../../store/gameStore";
import { socket } from "../../services/socket";

function SystemDivider({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 py-1"
    >
      <span className="h-px flex-1 bg-white/8" />
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
        <span>{message.icon || "✦"}</span>
        {message.message}
      </span>
      <span className="h-px flex-1 bg-white/8" />
    </motion.div>
  );
}

function MessageBubble({ message, isOwn, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={isOwn ? "flex flex-col items-end" : ""}
    >
      <p className={`mb-0.5 text-[11px] font-bold ${accent}`}>
        {message.sender}
      </p>
      <p
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isOwn
            ? "rounded-br-sm bg-amber-300/10 text-amber-100"
            : "rounded-tl-sm bg-white/[.045] text-zinc-300"
        }`}
      >
        {message.message}
      </p>
    </motion.div>
  );
}

function Feed({ messages, accent, playerName }) {
  const feedRef = useRef(null);
  const endRef = useRef(null);
  const [readMessageCount, setReadMessageCount] = useState(messages.length);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const showNew = !isNearBottom && messages.length > readMessageCount;

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setReadMessageCount(messages.length);
    setIsNearBottom(true);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={feedRef}
        className="chat-feed h-full space-y-3 overflow-y-auto overscroll-contain pr-1"
        aria-label="Chat messages"
        onScroll={() => {
          const el = feedRef.current;
          if (!el) return;
          const nearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          setIsNearBottom(nearBottom);
          if (nearBottom) setReadMessageCount(messages.length);
        }}
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
            <span className="text-2xl">💬</span>
            <p className="text-xs italic">No voices yet.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((message, index) =>
            message.system ? (
              <SystemDivider
                key={`sys-${message.timestamp}-${index}`}
                message={message}
              />
            ) : (
              <MessageBubble
                key={`${message.timestamp}-${index}`}
                message={message}
                isOwn={message.sender === playerName}
                accent={accent}
              />
            ),
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {}
      <AnimatePresence>
        {showNew && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            onClick={scrollToBottom}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-amber-300/90 px-3 py-1 text-[11px] font-bold text-zinc-950 shadow-lg"
          >
            ↓ New messages
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatPanel() {
  const { roomCode, playerName, ownRole, messages, werewolfMessages } =
    useGameStore();
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
    <section className="panel flex h-120 max-h-[calc(100vh-2rem)] flex-col p-4 sm:p-5 xl:sticky xl:top-4">
      {}
      <div className="mb-4 flex items-center gap-1 border-b border-white/7 pb-3">
        <button
          onClick={() => setTab("public")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            !privateActive
              ? "bg-amber-300/10 text-amber-200"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          💬 Village
        </button>
        {isWolf && (
          <button
            onClick={() => setTab("pack")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              privateActive
                ? "bg-rose-500/10 text-rose-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            🐺 Pack
          </button>
        )}
      </div>

      {}
      <Feed
        messages={privateActive ? werewolfMessages : messages}
        accent={privateActive ? "text-rose-300" : "text-amber-200"}
        playerName={playerName}
      />

      {}
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={
            privateActive ? "Whisper to the pack…" : "Speak to the village…"
          }
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 text-sm outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/10"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`grid h-10 w-10 place-items-center rounded-lg text-zinc-950 transition ${
            privateActive
              ? "bg-rose-400 hover:bg-rose-300"
              : "bg-amber-300 hover:bg-amber-200"
          }`}
          aria-label="Send message"
        >
          ↑
        </motion.button>
      </form>
    </section>
  );
}
