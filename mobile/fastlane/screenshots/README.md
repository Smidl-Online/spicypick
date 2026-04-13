# Screenshots

## Required Sizes

### iOS (App Store Connect)
- 6.9" iPhone (1320 x 2868) — iPhone 16 Pro Max
- 6.5" iPhone (1284 x 2778) — iPhone 15 Plus
- 5.5" iPhone (1242 x 2208) — iPhone 8 Plus (required if supporting)
- 12.9" iPad Pro (2048 x 2732)

### Android (Google Play)
- Phone: min 320px, max 3840px (16:9 or 9:16)
- 7" tablet: 1200 x 1920
- 10" tablet: 1800 x 2560

## Recommended Screenshots (5-8 per locale)

1. **Today's Scenario** — Main screen with a scenario prompt
2. **Verdict Options** — The four verdict buttons (Guilty, Not Guilty, etc.)
3. **Community Results** — Reveal screen with vote percentages
4. **Expert Analysis** — Expert breakdown of the scenario
5. **League Rankings** — Weekly league leaderboard
6. **Profile & Streaks** — Profile with XP, level, and streak
7. **Challenge Friends** — Friend challenge flow
8. **Premium Features** — Premium subscription screen

## Directory Structure

```
screenshots/
├── ios/
│   ├── en-US/
│   │   ├── 01_scenario.png
│   │   ├── 02_verdicts.png
│   │   └── ...
│   ├── cs/
│   └── ...
└── android/
    ├── en-US/
    │   ├── phoneScreenshots/
    │   ├── sevenInchScreenshots/
    │   └── tenInchScreenshots/
    └── ...
```

## Generation

Screenshots need to be captured on actual devices or simulators. Use the app's
existing `react-native-view-shot` dependency for programmatic capture if building
an automated screenshot generation tool.
