# SpicyPick — Claude Code Instructions

## Projekt
SpicyPick — denní sociální scénářová hra. Monorepo: `api/` (Node.js + Hono + Drizzle) + `mobile/` (Expo SDK 54 + Router).

## Stack
- **API:** Node.js, Hono, Drizzle ORM, PostgreSQL, JWT auth, node-cron
- **Mobile:** Expo SDK 54, Expo Router 6, Zustand, React Native Reanimated, i18next
- **Deploy:** Coolify (Docker)

## Příkazy
- API: `cd api && npm run dev` / `npm run build` / `npm run db:push` / `npm run db:seed`
- Mobile: `cd mobile && npx expo start`
- Testy API: `cd api && npm test`

## Git workflow
- Větve: `claude/<timestamp>-<popis>`
- PR do `main`
- Commit: `vDev: <popis>`

## Konvence
- TypeScript strict v obou projektech
- Drizzle schema v `api/src/db/schema.ts`
- API routes v `api/src/routes/`
- Expo screens v `mobile/app/`
- Zustand stores v `mobile/src/store/`
- i18n klíče v `mobile/src/i18n/`
