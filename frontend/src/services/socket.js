import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// A single lazy connection is shared by the entire app. Components only add/remove listeners.
export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});

export function ensureSocket() {
  if (!socket.connected) socket.connect();
  return socket;
}

export function subscribeSocket(events) {
  Object.entries(events).forEach(([event, handler]) => socket.on(event, handler));
  return () => Object.entries(events).forEach(([event, handler]) => socket.off(event, handler));
}
