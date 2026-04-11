# 🌶️ SpicyPick

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
- i18n (EN, CS)
- AI-powered expert analysis (Claude API)
- GDPR compliant (account deletion, data export)
