# Claxi Mobile Plan (React Native, Student App Only)

This document replaces the previous starter-only note and serves as the implementation plan for the **student-only** mobile application.

## What was in this file before

The previous `mobile/README.md` was a short Expo starter note:
- why Expo was chosen,
- how to run the starter app,
- and that there was no Firebase wiring or web feature port yet.

## Final build decision (locked on 2026-04-23)

- ✅ **Build framework: React Native with Expo only** (for Codespaces-friendly testing).
- ❌ **Do not build this app in Flutter.**
- ❌ **Do not build this app in FlutterFlow.**
- ✅ Scope is **student user only** (no tutor UI, no admin UI).
- ✅ Delivery model is phased so Codex Web can implement in the background and notify you at each phase completion.

---

## Current web stack and core features to preserve

### Web packages currently in use (from `web/package.json`)

- `firebase`
- `react`, `react-dom`
- `react-router-dom`
- `lucide-react`
- `motion`
- `tldraw`
- tooling: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`

### Student-relevant feature set detected in the current app

- Authentication (signup/login/logout) + profile loading
- Student onboarding/profile management
- Request class flow (topic, description, duration, price quote)
- Attachment upload and OCR-assisted parsing hooks
- Real-time request status updates
- Sessions list + session room entry
- Session room architecture with:
  - whiteboard embedding (`tldraw` on web)
  - WebRTC session controller/service hooks
- Wallet and payment method management (Paystack verification flow)
- Notifications and rating prompts
- Firestore-driven real-time subscriptions across requests/sessions/notifications

---

## React Native package counterparts (web -> mobile)

> These are target packages for migration planning. Final lock-in should happen during Phase 0 spike/prototyping.

| Current web package/capability | React Native counterpart(s) | Notes |
|---|---|---|
| `react`, `react-dom`, Vite app shell | `react-native`, `expo` | Core runtime in Expo-managed RN app. |
| `react-router-dom` | `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs` | Navigation/route guards for auth + student app areas. |
| `firebase` (auth/firestore/storage/functions) | `firebase` JS SDK (modular) in RN + `@react-native-async-storage/async-storage` | Keep shared backend and data model. |
| `lucide-react` icons | `lucide-react-native` | Close visual parity for icon set. |
| `motion` animations | `react-native-reanimated` (+ optional `moti`) | Better-native motion performance/gestures. |
| `tldraw` whiteboard | `@excalidraw/excalidraw` (webview embed) OR custom canvas via `react-native-skia` | There is no 1:1 mature native `tldraw` drop-in today. Evaluate tradeoffs in Phase 0. |
| Browser WebRTC usage | `react-native-webrtc` | Required for in-app RTC media; integrate with existing signaling model. |
| Local/edge media controls | `expo-av` (or `react-native-incall-manager` if needed) | Audio session and device controls may need native modules. |
| Tailwind CSS UI system | `nativewind` | Tailwind-style utility workflow on RN. |
| File/image picking uploads | `expo-image-picker`, `expo-document-picker`, `expo-file-system` | Replaces browser file input/upload behavior. |
| Push/notifications UI | `expo-notifications` | For local + remote notification handling. |
| Secure token/session storage | `expo-secure-store` | Store auth/session-sensitive values securely. |
| Payments (Paystack web flow) | `react-native-paystack-webview` (or API + custom web checkout fallback) | Validate PCI-safe flow and regional requirements. |
| Email events (server-side) | no mobile package (keep Firebase Functions + Resend backend) | Mobile only triggers backend workflows. |

---

## Phased implementation plan (student app only, React Native/Expo only)

Each phase is intended to be implemented in Codex Web as a standalone milestone and reviewed before continuing.

> Hard constraint for every phase: use React Native + Expo libraries and workflows only.

### Phase 0 — Discovery, package spike, and architecture freeze

**Goal:** remove technical uncertainty before UI migration.

- Confirm the student-only route inventory from web app.
- Build short spikes for:
  - Firebase auth + Firestore listener in RN
  - WebRTC proof of connection (`react-native-webrtc`)
  - Whiteboard approach candidate (webview embed vs native canvas)
  - Paystack mobile payment method
- Freeze package list + app architecture decisions.
- Output: `mobile/docs/phase-0-architecture.md` with accepted package stack and rejected alternatives.

**Exit criteria:**
- Auth, Firestore, RTC, whiteboard candidate, and payment flow all have at least one working proof.

---

### Phase 1 — Foundation and shared infrastructure

**Goal:** create production-ready student app skeleton.

- Set up navigation structure (auth stack + student tab/stack).
- Configure environment management and Firebase client initialization.
- Implement auth session persistence and protected routes.
- Add design system primitives (buttons, cards, form fields, loading/empty states).
- Add telemetry/logging hooks and global error boundary.

**Primary package focus:**
`expo`, `react-native`, `@react-navigation/*`, `firebase`, `@react-native-async-storage/async-storage`, `nativewind`.

**Exit criteria:**
- User can sign in/out and remain logged in after app restart.
- App shell ready for feature screens.

---

### Phase 2 — Student onboarding/profile + payment methods

**Goal:** unlock request eligibility paths.

- Build student onboarding/profile screens (subjects, academic context, profile fields).
- Add payment method management UI and backend wiring.
- Port validation logic from web onboarding constraints.
- Ensure data contracts stay compatible with existing Firestore schema.

**Primary package focus:**
`firebase`, `expo-secure-store`, payment package selected in Phase 0.

**Exit criteria:**
- Student can complete onboarding and manage payment methods from mobile.

---

### Phase 3 — Class request creation + attachments + pricing

**Goal:** ship core “request a class” workflow.

- Implement request form (topic, description, duration, selected payment method).
- Integrate attachment pickers (image/PDF) and upload to storage.
- Integrate OCR/extraction trigger path consistent with backend services.
- Display price quote and request submission confirmation.

**Primary package focus:**
`expo-image-picker`, `expo-document-picker`, `expo-file-system`, `firebase`.

**Exit criteria:**
- Student can submit a request with/without attachments and see it persisted live.

---

### Phase 4 — Request tracking + notifications + sessions list

**Goal:** keep student informed in real-time.

- Build request status timeline/tracker.
- Build student sessions list/detail cards.
- Wire notification feed and in-app notification indicators.
- Port rating prompt flow for completed sessions.

**Primary package focus:**
`firebase`, `expo-notifications`, navigation deep-links.

**Exit criteria:**
- Student can monitor requests and session lifecycle entirely on mobile.

---

### Phase 5 — Session room (WebRTC + whiteboard)

**Goal:** deliver live classroom experience.

- Implement RTC media connect/disconnect flow.
- Implement whiteboard experience per selected Phase 0 approach.
- Integrate question parsing / whiteboard preparation hooks where applicable.
- Add session state handling (active/ended/failed).

**Primary package focus:**
`react-native-webrtc`, whiteboard package selected in Phase 0.

**Exit criteria:**
- Student can join a session and use live media + whiteboard workflow.

---

### Phase 6 — Wallet, billing, and hardening

**Goal:** complete payment lifecycle and production readiness.

- Implement wallet balance/debt views and top-up flow.
- Finalize billing edge cases (failed charge -> debt handling parity).
- Improve offline/poor-network behavior, retries, and error UX.
- Add smoke/regression test checklist for all student critical paths.

**Primary package focus:**
payment package, `firebase`, analytics/crash reporting choice.

**Exit criteria:**
- Student billing and wallet lifecycle match current web behavior.
- App is ready for production pilot.

---

## Codex Web execution + email review loop

To support “build in background and notify by email when phase is complete”:

1. Keep one tracker file per phase under `mobile/docs/phases/` with:
   - checklist,
   - implementation notes,
   - QA outcomes,
   - pending decisions.
2. At phase completion, trigger backend email notification by writing a `phase_complete` event into Firestore (existing event queue pattern used by functions + Resend can be reused).
3. Include phase artifact links/screenshots in the completion note for quick review.
4. Do not start next phase until review sign-off is captured in the tracker file.

Suggested completion event shape:

```json
{
  "type": "phase_complete",
  "target": "student_mobile",
  "phase": "Phase 3",
  "summary": "Request creation + attachment uploads complete",
  "reviewer": "product_owner_email",
  "createdAt": "serverTimestamp"
}
```

---

## Scope guardrails (non-negotiable)

- Build **student experience only**.
- Exclude tutor dashboards, tutor workflows, and admin tooling from mobile scope.
- Any shared backend updates must not break existing web tutor/admin behavior.

## Definition of done for migration

- Student can complete the end-to-end lifecycle on mobile:
  1) authenticate,
  2) onboard,
  3) add payment method,
  4) request class with optional attachment,
  5) track request,
  6) join session room,
  7) complete billing/wallet follow-up,
  8) submit session rating.
