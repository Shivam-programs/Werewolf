import { useEffect } from "react";
import { socket } from "../services/socket";

export default function Home() {
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected:", socket.id);
    });

    return () => {
      socket.off("connect");
    };
  }, []);

  return <h1>Home</h1>;
}
