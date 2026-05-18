# Claxi Dynamic Pricing Engine — Implementation Plan

## Objective
Evolve Claxi’s existing fixed-rate billing into a backend-authoritative dynamic pricing engine that remains stable most of the time, supports low/normal/high pricing conditions, and preserves existing request/session/billing flows.

This plan is written for the current codebase (Firebase Functions + Firestore + React frontend), and assumes **pricing already exists** and must be migrated safely.

---

## Current-State Summary (from code audit)

### What exists today
- Pricing is currently hard-coded at **R5/min** in both frontend/shared constants and backend Functions logic.
- Session billing is finalized by `finalizeSessionBilling` (HTTP Cloud Function) and also duplicated in frontend/local fallback paths.
- `classRequests` and `sessions` are already used as lifecycle anchors, with billing fields (`billedSeconds`, `totalAmount`, `payoutBreakdown`, `paymentStatus`) written on session completion.
- Student request UI currently advertises a static “Request R5/min” label.
- Session/request records do **not** currently persist a rich pricing quote snapshot (band, multipliers, etc.).

### Why this matters for migration
- Multiple locations currently compute price; this risks divergence.
- Existing sessions and admin/tutor reports depend on current `totalAmount` and payout fields.
- Dynamic pricing must be introduced as additive + versioned first, then promoted to authoritative once parity and safety checks pass.

---

## Target Pricing Principles

1. **Backend authoritative**: frontend never computes trusted amount.
2. **Stable pricing**: default to normal band; low/high only with clear triggers.
3. **Transparent quote**: return band, components, multipliers, and UI explanation label.
4. **Locked-at-booking snapshot**: session/request stores immutable pricing snapshot for auditability.
5. **Final billing from locked snapshot + actual duration**: avoid retroactive config drift.
6. **Incremental rollout**: shadow compare old vs new before full cutover.

---

## Baseline Model to Implement

### Band defaults
- **Low**: base R11.00, rate R1.65/min
- **Normal**: base R12.00, rate R1.80/min
- **High**: base R14.00, rate R2.20/min

### Core formula (quoted amount)
`quoted_total = roundCurrency((base + (rate_per_minute * duration_minutes)) * subject_multiplier * demand_multiplier * availability_multiplier * time_multiplier * season_multiplier)`

### Guardrails
- Subject multiplier should remain modest (e.g., 0.95–1.10 range target, configurable).
- Clamp net dynamic multiplier to prevent spikes (example: min 0.90, max 1.25 during first rollout).
- Prefer banding + smoothing over volatile real-time surge.

---

## Backend vs Frontend Responsibilities

### Backend (authoritative)
- Compute quote using config + runtime signals.
- Return quote payload (band, factors, totals, explanation label).
- Lock quote snapshot for request/session.
- Compute final amount using locked quote + measured billed minutes/seconds.
- Persist audit trail + structured logs for each pricing decision.

### Frontend (display only)
- Request quote from backend for selected duration/subject.
- Render returned totals/band/explanation.
- Submit booking with quote token/id only (not numeric totals).
- Display locked price in request/session UI from stored snapshot.

---

## Suggested Firestore Pricing Data Model

> Keep exact collection paths configurable, but start with this concrete proposal.

### 1) Global pricing config
`systemConfig/pricingEngine`

Recommended fields:
- `activeVersion: "v2"`
- `mode: "shadow" | "active" | "rollback_old"`
- `quoteTtlSeconds: 300`
- `currency: "ZAR"`
- `rounding: { strategy: "2dp_half_up" }`
- `bands: { low: { base, ratePerMinute }, normal: {...}, high: {...} }`
- `bandSelection: { demandThresholds, availabilityThresholds, timeWindows, seasonWindows }`
- `multiplierCaps: { minTotalMultiplier, maxTotalMultiplier }`
- `explanationLabels: { low, normal, high }`
- `rollout: { enabledSubjects, enabledRegions, percentTraffic }`
- `updatedAt`, `updatedBy`

### 2) Subject multipliers
Option A (embedded): `systemConfig/pricingEngine.subjectMultipliers`
Option B (separate): `pricingSubjectMultipliers/{subject}`

Fields:
- `subject`
- `multiplier`
- `effectiveFrom`, `effectiveTo`
- `notes`

### 3) Seasonal multipliers
`pricingSeasonCalendar/{seasonId}`

Fields:
- `label` (e.g., exam_season_term_2)
- `startAt`, `endAt`
- `multiplier`
- `priority`
- `enabled`

### 4) Quote records (optional but recommended)
`pricingQuotes/{quoteId}` (TTL cleanup enabled)

Fields:
- `requestContext` (studentId, subject, durationMinutes, requestedAt)
- `quote` (full pricing payload)
- `lockedUntil`
- `engineVersion`
- `status: active|consumed|expired`

### 5) Locked snapshot on request/session
Add `pricingSnapshot` to `classRequests/{id}` and `sessions/{id}`:
- `engineVersion`
- `quoteId` (if used)
- `band`
- `baseAmount`
- `ratePerMinute`
- `durationMinutesQuoted`
- `multipliers` object (subject, demand, availability, timeOfDay, season, net)
- `explanationLabel`
- `quotedTotal`
- `currency`
- `lockedAt`
- `lockExpiresAt` (if temporary lock)
- `finalizationRules` (rounding, min billable seconds, etc.)

---

## API/Function Contract Proposal

### New endpoint/function (Phase 2)
`POST /pricing/quote` (or Firebase callable/HTTP function)

Request:
- `subject`
- `durationMinutes`
- `studentId` (validated from auth)
- optional context (`region`, `preferredTime`, etc.)

Response:
- `quoteId`
- `engineVersion`
- `pricingBand` (`low|normal|high`)
- `baseAmount`
- `ratePerMinute`
- `durationMinutes`
- `multipliers`: `{ subject, demand, availability, timeOfDay, season, net }`
- `subtotalBeforeMultipliers`
- `totalAmount`
- `currency`
- `explanationLabel` (e.g., “Standard pricing”)
- `quotedAt`
- `lockExpiresAt`

### Final billing behavior
`finalizeSessionBilling` (existing) should:
1. Load session’s locked `pricingSnapshot`.
2. Compute billable duration from timestamps.
3. Recalculate total using locked base/rate/multipliers and final duration policy.
4. Persist `finalAmount`, `quotedAmount`, `pricingDelta` (if any), payout breakdown.
5. Never fetch live pricing config during finalization for already-locked sessions.

---

## Phase Plan

## Phase 0 — Audit Current Pricing Implementation

### Goal
Produce an exact inventory of all pricing logic and data paths before implementation.

### Scope
- Frontend displays, request creation payloads, session room billing indicators.
- Backend function billing calculation + payment charge path.
- Firestore fields currently used in `classRequests`/`sessions`.
- Mock-mode billing paths that may diverge.

### Files/modules likely affected
- Inspect and document exact current file paths, including:
  - `functions/index.js`
  - `src/services/sessionService.js`
  - `src/services/classRequestService.js`
  - `src/utils/onboarding.js`
  - student/tutor/admin payment display pages

### Implementation tasks (checklist)
- [ ] Enumerate every pricing constant and duplicate calculation.
- [ ] Document all write points for `totalAmount`, `billedSeconds`, `payoutBreakdown`, `paymentStatus`.
- [ ] Map request -> session -> billing lifecycle fields.
- [ ] Identify all UI strings that imply static pricing.
- [ ] Produce migration compatibility matrix (old fields vs new fields).

### Risks / edge cases
- Hidden duplicate calculators (frontend fallback + backend).
- Duration represented as free text (`"Per-minute billing"`) instead of numeric minutes.

### Testing requirements
- Build a baseline fixture set from current behavior (R5/min).
- Capture current end-session outputs for regression comparison.

### Rollout considerations
- No behavior change in Phase 0; documentation + test baseline only.

### Deliverables
- Pricing audit doc section appended to this file (or separate artifact).
- Current-state data model map.

### Acceptance criteria
- Team can point to one canonical list of current pricing touchpoints.
- No unknown pricing write path remains.

---

## Phase 1 — Design Target Pricing Domain Model and Config

### Goal
Define versioned pricing schema + decision model without switching runtime behavior yet.

### Scope
- Config schema in Firestore + backend defaults.
- Quote payload contract and lock semantics.
- Backward compatibility for existing session docs.

### Files/modules likely affected
- New backend pricing domain module(s) (exact paths to choose after inspection).
- Firestore config seed script or admin utility.
- Shared type/schema docs in `docs/`.

### Implementation tasks (checklist)
- [ ] Define `pricingEngine` config schema and validation.
- [ ] Encode band presets (low/normal/high) with provided base/rate values.
- [ ] Define subject multiplier table (small bounded adjustments).
- [ ] Define demand/availability/time/season factor schema + caps.
- [ ] Define quote lock TTL + expiry behavior.
- [ ] Define snapshot schema for `classRequests` and `sessions`.
- [ ] Define engine versioning (`v1_fixed`, `v2_dynamic`).

### Risks / edge cases
- Overfitting factor logic before real metrics exist.
- Inconsistent rounding between quote and final billing.

### Testing requirements
- Schema validation tests for config documents.
- Deterministic formula tests per band and duration matrix.

### Rollout considerations
- Keep config in `shadow` mode by default.
- Fail-safe fallback to existing fixed pricing if config missing/corrupt.

### Deliverables
- Pricing schema spec.
- Seed/default config documents.
- Decision table for band selection.

### Acceptance criteria
- Backend can load/validate config successfully.
- Example matrix reproduces agreed values for low/normal/high table.

---

## Phase 2 — Build Backend Pricing Engine in Parallel with Existing Logic

### Goal
Implement new quote engine and run it alongside legacy billing without affecting charges.

### Scope
- New backend pricing service.
- New quote endpoint.
- Shadow-comparison logging against old calculator.

### Files/modules likely affected
- `functions/index.js` (or extracted modules under `functions/`)
- Potential new modules e.g. `functions/pricing/engine.js`, `functions/pricing/config.js`, `functions/pricing/quote.js`
- Optional local mock equivalents for dev parity

### Implementation tasks (checklist)
- [ ] Add pure pricing engine function (`computeQuote(context, config)`).
- [ ] Add runtime signal adapters:
  - [ ] demand signal source (active requests vs online tutors)
  - [ ] availability signal
  - [ ] time-of-day bucket
  - [ ] season resolver
- [ ] Add quote endpoint with auth + input validation.
- [ ] Return full quote payload including explanation label.
- [ ] In shadow mode, compute both old and new and log delta.
- [ ] Add feature flags to control active/shadow path.

### Risks / edge cases
- Demand/availability metrics may be noisy or stale.
- Quote generation latency during high traffic.

### Testing requirements
- Unit tests for each multiplier resolver.
- Snapshot tests for agreed minute table and expected totals.
- Error-path tests (missing config, invalid subject/duration).

### Rollout considerations
- Enable for internal users only first.
- Keep all billing finalization on old logic until Phase 3/6 gate.

### Deliverables
- Deployable quote API in shadow mode.
- Structured logs for old-vs-new comparisons.

### Acceptance criteria
- Quote endpoint stable under load tests.
- Shadow deltas are within expected threshold for normal traffic.

---

## Phase 3 — Integrate Pricing Quotes into Request/Session Creation Flow

### Goal
Lock a backend quote into request/session records at booking time.

### Scope
- Request creation path obtains quote before creating request.
- Accepted request/session stores immutable `pricingSnapshot`.
- Billing finalization reads locked snapshot.

### Files/modules likely affected
- `src/services/classRequestService.js`
- Backend request/session creation handlers
- `functions/index.js` finalization path
- Firestore record schemas for `classRequests` + `sessions`

### Implementation tasks (checklist)
- [ ] Add pre-request quote call.
- [ ] Store `quoteId`/`pricingSnapshot` on request document.
- [ ] Copy locked snapshot to session on accept (or reference immutable quote).
- [ ] Update finalization function to bill from locked snapshot.
- [ ] Preserve legacy fields (`totalAmount`, `payoutBreakdown`) for compatibility.
- [ ] Add idempotency handling for repeated finalize attempts.

### Risks / edge cases
- Quote expiry between request submit and tutor acceptance.
- Session created without snapshot due to partial failures.

### Testing requirements
- Integration tests: quote -> request -> accept -> session -> finalize.
- Race-condition tests around quote expiration and retries.

### Rollout considerations
- Initially enforce snapshot only for flagged cohorts.
- If snapshot missing, fallback to legacy calculator + alert log.

### Deliverables
- End-to-end flow with locked quote snapshot.

### Acceptance criteria
- All flagged new sessions have valid `pricingSnapshot`.
- Final billed amount reproducible from snapshot + duration.

---

## Phase 4 — Update Frontend Surfaces to Consume Backend Quotes

### Goal
Remove trusted frontend pricing logic and display backend quote details across student/tutor/admin views.

### Scope
- Student request form quote preview.
- Request status/session detail display of locked quote/band/label.
- Tutor/admin payout/exception pages show quote metadata when relevant.

### Files/modules likely affected
- `src/pages/app/student/StudentDashboardPage.jsx`
- `src/pages/app/student/StudentRequestStatusPage.jsx`
- `src/components/app/TutorOfferOverlay.jsx`
- `src/pages/app/SessionRoomPage.jsx`
- `src/pages/app/tutor/TutorPaymentsPage.jsx`
- `src/pages/app/admin/AdminPaymentsPage.jsx`
- Shared frontend service module for quote fetch

### Implementation tasks (checklist)
- [ ] Replace static “R5/min” copy with quote-driven display.
- [ ] Add duration selector tied to quote requests.
- [ ] Show explanation label and pricing band in UI.
- [ ] Show lock-expiry countdown if quote lock is temporary.
- [ ] Ensure frontend submits quote token/id, not totals.

### Risks / edge cases
- UI mismatch when quote expires mid-form.
- Caching stale quote response client-side.

### Testing requirements
- Component tests for low/normal/high display states.
- UX tests for expired quote refresh behavior.

### Rollout considerations
- Keep fallback display (`Standard pricing`) if quote fields absent.

### Deliverables
- Quote-aware request flow and pricing UI components.

### Acceptance criteria
- No frontend code path computes authoritative total.
- Student/tutor sees consistent locked pricing details.

---

## Phase 5 — Admin/Config Controls, Observability, Safeguards

### Goal
Provide operational controls and debugging visibility before broad rollout.

### Scope
- Config update workflows.
- Pricing decision logs + metrics.
- Safeguards against runaway multipliers.

### Files/modules likely affected
- Backend logging/telemetry modules
- Admin tools/pages (existing admin payments area + new pricing controls)
- Potential scripts for config promotion/rollback

### Implementation tasks (checklist)
- [ ] Add structured pricing log event on quote + finalize.
- [ ] Include decision factors and source metrics in logs.
- [ ] Add alert thresholds (e.g., high-band > X% of quotes, avg price jump > Y%).
- [ ] Add config validation + dry-run check before activation.
- [ ] Add one-click rollback to legacy mode.

### Risks / edge cases
- Sensitive data leakage in logs.
- Accidental config activation without validation.

### Testing requirements
- Log contract tests (required fields present).
- Chaos tests for invalid config and rollback behavior.

### Rollout considerations
- Restrict config write access to admin role/service account.

### Deliverables
- Pricing observability dashboard spec + alerts.
- Safe config deployment runbook.

### Acceptance criteria
- On-call can diagnose “why this quote?” within minutes.
- Rollback can be completed without code deploy.

---

## Phase 6 — Test, Shadow Compare, Migrate, Roll Out

### Goal
Migrate traffic gradually from legacy fixed-rate to new dynamic engine with measurable safety.

### Scope
- Shadow mode, internal beta, limited cohort, full rollout.

### Rollout sequence
1. **Shadow mode** (0% user impact): compute/log new quote alongside old.
2. **Internal testing**: staff/test accounts use new quote + snapshot locking.
3. **Limited rollout**: small % of production traffic by subject/region/user cohort.
4. **Progressive expansion**: ramp while monitoring metrics and exceptions.
5. **Full rollout**: set `mode=active`, retain rollback toggle.

### Implementation tasks (checklist)
- [ ] Define KPI thresholds (quote latency, conversion, payment exception rate, avg billed amount delta).
- [ ] Build old-vs-new comparison report.
- [ ] Run migration script/backfill for optional new fields on active sessions.
- [ ] Validate historical session reporting compatibility.

### Risks / edge cases
- Conversion drop if prices move too quickly.
- Legacy sessions missing pricingSnapshot during switchover.

### Testing requirements
- End-to-end staging tests with real function invocations.
- Snapshot regression tests against approved minute table.
- Payment failure path tests remain intact.

### Rollout considerations
- Freeze config changes during each ramp step.
- Daily review during first two weeks after activation.

### Deliverables
- Go-live checklist + sign-off.
- Post-rollout monitoring report.

### Acceptance criteria
- Billing correctness incidents: zero critical.
- Dynamic engine active for 100% target traffic with stable metrics.

---

## Testing Strategy (Cross-Phase)

### Unit tests
- Formula correctness for base/rate/duration.
- Multiplier resolvers and caps.
- Band selection logic.
- Rounding behavior consistency.

### Integration tests
- Quote creation with auth + valid/invalid payloads.
- Request/session creation with locked quote.
- Session finalization using snapshot and payout split.

### Pricing snapshot/table tests
- Assert agreed table outputs for 10/15/20/.../90 minute durations across low/normal/high.
- Include exact expected totals and rounding.

### Edge-case suite
- Duration bounds (min/max).
- Quote expiry and refresh.
- Missing/unknown subject fallback.
- High demand but no tutors online.
- Session finalized twice (idempotency).
- Legacy session with no pricingSnapshot.

---

## Observability & Debugging Guidance

For each quote/finalize event, log structured fields:
- `eventType`: `pricing_quote_generated` | `pricing_billing_finalized`
- `engineVersion`, `mode`
- `requestId`, `sessionId`, `quoteId`
- Input context (`subject`, `durationMinutes`, time bucket)
- Signals (`demandScore`, `availabilityScore`, `seasonKey`)
- Selected `band`
- Component values (`base`, `rate`, individual multipliers)
- Totals (`quotedTotal`, `finalTotal`, `deltaFromLegacy`)
- `explanationLabel`
- Processing latency

Add dashboards/alerts for:
- Quote error rate
- Quote latency p95
- Band distribution over time
- Avg billed amount by subject/duration
- Wallet debt / payment exception rate

---

## Migration Compatibility Notes

- Keep writing existing fields (`totalAmount`, `payoutBreakdown`, `paymentStatus`) so tutor/admin pages continue to function.
- Add new fields additively (`pricingSnapshot`, `quoteId`, `engineVersion`) before removing legacy assumptions.
- Do not retroactively recompute historical sessions; treat stored snapshots as source of truth.

---

## Non-Goals

- Rebuilding payment gateway architecture.
- Replacing Firestore with another data store.
- Fully automated ML surge pricing in initial release.
- Large subject-based price jumps.
- Retroactive repricing of completed sessions.

---

## Open Questions / Assumptions Requiring Code Inspection Decisions

1. **Duration model**: request payload currently uses string durations (e.g., “Per-minute billing”); should duration become explicit numeric minutes at quote time?
2. **Subject source-of-truth**: request/session currently defaults to Mathematics in several paths; where should multi-subject selection be enforced?
3. **Demand/availability signal source**: should metrics be computed from live Firestore counts, cached aggregates, or scheduled materialized stats?
4. **Quote lock policy**: lock at request creation only, or refresh/relock at tutor acceptance?
5. **Fallback behavior**: when pricing config unavailable, should fallback be legacy fixed pricing or “no quote, block request” for safety?
6. **Mock mode parity**: should local mock mode emulate dynamic pricing or remain fixed for developer simplicity?
7. **Admin UX**: extend existing admin pages or create dedicated pricing operations page?

---

## Immediate Next Steps (Execution-Ready)

- [ ] Complete Phase 0 audit artifact with exact file + function map.
- [ ] Finalize pricing config schema and seed default docs.
- [ ] Implement backend quote engine behind `shadow` mode flag.
- [ ] Add snapshot tests for agreed duration table.
- [ ] Integrate quote lock into request/session creation for internal cohort.
- [ ] Run shadow comparisons for at least 1 week before limited rollout.
