# Claxi Bugs / Stability Review (Whole Application)

This document is a **code-review checklist** based on a full pass through the app with a focus on reliability, realtime behavior, and launch readiness.

---

## 1) Core request flow flicker (student + tutor) — **Critical**

### What I found
- Matching state is being refreshed from **multiple periodic loops** (`setInterval`) and live listeners, which can repeatedly rewrite request state.
- `refreshActiveMatchingRequests()` runs every 5 seconds from student subscriptions and tutor subscriptions, and it can move a request between `matching`, `offered`, and `no_tutor_available` repeatedly depending on timing.
- `assignNextTutorOffer()` also rewrites status and emits notifications, so status writes can “fight” each other under load.

### Evidence
- `subscribeToStudentRequests` starts a 5s refresh loop.
- `subscribeToTutorAvailableRequests` starts another 5s refresh loop and also handles offer expiry.
- `refreshActiveMatchingRequests` updates statuses and may immediately call `assignNextTutorOffer`.

### Why this matches your reported issue
This explains the "shows/disappears/shows" behavior on both sides: status changes are being recalculated and rewritten by multiple workers.

### Recommended fix (implementation steps)
1. Move matching/offer state transitions to **one backend authority** (Cloud Function / server worker).
2. Stop running status transition logic in frontend subscriptions.
3. Keep frontend realtime listeners **read-only** (just render current state).
4. Enforce idempotent transition guards server-side (e.g., lease/version/transaction checks).

---

## 2) Accept action races with timeout handling — **Critical**

### What I found
- Tutor offer expiry is processed inside listener paths; if the tutor clicks accept near expiry, timeout/decline logic may run concurrently.
- Accept is transactional (good), but competing timeout paths can still clear assignment and cause retries from UI perspective.

### Recommended fix (implementation steps)
1. Handle expiry only on backend (scheduled/atomic process).
2. In accept transaction, verify `offerExpiresAt > now` and lock by offer revision/token.
3. Add idempotency key for accept requests to prevent duplicate retries.
4. Return deterministic response payload so UI can stop retry spam.

---

## 3) Duplicate offer UX surfaces (overlay + page actions) — **High**

### What I found
- Tutors can respond from both `TutorOfferOverlay` and `AvailableRequestsPage`, creating multiple action entry points for the same offer and increasing race probability.

### Recommended fix
- Choose one primary interaction surface for live offers (overlay preferred), or lock one while the other is active.
- Keep a shared in-memory lock per request id in UI state manager.

---

## 4) Offer timeout messaging mismatch — **Medium**

### What I found
- Offer timeout constant is 30 seconds, but UI text in some places still says 10 seconds.

### Why it matters
- Inconsistent UX increases confusion and false bug reports.

### Recommended fix
- Centralize timeout text from one constant and render consistently everywhere.

---

## 5) Debug logs left in production screen — **Medium**

### What I found
- `StudentRequestStatusPage` has direct `console.log` calls for live request/session state.

### Why it matters
- Noise in production logs and potential performance impact in high traffic tabs.

### Recommended fix
- Remove direct console calls or guard them under `import.meta.env.DEV` using your existing logger utility.

---

## 6) Silent fallback to mock mode when Firebase env is missing — **High (release risk)**

### What I found
- If Firebase env variables are missing/incorrect, app falls back to local mock mode.

### Why it matters
- In staging/production misconfiguration, app can appear "working" but actually run disconnected from real backend.

### Recommended fix
1. Add explicit environment guard for production builds.
2. Hard-fail startup in production when required Firebase env vars are missing.
3. Show a clear blocking error screen instead of silently using mock mode.

---

## 7) Frontend as workflow orchestrator instead of backend — **High**

### What I found
- Critical lifecycle logic (matching, retries, timeout progression) lives in client services.

### Why it matters
- Multiple clients/tabs and flaky networks produce inconsistent outcomes.

### Recommended fix
- Shift request lifecycle state machine fully to backend.
- Frontend should only request actions (create/accept/decline/cancel) and subscribe to authoritative state.

---

## 8) No lint/test scripts in root package — **High (quality gate gap)**

### What I found
- `package.json` has `dev/build/preview` only; no lint, unit tests, or smoke checks.

### Why it matters
- Regression risk is high, especially with AI-assisted edits across isolated files.

### Recommended fix
1. Add ESLint + Prettier checks.
2. Add at least smoke tests for request/accept/session lifecycle.
3. Gate merges with CI checks.

---

## 9) Security rules posture unclear from repo root — **High**

### What I found
- There is a Firestore rules document template in docs, but no clearly enforced production ruleset in this review path.

### Why it matters
- Request/session/payment docs are highly sensitive and must be tightly constrained.

### Recommended fix
- Verify deployed Firestore/Storage rules for:
  - ownership checks,
  - tutor/student role access boundaries,
  - immutable financial fields,
  - admin-only write paths.

---

## 10) Polling/timer density could hurt performance on long sessions — **Medium**

### What I found
- Multiple 250ms/1000ms/5000ms timers exist across request and tutor pages + overlays.

### Why it matters
- Increased CPU wake-ups and battery/network cost, especially on low-end devices.

### Recommended fix
- Prefer event-driven updates from realtime snapshots.
- Keep a single shared clock source for countdown UIs if needed.

---

## 11) Immediate launch priorities (ordered)

1. **Backend-authoritative request state machine** for create/match/offer/accept/timeout/decline.
2. Remove frontend status mutation loops and keep listeners read-only.
3. Add idempotent accept endpoint and offer token/version checks.
4. Add observability: request timeline logs + correlation id for each request lifecycle.
5. Add CI quality gates (lint + lifecycle integration tests).

---

## 12) Suggested rollout plan

### Phase 1 (stability hotfix)
- Freeze current UI, patch lifecycle orchestration into backend, and disable client-side mutation loops.

### Phase 2 (hardening)
- Add deterministic retry strategy, dead-letter handling for stuck requests, and operational dashboard views.

### Phase 3 (launch readiness)
- Add SLO alerts for: request->offer latency, offer->accept success rate, and timeout/error rates.

---

## 13) Notes on your reported bug

Given this codebase, the flickering/request reset behavior is most likely from **concurrent frontend status rewrites** and **timer-driven refreshes** that race with accept/timeout transitions. Moving lifecycle transitions to backend authority is the most reliable long-term fix.

---

## 14) Production build currently fails — **Critical**

### What I found
- `npm run build` fails because Rollup/Vite cannot resolve `tldraw/tldraw.css` imported from `src/components/app/TldrawSdkEmbed.jsx`.

### Why it matters
- This blocks production deployment and indicates dependency/import path mismatch.

### Recommended fix
1. Validate installed `tldraw` package version and the correct CSS import path for that version.
2. Align import path to official package docs for the pinned version.
3. Add CI build check so this is caught before release.

### VERY VERY IMPORTANT: 
## - Below is a Phase by Phase One task at a Time fixing plan.
## - Make sure you mark this file when done with the phase so that the next phase can continue where you left off.
## - The suggested files should not be your only focus, so please make sure you always get full context before proceeding with any work. Never base your work on Assumptions, always be sure and if not sure get more context from other files before moring forward.
## - ALWAYS ASK WHEN NOT SURE, THIS IS EXTREMELY IMPORTANT, NEVER NEVER AND NEVER EVER ASSUME AND WORK WITH ASSUMPTIONS.
## - NEVER AND NEVER EVER TOUCH CODE THAT'S UNRELATED TO ANY OF THESE FIXES UNLESS REALLY REALLY NECESSARY AND ALWAYS ASK IF NOT SURE.
## - THE GOLDEN RULE IS ALWAYS ASK WHEN UNSURE.


# Claxi Bug Fix Plan (Phase-by-Phase, One Task at a Time)

Use this file as the **single execution plan** for future AI chats.

## Rules for execution (important)
1. **Do only ONE phase per chat/session.**
2. Do not start the next phase until the current phase is reviewed and approved.
3. After finishing a phase, update its status from `NOT STARTED` to `DONE`.
4. If work is partially complete, mark as `IN PROGRESS` and list exactly what remains.
5. Keep all code changes limited to the files listed in that phase unless approval is given.

## Status legend
- `NOT STARTED`
- `IN PROGRESS`
- `DONE`
- `BLOCKED`

---

## Phase 01 — Backend-authoritative request lifecycle (Critical)
**Status:** `DONE` ✅

### Problem
Request matching/offer transitions are currently driven from frontend timers/listeners, causing flicker and race conditions.

### Goal
Move request lifecycle transitions to backend authority and make frontend listeners read-only.

### Scope (expected)
- Introduce/extend backend handlers (Cloud Functions) for lifecycle transitions.
- Stop frontend from performing status mutation loops for matching/offers.
- Keep only action calls from frontend (create/accept/decline/cancel).

### Suggested files
- `functions/index.js`
- `src/services/classRequestService.js`
- `src/hooks/useClassRequests.js`

### Definition of done
- No frontend interval-based lifecycle mutation remains for active request transitions.
- Lifecycle transitions are atomic/idempotent on backend.
- Student/tutor status no longer oscillates between matching/found/retry states due to client loops.

### Validation checks
- Create request -> offer -> accept flow runs once without status flicker.
- Timeout flow transitions once and does not re-open stale offers.

### Phase 01 completion notes ✅
#### What was implemented
- Added a backend lifecycle authority trigger (`syncClassRequestLifecycle`) in Cloud Functions to process active request transitions (`pending`, `matching`, `offered`, `no_tutor_available`) and assign/expire offers server-side.
- Removed frontend interval-based lifecycle mutation loops from request subscriptions.
- Updated tutor-offer subscriptions to be read-only listeners (no client-side timeout/status mutation).
- Updated request creation flow (Firebase mode) so frontend no longer initializes matching/offers; backend trigger now owns those transitions.

#### Expected behavior after this phase
- Frontend should only render realtime state and send explicit user actions (create/accept/decline/cancel).
- Request status should no longer oscillate due to multiple client polling loops.
- Offer timeout progression should be handled by backend-triggered lifecycle updates.

#### Commands to run / deploy steps
- Install dependencies (if needed): `npm install`
- Frontend check: `npm run build`
- Deploy updated Cloud Functions so backend lifecycle authority is active:
  - `firebase deploy --only functions`

#### Configuration notes
- Firebase project and CLI auth must be configured before deploy.
- No additional Firebase environment variable injection was required for this phase.

---

## Phase 02 — Accept/timeout race hardening (Critical)
**Status:** `DONE` ✅

### Problem
Tutor accept can race with timeout/decline logic near offer expiry.

### Goal
Guarantee deterministic accept behavior with idempotency and offer version checks.

### Scope (expected)
- Add offer token/revision validation on accept.
- Ensure timeout handler cannot cancel a successfully accepted offer.
- Add idempotency guard for repeated accept calls.

### Suggested files
- `functions/index.js`
- `src/services/classRequestService.js`

### Definition of done
- Duplicate accept clicks do not create duplicate side effects.
- Near-expiry accept produces deterministic success/failure once.

### Validation checks
- Simulate multiple accept attempts for the same offer.
- Simulate accept at countdown end and confirm consistent result.

### Phase 02 completion notes ✅
#### What was implemented
- Added backend-issued offer identity fields during lifecycle offer assignment:
  - `offerRevision` (monotonic increment per new offer)
  - `offerToken` (unique UUID per offer)
- Extended accept transaction hardening in `classRequestService`:
  - Accept now fails deterministically when `offerExpiresAt <= now`.
  - Accept now rejects stale offers that are missing `offerToken`.
  - Accepted records now persist `acceptedOfferRevision` and `acceptedOfferToken` for traceability.
- Added in-flight idempotency guard in frontend service for tutor offer responses:
  - Duplicate concurrent `accept`/`decline` calls for the same `requestId+tutorId+response` return the same Promise and do not trigger duplicate side effects.

#### Expected behavior after this phase
- Repeated rapid accept clicks should no longer produce duplicate accept side effects.
- Accept near expiry should resolve deterministically:
  - success if processed before expiry,
  - explicit failure (`This offer has expired.`) if processed after expiry.
- Offer acceptance now ties to backend-issued offer identity metadata for safer state transitions.

#### Commands to run / deploy steps
- Install dependencies (if needed): `npm install`
- Frontend check: `npm run build`
- Deploy updated Cloud Functions so new offer token/revision fields are issued:
  - `firebase deploy --only functions`

#### Configuration notes
- Firebase project and CLI authentication must be configured before deploy.
- No new environment variables were required for this phase.

---

## Phase 03 — Single tutor-offer action surface (High)
**Status:** `DONE` ✅

### Problem
Tutor can respond from multiple UI surfaces (overlay + page), increasing duplicate actions/races.

### Goal
Allow exactly one active action surface for live offers.

### Scope (expected)
- Keep one primary action path.
- Disable/lock secondary path while an offer action is in-flight.

### Suggested files
- `src/components/app/TutorOfferOverlay.jsx`
- `src/pages/app/tutor/AvailableRequestsPage.jsx`

### Definition of done
- One offer has one actionable control path at a time.
- No duplicate accept/decline calls from parallel UI elements.

### Validation checks
- Offer appears once effectively; second surface cannot submit duplicate action.

### Phase 03 completion notes ✅
#### What was implemented
- Kept `TutorOfferOverlay` as the single actionable live-offer surface for tutor accept/decline actions.
- Updated `AvailableRequestsPage` to become a read-only realtime mirror of the same offer stream:
  - Removed page-level accept/decline handlers and related action service calls.
  - Removed page-level navigation/session lookup side effects from offer response actions.
  - Replaced page action buttons with a non-interactive “Respond in overlay” indicator.
- Added explicit tutor-facing UX messaging on `AvailableRequestsPage` that actions are intentionally disabled there to prevent duplicate submissions.

#### Expected behavior after this phase
- Tutors can only submit offer responses from `TutorOfferOverlay`.
- `AvailableRequestsPage` still shows live offer context (including countdown), but cannot issue accept/decline writes.
- Parallel UI elements no longer trigger duplicate accept/decline calls for the same offer.

#### Commands to run / deploy steps
- Install dependencies (if needed): `npm install`
- Frontend check: `npm run build`

#### Configuration notes
- No Firebase env injection or Cloud Functions deployment is required for this phase.

---

## Phase 04 — Timeout UX consistency (Medium)
**Status:** `DONE` ✅

### Problem
UI copy says 10 seconds in places while logic uses 30 seconds.

### Goal
Render timeout duration from one shared source of truth.

### Scope (expected)
- Centralize offer timeout constant and all related labels/tooltips.

### Suggested files
- `src/services/classRequestService.js`
- `src/pages/app/tutor/AvailableRequestsPage.jsx`
- any other offer countdown UI component(s)

### Definition of done
- All user-facing timeout text matches actual timeout behavior.

### Validation checks
- Compare countdown UI text with configured timeout constant.

### Phase 04 completion notes ✅
#### What was implemented
- Added shared timeout constants in lifecycle constants:
  - `OFFER_TIMEOUT_SECONDS`
  - `OFFER_TIMEOUT_MS` (derived from seconds)
- Updated class request service to use the shared timeout constants for:
  - offer expiry timestamp assignment,
  - tutor offer notification copy (`Accept within X seconds`).
- Updated tutor-offer UI surfaces to render timeout messaging from the same shared source:
  - `TutorOfferOverlay` progress calculation now uses `OFFER_TIMEOUT_SECONDS`.
  - `TutorOfferOverlay` now explicitly displays “Offers expire after X seconds.”
  - `AvailableRequestsPage` banner now references the same shared timeout seconds value.

#### Expected behavior after this phase
- All tutor-offer timeout text is sourced from one shared constant.
- If timeout duration changes in the future, messaging and countdown/progress behavior stay aligned automatically.
- Tutors see consistent timeout expectations across the overlay, list context, and notifications.

#### Commands to run / deploy steps
- Install dependencies (if needed): `npm install`
- Frontend check: `npm run build`

#### Configuration notes
- No Firebase environment variable injection required for this phase.
- No Cloud Functions deployment is required unless you want the updated tutor notification copy live in Firebase mode.

---

## Phase 05 — Remove production debug logs (Medium)
**Status:** `NOT STARTED`

### Problem
Direct console logs exist in live request status page.

### Goal
Remove or DEV-gate noisy logs.

### Scope (expected)
- Replace direct `console.log` with gated debug utility or remove.

### Suggested files
- `src/pages/app/student/StudentRequestStatusPage.jsx`
- `src/utils/devLogger.js`

### Definition of done
- No unconditional console noise from request status path in production.

### Validation checks
- Open status page in production mode; no debug spam in console.

---

## Phase 06 — Environment safety (mock fallback hardening) (High)
**Status:** `DONE` ✅

### Problem
App can silently fall back to mock mode if Firebase env is missing.

### Goal
Fail safely in production when required env is missing.

### Scope (expected)
- Add explicit production env validation.
- Show blocking config error screen in production misconfig.

### Suggested files
- `src/firebase/config.js`
- app bootstrap entry / route shell for config errors

### Definition of done
- Production build/runtime does not silently use mock mode.

### Validation checks
- Start app with missing env in production mode and confirm blocking error behavior.

### Phase 06 completion notes ✅
#### What was implemented
- Added strict Firebase environment validation in `src/firebase/config.js` for required production keys:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_APP_ID`
- Added `FirebaseConfigError` and production-only hard-fail guards so `getFirebaseClients()` no longer silently returns mock mode when Firebase configuration is missing/invalid in production.
- Added production bootstrap guard in `src/main.jsx`:
  - If required Firebase env vars are missing in production, app now renders a blocking configuration error screen.
  - Blocking screen clearly lists missing variables so deployment misconfiguration is visible immediately.

#### Expected behavior after this phase
- Production builds will not silently fall back to local mock mode when Firebase env values are missing.
- Missing production Firebase configuration now blocks app startup with a clear user-facing error screen.
- In non-production environments, existing local mock fallback behavior remains available for development workflows.

#### Commands to run / deploy steps
- Install dependencies (if needed): `npm install`
- Frontend production check: `npm run build`
- Serve production build for verification (example): `npm run preview`

#### Configuration notes
- Ensure all required Firebase Vite env vars are injected in production deployment:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_APP_ID`
- If any required key is absent, the app will intentionally show a blocking configuration error screen in production.

---

## Phase 07 — Build blocker fix: `tldraw` CSS import (Critical)
**Status:** `NOT STARTED`

### Problem
`npm run build` currently fails because `tldraw/tldraw.css` cannot be resolved.

### Goal
Make production build pass.

### Scope (expected)
- Align `tldraw` import path to installed version docs.
- Update dependency/version if necessary.

### Suggested files
- `src/components/app/TldrawSdkEmbed.jsx`
- `package.json` (if version change required)

### Definition of done
- `npm run build` succeeds.

### Validation checks
- Run `npm run build` and confirm pass.

---

## Phase 08 — Quality gates (lint/tests/CI) (High)
**Status:** `NOT STARTED`

### Problem
No lint/test scripts in root package; regressions are easy to introduce.

### Goal
Introduce minimum automated checks for safe iteration.

### Scope (expected)
- Add lint script.
- Add at least one lifecycle smoke/integration test path.
- Add CI workflow to run checks.

### Suggested files
- `package.json`
- test config/files
- CI workflow file(s)

### Definition of done
- PR checks fail on lint/build/test regressions.

### Validation checks
- Run lint/build/tests locally and in CI.

---

## Phase 09 — Security rules verification (High)
**Status:** `NOT STARTED`

### Problem
Rules posture for sensitive request/session/payment data must be verified before launch.

### Goal
Confirm and enforce least-privilege Firestore/Storage rules.

### Scope (expected)
- Validate deployed rules for user ownership and role boundaries.
- Ensure financial fields are protected from client-side mutation.

### Suggested files
- Firestore rules files (repo/deployment)
- Storage rules files (repo/deployment)
- `docs/firestore-user-rules.md` (if documentation updates needed)

### Definition of done
- Rules reviewed and tested against unauthorized read/write attempts.

### Validation checks
- Emulator or scripted rules tests for allowed and denied cases.

---

## Phase 10 — Timer/polling performance cleanup (Medium)
**Status:** `DONE` ✅

### Problem
High timer density (250ms/1s/5s) can create unnecessary CPU/network load.

### Goal
Reduce timers; prefer event-driven updates.

### Scope (expected)
- Consolidate countdown clock usage.
- Remove unnecessary polling where realtime snapshots already exist.

### Suggested files
- `src/components/app/TutorOfferOverlay.jsx`
- `src/pages/app/tutor/AvailableRequestsPage.jsx`
- `src/services/classRequestService.js`

### Definition of done
- Noticeably fewer recurring timers while preserving UX responsiveness.

### Validation checks
- Compare timer count before/after and verify offer/session UX still updates correctly.

### Phase 10 completion notes ✅
#### What was implemented
- Reduced `TutorOfferOverlay` timer frequency from `250ms` to `1000ms`.
- Updated `TutorOfferOverlay` clock behavior so the countdown timer is only active while a live `displayRequest` exists, instead of running continuously.
- Removed the recurring `setInterval` clock from `AvailableRequestsPage` (read-only mirror view).
- Replaced per-second countdown text on `AvailableRequestsPage` with an event-driven expiry timestamp label (`Expires at HH:MM:SS`), so no page-level timer is needed.

#### Expected behavior after this phase
- Total recurring timer load across tutor offer surfaces is reduced.
- `TutorOfferOverlay` remains responsive for actionable countdown UX, with lower update frequency and only when needed.
- `AvailableRequestsPage` remains realtime via snapshot updates while avoiding additional client clock intervals.

#### Commands to run / deploy steps
- Install dependencies (if needed): `npm install`
- Frontend production check: `npm run build`

#### Configuration notes
- No Firebase environment variable injection required for this phase.
- No Cloud Functions deployment required for this phase.

---

## Execution template for future AI chats
When starting a new chat, use this exact instruction format:

1. "Execute **Phase XX only** from `bugs-to-fix.md`."
2. "Do not work on any other phase."
3. "After implementation, set Phase XX status to `DONE` (or `IN PROGRESS` with remaining items)."
4. "Provide tests run, risks, and rollback notes."

This ensures one-phase-at-a-time delivery with review/approval between phases.
