#!/bin/sh
set -e

echo "SpicyPick API — pushing DB schema..."
npx drizzle-kit push --force

echo "SpicyPick API — clearing orphaned refresh tokens (pre-hash migration)..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('DELETE FROM refresh_tokens WHERE token_hash IS NULL OR token_hash = \'\'')
  .then(r => console.log('Cleared ' + r.rowCount + ' orphaned refresh tokens'))
  .catch(e => console.log('No orphaned tokens to clear (table may be fresh)'))
  .finally(() => pool.end());
"

echo "SpicyPick API — running seed..."
tsx src/db/seed.ts

echo "SpicyPick API — starting server..."
exec node dist/index.js
