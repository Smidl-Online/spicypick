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

EXPOSE 3000

CMD ["node", "dist/index.js"]
