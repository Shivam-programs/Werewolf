# Werewolf

Werewolf is a browser-based social-deduction game for exactly seven players. One player creates a room, shares its code, and starts a live round once the room is full. Players receive secret roles, act through timed night and day phases, discuss in chat, and vote until either the villagers or werewolves win.

## Features

- Create or join a room with a six-character code.
- A host-controlled lobby that starts when seven connected players are present.
- Random role assignment: two Werewolves, one Knight, one Seer, and three Villagers.
- Timed night, discussion, and voting phases.
- Role-specific night actions: werewolf target selection, Knight protection, and Seer inspection.
- Public village chat and a private chat for living Werewolves.
- Live room, player, phase, and game-result updates through Socket.IO.
- Reconnection support with a 20-second grace period and host transfer when needed.
- Play-again queue after a round ends, plus in-game sound controls.

## Tech Stack

- **Frontend:** React 19, Vite, React Router, Zustand, Tailwind CSS, Framer Motion, React Hot Toast
- **Backend:** Node.js, Express 5, Socket.IO
- **Database:** None — rooms, players, messages, and game state are stored in memory on the server.
- **Authentication:** None — players identify themselves with a display name and a session-scoped player ID.
- **APIs / Services:** REST endpoints for room creation, joining, and room data; Socket.IO for real-time game events.
- **Deployment / Tools:** Docker, ESLint, Morgan, CORS, dotenv, Cron

## Project Structure

```text
.
├── frontend/
│   ├── public/              # Logo and game audio files
│   └── src/
│       ├── pages/           # Home, waiting-room, and game screens
│       ├── components/      # Chat, player list, actions, and UI elements
│       ├── hooks/           # Socket lifecycle and sound playback
│       ├── services/        # HTTP and Socket.IO clients
│       └── store/           # Zustand game/session state
├── backend/
│   └── src/
│       ├── controllers/     # HTTP request handlers
│       ├── routes/          # Express API routes
│       ├── services/        # Room, game-phase, voting, and chat logic
│       ├── models/          # In-memory rooms and role definitions
│       └── lib/             # Socket.IO setup and production health-check job
└── Dockerfile               # Builds the frontend and serves it from Express
```

## How It Works

```text
Player browser
  → React app
  → REST API creates or joins a room
  → Socket.IO registers the player and streams game events
  → Express game service manages the in-memory room state
```

The frontend creates or joins a room through the REST API, then keeps a Socket.IO connection open for the rest of the session. The server assigns roles and runs the game clock: each night lasts 60 seconds, the day discussion lasts 60 seconds, and voting lasts 30 seconds. Actions can also resolve a phase early when every required living player has submitted one.

The server decides the winner when all Werewolves are eliminated or when the number of living Werewolves is at least the number of other living players. Because rooms live in process memory, restarting the server clears all active rooms and game history.

## Getting Started

### Prerequisites

- Node.js 22 or later (the Docker image uses Node 22)
- npm

### 1. Clone the repository

```bash
git clone <repository-url>
cd Werewolf
```

### 2. Install dependencies

```bash
cd backend
npm ci

cd ../frontend
npm ci
```

### 3. Configure local environment variables

Create `backend/.env` and `frontend/.env` using the examples in [Environment Variables](#environment-variables).

### 4. Start the backend

From the `backend` directory:

```bash
npm run dev
```

The API and Socket.IO server run on `http://localhost:5000` by default.

### 5. Start the frontend

In a second terminal, from the `frontend` directory:

```bash
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Create a room, invite six other players with the room code, and have the host start the game.

### Docker

The included Dockerfile builds the Vite app and serves it from the Express server as one container:

```bash
docker build -t werewolf .
docker run --rm -p 5000:5000 werewolf
```

Then open `http://localhost:5000`. No `VITE_API_URL` is needed in this setup because the client and server share the same origin.

## Environment Variables

The project does not require secrets. These variables configure URLs and ports:

`backend/.env`

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
NODE_ENV=development
```

`frontend/.env`

```env
VITE_API_URL=http://localhost:5000
```

`FRONTEND_URL` allows the local Vite origin in the server's CORS configuration. `VITE_API_URL` is needed when the frontend and backend run separately; otherwise the frontend falls back to its own origin. `BACKEND_URL` is used only by the production health-check cron job, and `NODE_ENV=production` enables that job.

## API Routes

These are the HTTP routes exposed by the Express server. Game actions, chat messages, phase changes, and room updates use Socket.IO events after a player has registered with a room.

| Method | Route | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Basic API health response. | None |
| `POST` | `/api/games/createGame` | Creates a room with `roomCode` and `playerName`. | None |
| `POST` | `/api/games/joinGame/:roomCode` | Adds a named player to a waiting room. | None |
| `GET` | `/api/messages/players/:roomCode` | Returns the room's public player list. | None |
| `GET` | `/api/messages/messages/:roomCode` | Returns the room's public message history. | None |

## Future Improvements

- Move active rooms to a shared persistent store so games can survive server restarts and scale beyond one server instance.
- Add automated tests for game rules, timers, and Socket.IO events.
- Add stronger server-side validation and rate limiting around player names, room codes, and chat messages.
- Add a small rules screen so new players can understand each role before joining a room.

## Project Notes

This project is a practical example of coordinating a real-time multiplayer flow: keeping each player's role private, synchronizing timed phases, handling reconnects, and keeping the browser state in step with server events.

## Author

Project author: **[Add your name]**
