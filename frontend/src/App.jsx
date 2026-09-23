import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Home from "./pages/Home";
import WaitingRoom from "./pages/WaitingRoom";
import Game from "./pages/Game";
import { useGameSocket } from "./hooks/useGameSocket";
import { useGameStore } from "./store/gameStore";
import { socket } from "./services/socket";

function Room() {
  const navigate = useNavigate();
  const { roomCode, phase, leave } = useGameStore();
  useGameSocket();
  if (!roomCode) return <Navigate to="/" replace />;
  const exit = () => {
    socket.emit("leaveRoom", {
      roomCode,
      playerName: useGameStore.getState().playerName,
    });
    socket.disconnect();
    leave();
    navigate("/");
  };
  return phase === "waiting" ? <WaitingRoom onLeave={exit} /> : <Game />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomCode" element={<Room />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster
        position="top-right"
        toastOptions={{
          className:
            "!bg-zinc-900/95 !text-zinc-100 !border !border-white/10 !backdrop-blur-sm !shadow-xl !rounded-xl !text-sm",
          duration: 3500,
          success: {
            className:
              "!bg-emerald-950/90 !text-emerald-100 !border !border-emerald-500/15 !backdrop-blur-sm !shadow-xl !rounded-xl !text-sm",
            iconTheme: { primary: "#34d399", secondary: "#064e3b" },
          },
          error: {
            className:
              "!bg-rose-950/90 !text-rose-100 !border !border-rose-500/15 !backdrop-blur-sm !shadow-xl !rounded-xl !text-sm",
            iconTheme: { primary: "#f87171", secondary: "#4c0519" },
          },
        }}
      />
    </>
  );
}
