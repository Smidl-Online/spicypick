# EAS Build & Submit — Setup Guide

## Credentials checklist (Jan musí dodat)

### 1. EAS Project ID
- Jdi na https://expo.dev → vytvořit nový projekt "SpicyPick" pod organizací smidl-online
- Zkopíruj `projectId` (UUID formát)
- Nahraď `YOUR_EAS_PROJECT_ID` v `app.json` (2x: `extra.eas.projectId` a `updates.url`)

### 2. Apple Developer (iOS)
- **Apple Team ID** — Apple Developer → Membership → Team ID (10 znaků)
  - Nastav v `eas.json` → `submit.production.ios.appleTeamId`
  - Nastav v `api/.env` → `APPLE_TEAM_ID`
- **App Store Connect App ID** — App Store Connect → vytvoř app s bundle ID `com.spicypick.app`
  - Zkopíruj App ID (číslo, např. `1234567890`)
  - Nastav v `eas.json` → `submit.production.ios.ascAppId`

### 3. Google Play (Android)
- Vytvoř service account v Google Cloud Console s přístupem do Google Play Console
- Stáhni JSON key soubor → ulož jako `mobile/google-service-account.json`
- Soubor je v .gitignore, nebude commitnut
- Vytvoř app v Google Play Console s package `com.spicypick.app`

### 4. RevenueCat (premium subscriptions)
- Vytvoř RevenueCat projekt na https://app.revenuecat.com
- iOS public API key → `app.json` → `extra.revenueCatIosKey`
- Android public API key → `app.json` → `extra.revenueCatAndroidKey`
- Server API key → `api/.env` → `REVENUECAT_API_KEY`

### 5. Expo Push Notifications
- Pokud používáš FCM (Android): nahraj FCM server key na expo.dev
- iOS: push certificate se nastaví automaticky přes EAS credentials

## Příkazy po konfiguraci

```bash
# Login do EAS
eas login

# Development build (simulátor)
npm run build:dev

# Preview build (TestFlight/Internal)
npm run build:preview

# Production build
npm run build:prod

# Submit do storů
npm run submit:ios
npm run submit:android

# OTA update
eas update --branch production --message "popis"
```

## Profily

| Profil | Účel | Distribuce |
|--------|------|------------|
| development | Dev build s dev client | internal (simulátor) |
| preview | Testování přes TestFlight / internal | internal |
| production | Store release | store |
