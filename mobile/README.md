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

### Web packages currently in use (from `web/package.json` + installed lock)

Keep the mobile migration aligned with both the declared web ranges and the currently installed resolved versions:

| Package | Declared in `web/package.json` | Installed in `web/node_modules` |
|---|---:|---:|
| `firebase` | `^11.10.0` | `11.10.0` |
| `lucide-react` | `^0.307.0` | `0.307.0` |
| `motion` | `^11.0.0` | `11.18.2` |
| `react` | `^18.2.0` | `18.3.1` |
| `react-dom` | `^18.2.0` | `18.3.1` |
| `react-router-dom` | `^6.20.0` | `6.30.3` |
| `tldraw` | `^4.5.9` | `4.5.9` |
| `@vitejs/plugin-react` | `^4.2.1` | `4.7.0` |
| `autoprefixer` | `^10.4.16` | `10.4.27` |
| `postcss` | `^8.4.32` | `8.5.8` |
| `tailwindcss` | `^3.4.1` | `3.4.19` |
| `vite` | `^5.0.8` | `5.4.21` |

Current mobile starter packages in `mobile/package.json` are `expo@^53.0.0`, `expo-status-bar@~2.0.0`, `react@^18.3.1`, and `react-native@0.76.0`. Phase 0 must either keep these exact mobile runtime versions or explicitly document any required Expo-compatible change.

### Student-relevant feature set detected in the current app

- Authentication (signup/login/logout), protected routes, role-aware redirects, and live profile loading.
- Student-only app surfaces: dashboard, class request creation, request list, request details/status, sessions list, wallet/payment page, profile, onboarding, and session room entry.
- Student onboarding/profile management, including subject/academic profile constraints reused from web utilities.
- Current request flow starts on the student dashboard: quick request suggestions, typed topic/description, camera/file attachments, automatic subject detection, duration estimate, price quote, free-minute discount preview, selected saved card, and review-before-confirm.
- Attachment upload and extraction pipeline: image/PDF selection, Storage upload, OCR/extraction hooks, subject classification hooks, and whiteboard preparation source generation.
- Real-time request/session tracking through Firestore listeners, including request states such as pending, matching, offered, accepted, waiting student, in progress, in session, completed, canceled, and no tutor available.
- Sessions list/details with request-to-session linking, uploaded attachment visibility, tutor assignment status, quoted pricing snapshot, and "Join / Re-open class" entry.
- Session room architecture with:
  - `tldraw` SDK embed on web for tutor whiteboard
  - prepared whiteboard injection from parsed attachment/question data
  - WebRTC session controller/service hooks
  - ICE server fetch endpoint support
  - student remote screen-share viewing, mute/end/cancel controls, join window handling, selected-duration auto-end, 2-minute grace prompt, and post-session rating
- Wallet and payment method management: Paystack inline authorization on web, backend verification endpoint, saved cards, wallet top-up, outstanding debt display, failed-charge/debt handling parity, and policy links.
- Notifications and rating prompts, backed by Firestore-driven subscriptions and server-side email event queues.
- Shared backend contracts with Firebase Auth, Firestore, Storage, Functions endpoint rewrites, Paystack, Resend, OCR, subject classification, student growth/free-minute sync, and session billing.

### Web design and UX traits to preserve

- Light app shell with white/zinc surfaces, emerald brand color (`#10b981`), cyan/indigo accents, rounded panels, soft shadows, and bottom navigation behavior on mobile-sized web viewports.
- Student dashboard is the primary first screen after login, not a marketing page.
- Camera/file upload and typed request entry are prominent, with clear processing overlays for extraction/classification before review.
- Form controls use compact cards, icon-led actions, loading/empty/error states, and status badges.
- Session room is full-screen and task-focused: landscape guidance on mobile, screen/board stage fills the viewport, controls float over the live surface, and post-session rating is modal/full-screen.

---

## React Native package counterparts (web -> mobile)

> These are target packages for migration planning. Final lock-in should happen during Phase 0 spike/prototyping.

| Current web package/capability | React Native counterpart(s) | Notes |
|---|---|---|
| `react@18.3.1`, `react-dom@18.3.1`, Vite app shell | `react@^18.3.1`, `react-native@0.76.0`, `expo@^53.0.0` | Current mobile starter already matches React 18.3.1 and Expo-managed RN. Keep Expo compatibility first. |
| `react-router-dom@6.30.3` | `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs` | Navigation/route guards for auth + student app areas. Mirror `/app/student`, `/app/student/requests`, `/app/student/payment`, `/app/profile`, `/app/onboarding`, and `/app/session/:id`. |
| `firebase@11.10.0` (auth/firestore/storage/functions) | `firebase@11.10.0` JS SDK (modular) in RN + `@react-native-async-storage/async-storage` | Keep shared backend, Firestore schema, Storage paths, and auth persistence aligned with web. |
| `lucide-react@0.307.0` icons | `lucide-react-native@0.307.0` | Pin to the matching icon set version where Expo compatibility allows. |
| `motion@11.18.2` animations | `react-native-reanimated` (+ optional `moti`) | Better-native motion performance/gestures; preserve processing overlays, page transitions, and control affordances. |
| `tldraw@4.5.9` whiteboard | `tldraw@4.5.9` in `react-native-webview`, OR native canvas via `react-native-skia` | There is no 1:1 mature native `tldraw` drop-in today. Evaluate keeping the exact web SDK in a WebView before replacing it. |
| Browser WebRTC usage | `react-native-webrtc` | Required for in-app RTC media; integrate with existing signaling model. |
| Screen-share viewing and media controls | `react-native-webrtc`, `expo-av` (or `react-native-incall-manager` if needed) | Student app must receive tutor screen share, support mute/end/cancel, and enforce duration/grace flow. |
| Tailwind CSS UI system (`tailwindcss@3.4.19`) | `nativewind` | Tailwind-style utility workflow on RN. Preserve the emerald/zinc/cyan/indigo design language. |
| File/image picking uploads | `expo-image-picker`, `expo-camera`, `expo-document-picker`, `expo-file-system` | Replaces browser file input/upload behavior and supports the dashboard "Take Picture" first workflow. |
| Push/notifications UI | `expo-notifications` | For local + remote notification handling. |
| Secure token/session storage | `expo-secure-store` | Store auth/session-sensitive values securely. |
| Payments (Paystack web flow) | `react-native-paystack-webview` (or API + custom web checkout fallback) | Validate PCI-safe flow and regional requirements. |
| Email events (server-side) | no mobile package (keep Firebase Functions + Resend backend) | Mobile only triggers backend workflows. |

---

## Phased implementation plan (student app only, React Native/Expo only)

Each phase is intended to be implemented in Codex Web as a standalone milestone and reviewed before continuing.

> Hard constraint for every phase: use React Native + Expo libraries and workflows only.

> 2026-04-27 parity update: keep the existing phased plan, but execute it against the current web app shape: dashboard-first student request flow, `firebase@11.10.0`, React 18.3.1 parity, Paystack verification endpoints, OCR/classification/growth endpoints, and the full-screen WebRTC/screen-share session room.

### Phase 0 — Discovery, package spike, and architecture freeze

**Goal:** remove technical uncertainty before UI migration.

- Confirm the student-only route inventory from web app: login, signup, protected app shell, profile, onboarding, dashboard/request creation, requests list, request status/details, sessions list, wallet/payment, and session room.
- Build short spikes for:
  - Firebase Auth + Firestore listener in RN using `firebase@11.10.0`
  - Firebase Storage upload from Expo-picked image/PDF files
  - WebRTC proof of connection (`react-native-webrtc`)
  - student receipt of tutor screen share through the existing signaling model
  - whiteboard approach candidate (`tldraw@4.5.9` in WebView vs native canvas)
  - Paystack mobile payment authorization/verification flow
  - callable/HTTP endpoint strategy for `/ice-config`, `/verify-paystack`, `/finalize-session-billing`, `/image-ocr`, `/classify-subject`, and `/sync-student-growth`
- Freeze package list + app architecture decisions, including exact versions where parity matters.
- Output: `mobile/docs/phase-0-architecture.md` with accepted package stack and rejected alternatives.

**Exit criteria:**
- Auth, Firestore, Storage upload, RTC, screen-share receive, whiteboard candidate, endpoint calls, and payment flow all have at least one working proof.

---

### Phase 1 — Foundation and shared infrastructure

**Goal:** create production-ready student app skeleton.

- Set up navigation structure (auth stack + student tab/stack) matching web's student route map.
- Configure environment management and Firebase client initialization.
- Implement auth session persistence and protected routes.
- Add design system primitives (buttons, compact cards, form fields, select fields, status badges, loading/empty/error states).
- Recreate web visual direction in native primitives: white/zinc surfaces, emerald brand, cyan/indigo accents, soft shadows, rounded panels, and bottom-tab ergonomics.
- Add telemetry/logging hooks and global error boundary.
- Add shared service boundaries that mirror web service names/contracts where practical (`authService`, `userService`, `classRequestService`, `sessionService`, `walletService`, `paymentMethodService`).

**Primary package focus:**
`expo`, `react-native`, `@react-navigation/*`, `firebase@11.10.0`, `@react-native-async-storage/async-storage`, `nativewind`.

**Exit criteria:**
- User can sign in/out and remain logged in after app restart.
- App shell, bottom tabs, protected screens, and shared service wiring are ready for feature screens.

---

### Phase 2 — Student onboarding/profile + payment methods

**Goal:** unlock request eligibility paths.

- Build student onboarding/profile screens (subjects, academic context, profile fields, onboarding completion banner).
- Add payment method management UI and backend wiring.
- Implement saved-card display, default card selection, nickname handling, and Paystack verification endpoint call.
- Port validation logic from web onboarding constraints.
- Ensure data contracts stay compatible with existing Firestore schema.

**Primary package focus:**
`firebase@11.10.0`, `expo-secure-store`, payment package selected in Phase 0.

**Exit criteria:**
- Student can complete onboarding, update profile data, add/manage saved cards, and keep Firestore user records compatible with web.

---

### Phase 3 — Class request creation + attachments + pricing

**Goal:** ship core “request a class” workflow.

- Implement dashboard-first request flow, not a separate blank form.
- Support quick suggestions, typed topic/description, camera capture, image/PDF picker, attachment removal, and processing status rows.
- Integrate attachment upload to Storage and OCR/extraction trigger path consistent with backend services.
- Integrate subject detection/classification fallback, manual subject selection, estimated duration, selectable duration, free-minute discount preview, price quote, and selected payment card.
- Build the review-before-confirm step and persist the same request shape used by web, including `pricingSnapshot`, `attachments`, `selectedCardId`, and `boardPreparationSource`.

**Primary package focus:**
`expo-image-picker`, `expo-camera`, `expo-document-picker`, `expo-file-system`, `firebase@11.10.0`.

**Exit criteria:**
- Student can submit a request with/without attachments, see extraction/classification status, review pricing, and see the request persisted live.

---

### Phase 4 — Request tracking + notifications + sessions list

**Goal:** keep student informed in real-time.

- Build request status timeline/tracker using the same lifecycle labels and status mapping as web.
- Build "My Classes" request list, request detail screen, and student sessions list/detail cards.
- Show tutor assignment, session linkage, request attachments, quoted total/free-minute discount, selected duration, and "Join / Re-open class" entry when a session exists.
- Wire notification feed and in-app notification indicators.
- Port rating prompt flow for completed sessions.
- Add deep links for request details and session room entry.

**Primary package focus:**
`firebase@11.10.0`, `expo-notifications`, navigation deep-links.

**Exit criteria:**
- Student can monitor requests, request details, notifications, and session lifecycle entirely on mobile.

---

### Phase 5 — Session room (WebRTC + whiteboard)

**Goal:** deliver live classroom experience.

- Implement RTC media connect/disconnect flow with ICE config support and network error messaging.
- Implement student screen-share receive stage so the tutor's shared screen/board fills the viewport.
- Implement mute, cancel with reason, end session, auto-join, join grace window, selected-duration auto-end, and 2-minute grace prompt.
- Implement whiteboard experience per selected Phase 0 approach, preserving `tldraw@4.5.9` compatibility if WebView is selected.
- Integrate question parsing / whiteboard preparation hooks where applicable so uploaded work can seed the tutor board.
- Add session state handling (waiting student, in progress, completed, canceled, canceled during, failed/no access) and post-session rating.
- Include landscape guidance and full-screen layout treatment matching the web session room.

**Primary package focus:**
`react-native-webrtc`, `react-native-webview` or whiteboard package selected in Phase 0.

**Exit criteria:**
- Student can join a session, receive live tutor media/screen-share/board workflow, manage controls, complete the timed billing flow, and submit/dismiss rating.

---

### Phase 6 — Wallet, billing, and hardening

**Goal:** complete payment lifecycle and production readiness.

- Implement wallet balance/debt views and top-up flow.
- Finalize billing edge cases (failed charge -> debt handling parity), session finalization endpoint behavior, and outstanding amount display.
- Port payment policy links/content strategy for mobile surfaces.
- Improve offline/poor-network behavior, retries, and error UX.
- Add smoke/regression test checklist for all student critical paths.
- Confirm mobile does not introduce tutor/admin UI, but preserves backend compatibility with tutor/admin web flows.

**Primary package focus:**
payment package, `firebase@11.10.0`, analytics/crash reporting choice.

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
