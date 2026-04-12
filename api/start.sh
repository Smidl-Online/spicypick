#!/bin/sh
set -e

echo "SpicyPick API — running DB migrations..."
npx drizzle-kit migrate

echo "SpicyPick API — running seed..."
tsx src/db/seed.ts

echo "SpicyPick API — starting server..."
exec node dist/index.js
