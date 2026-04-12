FROM node:22-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=base /app/dist ./dist
COPY --from=base /app/drizzle.config.ts ./
COPY --from=base /app/src/db/migrations ./src/db/migrations
COPY --from=base /app/src/db/seed.ts ./src/db/seed.ts
COPY --from=base /app/tsconfig.json ./

# Install tsx for seed script execution
RUN npm install -g tsx

# Startup script: push schema + seed + start
COPY --from=base /app/start.sh ./
RUN chmod +x start.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["./start.sh"]
