import { useEffect } from "react";
import { socket } from "./services/socket";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";

export default function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );

}