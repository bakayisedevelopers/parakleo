# Parakleo tutor mobile app

This folder contains the Expo / React Native app used by tutors. The app entry point is `App.js`; screens and feature code are under `src/`.

## Run locally

```bash
npm install
cp .env.example .env
npm run start
```

Use `npm run android`, `npm run ios`, or `npm run web` for a platform-specific start. For a local Firebase Emulator Suite workflow, set `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true` and select an emulator host appropriate for the device or simulator.

## Environment

The app reads `EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_FIREBASE_DATABASE_URL`, `EXPO_PUBLIC_WEB_APP_URL`, and emulator options from its local `.env`. Values prefixed with `EXPO_PUBLIC_` are included in the client bundle, so they must never contain server credentials.

Copy `.env.example` and receive the real project values through an approved secret-sharing channel. The complete environment and service guide is at [../docs/DEVELOPER_HANDOFF.md](../docs/DEVELOPER_HANDOFF.md).
