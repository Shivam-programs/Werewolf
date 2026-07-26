import { io } from "socket.io-client";

// In the Docker deployment the Vite app is served by this same Express server.
// An explicit VITE_API_URL remains available for separate frontend/backend deployments.
const SERVER_URL = import.meta.env.VITE_API_URL || window.location.origin;

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
