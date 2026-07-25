# Monolith: Vite frontend + Express + Socket.IO backend

# ---------- Stage 1: Build Frontend ----------
FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --no-audit --no-fund

COPY frontend/ ./

# Browser will connect to same origin
ENV VITE_API_URL=

RUN npm run build


# ---------- Stage 2: Build Backend ----------
FROM node:22-bookworm-slim AS backend-build

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm install --no-audit --no-fund

COPY backend/ ./

RUN npm run build


# ---------- Stage 3: Production ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY backend/package.json backend/package-lock.json ./

RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Backend
COPY --from=backend-build /app/backend/dist ./dist

# Frontend
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 5000

USER node

CMD ["node", "dist/server.js"]