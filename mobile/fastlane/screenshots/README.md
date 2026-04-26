# SpicyPick App Store Screenshots

## Current Status

Designed placeholder screenshots are committed (generated via `scripts/generate-screenshots.py`).
Production-ready for F&F / internal testing submission. Replace with real device
captures before public App Store launch.

## Required Sizes

### iOS (App Store Connect)
| Slot | Size | File prefix |
|------|------|-------------|
| iPhone 6.7" (required) | 1290 × 2796 | `6.7inch_` |
| iPhone 5.5" (required) | 1242 × 2208 | `5.5inch_` |

### Android (Google Play)
| Slot | Size | Directory |
|------|------|-----------|
| Phone (required) | 1080 × 1920 | `phoneScreenshots/` |
| 7" tablet (optional) | 1200 × 1920 | `sevenInchScreenshots/` |

## 5 Screenshots per Platform

| # | Screen | Caption |
|---|--------|---------|
| 01 | Daily Scenario + 4 verdict buttons | "Read. Vote. Compare 🗳️" |
| 02 | Vote reveal + community % bar chart | "See how millions voted" |
| 03 | Weekly league leaderboard | "Climb the weekly ranks" |
| 04 | Profile: XP bar, streaks, achievements | "Earn achievements & streaks" |
| 05 | Premium subscription page | "Go premium: ad-free + archive" |

## Regenerate Placeholder Screenshots

```bash
cd mobile
python3 scripts/generate-screenshots.py
# Requires: pip3 install Pillow
```

## Capture Real Screenshots (MacTester / CI)

```bash
# 1. Boot simulator / emulator with app installed
# 2. Run Maestro flow — screenshots land in ~/.maestro/tests/<run-id>/screenshots/
APP_ID=com.spicypick.app maestro test e2e/screenshots.yaml

# 3. Copy to fastlane dirs and rename with size prefix (iOS)
# 4. Or use fastlane lane:
bundle exec fastlane ios capture_screenshots
```

## Upload to Stores

```bash
bundle exec fastlane ios screenshots      # → App Store Connect
bundle exec fastlane android screenshots  # → Google Play
```
