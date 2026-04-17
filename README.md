# Claxi Monorepo Structure

This repository is organized with top-level folders for web, mobile, shared code, and Firebase functions:

- `web/` — React + Vite web app (current production app)
- `mobile/` — Expo-based React Native starter app
- `shared/` — shared code placeholder for cross-platform modules
- `functions/` — Firebase Cloud Functions (kept at root intentionally)

## Directory Layout

```txt
.
├── web/
├── mobile/
├── shared/
├── functions/
├── firebase.json
├── .firebaserc
└── docs/
```

## Firebase CLI setup (important)

You run Firebase deploy commands from the **repo root** because `firebase.json` is in the root.

### Option A (recommended): local CLI in this repo

```bash
cd /workspace/claxi
npm install
npx firebase --version
```

This installs `firebase-tools` in the root and avoids global setup issues.

### Option B: global CLI

```bash
npm install -g firebase-tools
firebase --version
```

## Do you need `firebase init`?

**No**, not for this restructure.

This repo already has:
- `firebase.json`
- `.firebaserc`
- `functions/` at root

So you only need to login/select project if needed:

```bash
npx firebase login
npx firebase use default
```

## Quick Start

### Web app
```bash
cd web
npm install
npm run dev
```

### Firebase Functions
```bash
cd functions
npm install
npm test
```

### Mobile starter (Expo)
```bash
cd mobile
npm install
npm run start
```

## Deploying Hosting after moving web into `web/`

Your deploy flow is still run from root, and `firebase deploy --only hosting:claxi` still works.

```bash
cd /workspace/claxi
npm install
npm run deploy:hosting
```

What happens:
1. `npm run build:web` builds the web app inside `web/`.
2. Firebase Hosting deploys from `web/dist` (configured in `firebase.json`).

If you want to run the command manually:

```bash
cd /workspace/claxi
npm --prefix web run build
npx firebase deploy --only hosting:claxi
```

## Firebase dependency placement

- **Firebase CLI (`firebase-tools`)**: install at **repo root** (recommended) or globally.
- **Web Firebase SDK (`firebase`)**: stays in **`web/package.json`**.
- **Functions Firebase deps (`firebase-admin`, `firebase-functions`)**: stay in **`functions/package.json`**.

Do not duplicate the Firebase SDK into every folder unless that folder actually needs it.
