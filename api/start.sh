#!/bin/sh
set -e

echo "SpicyPick API — pushing DB schema..."
npx drizzle-kit push --force

echo "SpicyPick API — running seed..."
tsx src/db/seed.ts || echo "Seed skipped (may already exist)"

echo "SpicyPick API — starting server..."
exec node dist/index.js
