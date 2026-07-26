// Use the deployed site's origin by default; localhost is only appropriate when
// VITE_API_URL is explicitly provided for local split-server development.
const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "The server could not complete that request.");
  return body;
}

export const api = {
  health: () => request("/api/health"),
  createGame: (roomCode, playerName) => request("/api/games/createGame", {
    method: "POST", body: JSON.stringify({ roomCode, playerName }),
  }),
  joinGame: (roomCode, playerName) => request(`/api/games/joinGame/${encodeURIComponent(roomCode)}`, {
    method: "POST", body: JSON.stringify({ playerName }),
  }),
  getPlayers: (roomCode) => request(`/api/messages/players/${encodeURIComponent(roomCode)}`),
};
