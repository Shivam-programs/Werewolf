import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_API_URL || window.location.origin;

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20_000,
});

export function ensureSocket() {
  if (!socket.connected) socket.connect();
  return socket;
}

export function subscribeSocket(events) {
  Object.entries(events).forEach(([event, handler]) =>
    socket.on(event, handler),
  );
  return () =>
    Object.entries(events).forEach(([event, handler]) =>
      socket.off(event, handler),
    );
}
