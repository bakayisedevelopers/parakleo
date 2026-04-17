# Claxi MVP Foundation

Claxi is an online-first tutoring marketplace where students request classes and tutors accept/manage them in real time.

## Stack
- React + Vite + Tailwind + React Router
- Firebase Auth + Firestore (modular SDK usage)
- Firebase Hosting + Functions-ready project config
- Resend email delivery through Firebase Functions (server-side only)

## Environment Variables
Create a `.env` file for web app:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_ID=claxi
```

Set Firebase Functions environment variables/secrets separately:

```bash
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com
PAYSTACK_SECRET_KEY=
```

This project is configured to use Hosting/Vite route mapping for backend payment endpoints (`/verify-paystack`, `/finalize-session-billing`).

## Firestore Collections
- `users`
- `classRequests`
- `sessions`
- `notifications`
- `emailEvents` (queue consumed by Cloud Function)

## Real-time subscriptions
- `subscribeToStudentRequests`
- `subscribeToTutorAvailableRequests`
- `subscribeToTutorAcceptedRequests`
- `subscribeToStudentSessions`
- `subscribeToTutorSessions`
- `subscribeToNotifications`

## Key Product Flows
1. Signup/login with role (`student` or `tutor`) and user profile document creation.
2. Student creates request -> stored in `classRequests` and visible live to tutors.
3. Tutor accepts request -> request status updates + `sessions` document created.
4. Tutor accepts request and starts in-app WebRTC call setup -> students see session-ready state instantly.
5. Critical email events are queued in `emailEvents` and dispatched via Firebase Function + Resend.

## Firebase Functions
Functions source is in `functions/index.js`.

Deploy flow example:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,hosting
```

> Do not expose `RESEND_API_KEY` in frontend code.
