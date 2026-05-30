# 🌶️ SpicyPick

[![CI](https://github.com/Smidl-Online/spicypick/actions/workflows/ci.yml/badge.svg)](https://github.com/Smidl-Online/spicypick/actions/workflows/ci.yml)

Daily social scenario judgment game. Read a real-life scenario, cast your verdict, see how the community voted, and climb the leaderboards.

## Stack

- **Mobile:** Expo SDK 54, React Native, Expo Router, Zustand, Reanimated
- **API:** Node.js, Hono, Drizzle ORM, PostgreSQL
- **Deploy:** Coolify (Docker)

## Getting Started

### API

```bash
cd api
cp .env.example .env  # Configure DATABASE_URL, JWT secrets
npm install
npm run db:push       # Push schema to PostgreSQL
npm run db:seed       # Seed achievements + 95 scenarios
npm run dev           # Start dev server on :3000
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## CI/CD

GitHub Actions pipeline:

- **CI** — spouští se na každý PR do `main`: testy (`npm test`) + TypeScript check (`tsc --noEmit`). Merge je blokovaný dokud CI neprošlo.
- **Deploy** — spouští se po push do `main`: nejdřív CI, pak deploy na Coolify přes webhook.

### GitHub Secrets (nastavit v Settings → Secrets → Actions)

| Secret | Popis |
|---|---|
| `COOLIFY_DEPLOY_WEBHOOK` | Webhook URL pro trigger deploy (`/api/v1/deploy?uuid=<uuid>`) |

## Features

- Daily social scenarios with 4 verdict options
- Animated reveal of community voting stats
- XP system with levels (Duolingo-style formula)
- Daily streaks with freeze protection
- Weekly leagues (10 tiers, 30 players each)
- 10 achievements to unlock
- Friend challenges (duels)
- Emoji verdict card sharing (Wordle-style)
- User-submitted scenarios with moderation
- Premium subscription (archive, extended analysis, ad-free)
- Push notifications (daily scenario, streak warning, league, challenges)
- i18n (EN, CS, DE, ES, PT, FR, JA)
- AI-powered expert analysis (Claude API)
- GDPR compliant (account deletion, data export)

## Database Backup & Restore

Automated daily backup to Hetzner Object Storage (S3-compatible).

### Setup

1. Create a bucket in [Hetzner Object Storage](https://console.hetzner.com/object-storage)
2. Generate S3 access credentials for the bucket
3. Install AWS CLI on the server: `apt install awscli`
4. Install pg_dump: `apt install postgresql-client`
5. Configure `.env` with `BACKUP_S3_*` variables (see `.env.example`)

### Manual backup

```bash
# Run from project root — reads api/.env automatically
./scripts/backup.sh
```

### Automated backup — cron (server/VPS)

Add to crontab (`crontab -e`):

```cron
0 2 * * * /home/jan/projects/spicypick/scripts/backup.sh >> /var/log/spicypick-backup.log 2>&1
```

### Automated backup — Coolify scheduled job

In Coolify → SpicyPick service → **Scheduled Jobs**:
- **Schedule:** `0 2 * * *`
- **Command:** `bash /scripts/backup.sh`
- Ensure all `BACKUP_S3_*` env vars are set in the Coolify service environment

### Restore from backup

```bash
# Interactive — lists available backups
./scripts/restore.sh

# Direct restore from a specific file
./scripts/restore.sh spicypick_20240115_020000.sql.gz
```

Downloads the backup from S3, decompresses it, runs `psql` to restore. Asks for confirmation before overwriting.

### Retention

Backups older than `BACKUP_RETENTION_DAYS` days (default: 30) are automatically deleted at the end of each backup run.

### Failure notifications

If backup fails, email is sent to `BACKUP_NOTIFY_EMAIL` via Resend (`RESEND_API_KEY` required).
