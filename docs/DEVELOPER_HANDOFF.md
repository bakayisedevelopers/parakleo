# Parakleo developer handoff

This guide is the practical starting point for a developer new to React, React Native, Expo, Firebase, and this repository.

## Architecture at a glance

```
web/     React + Vite browser app
          ├─ Student portal
          ├─ Tutor portal
          └─ Admin portal
mobile/  Expo React Native student app
tutors/  Expo React Native tutor app
functions/ Firebase Cloud Functions and trusted integrations
services/ Gemini Live proxy and PaddleOCR support services
```

The web roles are not separate repositories or deployments. They are feature areas within `web/`, controlled by routing and user roles. The two mobile apps are independent Expo projects and must each have their own dependencies and local environment file.

## First-day setup

1. Install Git, Node.js 22 (required by Functions), npm, and the Firebase CLI.
2. Clone the repository and install dependencies separately in `web`, `mobile`, `tutors`, and `functions`.
3. Obtain access to the Firebase project and its Secret Manager secrets before attempting a Functions deployment.
4. Create the local environment files in the table below. They are ignored by Git.
5. Start with `web`: `cd web`, `npm install`, then `npm run dev:raw`.
6. Start either mobile app with Expo: `npm install` then `npm run start` in `mobile` or `tutors`.

## Local environment files

| App | Local file to create | Start from | What belongs there |
| --- | --- | --- | --- |
| Web student/tutor/admin portals | `web/.env.local` | `web/.env.local.example` | Firebase public client configuration, public Paystack key, and public endpoint URLs. |
| Student mobile app | `mobile/.env` | `mobile/.env.example` | `EXPO_PUBLIC_FIREBASE_*`, database URL, public Paystack key, web URL, and emulator options. |
| Tutor mobile app | `tutors/.env` | `tutors/.env.example` | `EXPO_PUBLIC_FIREBASE_*`, database URL, web URL, and emulator options. |
| Firebase Functions | Firebase Secret Manager | `functions/SECRETS.md` | Server-only payment, email, realtime, AI, and OCR credentials. |

`VITE_*` and `EXPO_PUBLIC_*` values are visible in a built browser/mobile application. Treat them as client configuration, never as secret storage. A Firebase web API key is a client identifier, but its Firebase API restrictions and security rules must still be configured correctly.

## Firebase Functions secrets

The Functions code uses grouped Firebase secrets to limit active Secret Manager versions. Configure the JSON structures from `functions/SECRETS.md` using Firebase CLI/Secret Manager, not a committed `.env` file:

- `PARAKLEO_PAYMENTS_SECRETS`: Paystack server secret.
- `PARAKLEO_EMAIL_SECRETS`: Resend email API key and sender address.
- `PARAKLEO_REALTIME_SECRETS`: Cloudflare TURN credentials used for WebRTC ICE configuration.
- `PARAKLEO_AI_KEYS`: Gemini configuration plus PaddleOCR endpoint, authentication, and tuning settings.

The code supports older individual-secret fallbacks during migration. Keep them only until the grouped secrets are deployed and production flows are verified, then remove the old bindings deliberately.

## External-service inventory

| Service | Used for | Credential location |
| --- | --- | --- |
| Firebase Auth, Firestore, Storage, Realtime Database, Hosting, Functions | Identity, app data, files, realtime data, hosting, server workflows | Client identifiers in app env files; server credentials in Firebase/Google Cloud. |
| Paystack | Student payments and tutor payout-related workflows | Public key in client env; secret key only in `PARAKLEO_PAYMENTS_SECRETS`. |
| Resend | Transactional email | `PARAKLEO_EMAIL_SECRETS`. |
| Cloudflare TURN | WebRTC relay/ICE configuration | `PARAKLEO_REALTIME_SECRETS`. |
| Gemini / Google AI | Attachment extraction, classification, and AI-assisted flows | `PARAKLEO_AI_KEYS`. |
| PaddleOCR | Image/document OCR fallback/service | `PARAKLEO_AI_KEYS`; supporting service is under `services/paddle-ocr-service/`. |
| Gemini Live proxy | Live AI connection proxy | Service configuration under `services/gemini-live-proxy/`; keep any API key server-side. |
| Google Cloud services | Document/vision and pricing-related Function capabilities | Project/service-account access in Google Cloud; do not embed keys in clients. |

## Important security actions before handover

1. Share production credentials with the new developer through a password manager, encrypted secret share, or the relevant provider's access controls — never WhatsApp, README files, Git commits, or issue comments.
2. Grant the developer the least Firebase, Google Cloud, Paystack, Resend, and Cloudflare access needed. Prefer personal accounts and role-based access instead of sharing an owner login.
3. Rotate any credential that may have appeared in local files, terminal history, screenshots, or Git history. In particular, review the Google Maps fallback currently present in `functions/index.js`; move it to a protected server secret or a restricted client configuration as appropriate, then rotate and restrict the old key.
4. Review Firebase Authentication settings, Firestore/Storage/Realtime Database rules, allowed web origins, Paystack webhooks, and API-key restrictions before production deployment.

## Common development commands

```bash
# Web application
cd web && npm run dev:raw

# Student mobile application
cd mobile && npm run start

# Tutor mobile application
cd tutors && npm run start

# Functions tests
cd functions && npm test

# Build the web application
cd web && npm run build
```

The `web` commands named `dev`, `dev:students`, `dev:tutors`, and `dev:admin` rely on the local Commander Preview Router. Use `dev:raw` if that local preview tool is not available.

## Before deploying

- Confirm the target Firebase project with `firebase use`.
- Confirm every grouped secret is set and bound to the Functions that need it.
- Run Functions tests and build the web app.
- Test at least student sign-in, tutor sign-in, admin access, a payment sandbox flow, email delivery, and any AI/OCR flow affected by the release.
- Deploy deliberately from the repository root with the appropriate Firebase command; do not treat a successful frontend build as proof that server secrets or Functions are ready.
