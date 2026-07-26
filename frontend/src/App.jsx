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
  const exit = () => { socket.disconnect(); leave(); navigate("/"); };
  return phase === "waiting" ? <WaitingRoom onLeave={exit} /> : <Game />;
}

export default function App() {
  return <><Routes><Route path="/" element={<Home />} /><Route path="/room/:roomCode" element={<Room />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes><Toaster position="top-right" toastOptions={{ className: "!bg-zinc-900 !text-zinc-100 !border !border-white/10", duration: 3500 }} /></>;
}
