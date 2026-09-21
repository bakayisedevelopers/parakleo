# Parakleo web application

This is the React + Vite application for all browser roles:

- Student portal: `src/pages/app/student/`
- Tutor portal: `src/pages/app/tutor/`
- Admin portal: `src/pages/app/admin/`

The routes, role guards, Firebase client configuration, and feature services are in `src/`. This is one web application, so the three roles share the same `web/.env.local` file and deployment.

## Run locally

```bash
npm install
cp .env.local.example .env.local
npm run dev:raw
```

`npm run dev`, `npm run dev:students`, `npm run dev:tutors`, and `npm run dev:admin` are convenience commands for the local Commander Preview Router. They are not required for ordinary Vite development.

## Environment

Keep `web/.env.local` local; it is ignored by Git. Begin with `.env.local.example`, then obtain the correct values from the project owner/Firebase console. Required client configuration is the `VITE_FIREBASE_*` set. The example also contains optional public endpoint settings for payment verification, ICE/WebRTC, AI/OCR, tutor agreements, pricing, and student-growth workflows.

Only public client identifiers belong here. Do not add Paystack secret keys, Resend keys, Cloudflare tokens, Google AI keys, or OCR service keys; those belong in Firebase Functions secrets.

## Build

```bash
npm run build
npm run preview
```

Firebase client setup is in `src/firebase/config.js`; server-side endpoints are implemented in `../functions/`. For the complete operational checklist, see [the repository handoff guide](../docs/DEVELOPER_HANDOFF.md).
