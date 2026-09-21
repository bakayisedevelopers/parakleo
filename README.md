# Parakleo

Parakleo is a tutoring platform with one web application (student, tutor, and administrator roles), two Expo mobile applications, Firebase Cloud Functions, and supporting AI/OCR services.

This repository is a monorepo: clone it once, then work in the application folder you need.

## Start here

Read [the developer handoff guide](docs/DEVELOPER_HANDOFF.md) before running or deploying anything. It explains the architecture, environment files, credentials, and external services without placing secrets in Git.

## Repository map

| Folder | Purpose |
| --- | --- |
| `web/` | React + Vite web application. It includes the student, tutor, and admin portals. |
| `mobile/` | Expo / React Native student mobile application. |
| `tutors/` | Expo / React Native tutor mobile application. |
| `functions/` | Firebase Cloud Functions: payments, email, realtime/ICE, AI, OCR, and workflow logic. |
| `services/` | Optional supporting services, including the Gemini Live proxy and PaddleOCR service. |
| `shared/` | Shared-code area (currently limited). |
| `frontend/`, `backend/` | Older or specialised modules. Confirm their ownership before changing or deploying them. |
| `docs/` | Architecture, operational, AI/OCR, and handoff documentation. |

## Quick local start

Use a recent Node.js release compatible with the project (Functions requires Node 22), then install dependencies in the app you are running.

```bash
cd web && npm install && npm run dev:raw
cd mobile && npm install && npm run start
cd tutors && npm install && npm run start
cd functions && npm install && npm test
```

The normal `web` `dev`, `dev:students`, `dev:tutors`, and `dev:admin` scripts use the local Commander Preview Router. Use `npm run dev:raw` when that tool is not installed.

## Deployment caution

Firebase project configuration is rooted at `firebase.json`. Do not deploy Functions until the grouped Firebase secrets described in `functions/SECRETS.md` have been set and verified. Never put server secrets in a `VITE_*` or `EXPO_PUBLIC_*` variable: those values are bundled into client applications.
