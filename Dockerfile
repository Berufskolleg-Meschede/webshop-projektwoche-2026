FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json npm-shrinkwrap.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_API_AUTH_TOKEN
ARG VITE_PUBLIC_BASE_URL
ARG VITE_SIMULATION_API_BASE_URL
ARG VITE_COMMIT_SHA
RUN npm run build

# One small Node process serves the built SPA and the simulation API (in-memory sessions).
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 STATIC_DIR=/app/dist
COPY --from=builder /app/dist ./dist
COPY server ./server
# The server shares these two type/constant modules with the frontend.
COPY src/types/simulation.ts src/types/production.ts ./src/types/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
CMD ["node", "server/index.ts"]
