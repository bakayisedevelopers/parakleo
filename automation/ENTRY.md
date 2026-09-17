# Operational Entry Point: Autonomous Development Runs

> **READ THIS FIRST BEFORE TAKING ANY ACTION.**  
> This document defines the mandatory protocol, scope boundaries, and execution rules for all scheduled Antigravity, Codex, or paired AI agent runs operating inside the Parakleo monorepo.

---

## 1. Locked Launch Scope & Classification

All autonomous runs must strictly adhere to the following product scope:

1. **Student & Tutor Mobile Apps are the Only Launch Applications**:
   - [`mobile/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/) (Student Mobile App) and [`tutors/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/) (Tutor Mobile App) are the exclusive primary apps for students and tutors at launch.
   - Initial launch is **strictly focused on in-person tutoring**. All planning, implementation, and testing must prioritize the complete physical tutoring journey across mobile apps and shared Cloud Functions.
2. **Admin Web is the Only Operational Web Application**:
   - [`web/src/pages/app/admin/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/) is the back-office operational surface for tutor document verification, agreements, payments, and platform monitoring. Its authentication and workflows must remain fully active and maintained.
3. **Student-Facing & Tutor-Facing Websites are Public & Informational Only**:
   - The public websites at `/` and `/tutor` explain the service and direct visitors to download the appropriate mobile app APKs.
   - No student or tutor website login, registration, dashboard, booking, or lesson workflow is part of the active launch experience.
   - **Do not delete existing student/tutor web-app code or pages**. Preserve them in the repository for post-launch/legacy use; plan to unlink their entry points from active public navigation and marketing CTAs without impairing the Admin Web app.
4. **Online Tutoring is Preserved for Post-Launch**:
   - WebRTC video/audio rooms, collaborative Tldraw whiteboard canvases, and online lesson rooms are post-launch capabilities.
   - **Do not schedule implementation of online tutoring for initial launch**. Do not delete or refactor existing online lesson code; preserve it intact for later activation.

---

## 2. Confirmed Rules & Architectural Decisions

### Confirmed Launch Rules & Policies (Approved)
- **Travel Surcharge Formula & Allocation**: **R40.00 covers up to 10 km, plus R4.00 per km beyond 10 km**. Allocated **100% to the Tutor** to reimburse out-of-pocket transit expenses without platform deduction.
- **Booking Fee Formula & Allocation**: **1% of lesson-only amount (excluding travel), bounded to R1.00–R2.00 while retaining cents within that range** (e.g., R150 lesson $\rightarrow$ R1.50). Allocated **100% to the Platform** to cover payment gateway charges and infrastructure overhead. Calculated from estimated lesson amount during cancellations; calculated from actual billable lesson amount after attended lessons.
- **Revenue Split**: **73% Tutor / 27% Platform** on applicable billable lesson revenue.
- **Travel Telemetry**: Realtime Database location updates target a **3-second interval** during active travel/tracking states (`status: 'travelling'`). There is no sub-second target.
- **Physical Lesson Unlock (PIN)**: A **4-digit one-time PIN confirmation** generated server-side for the accepted session. **The tutor sees the 4-digit PIN in the Tutor Mobile App; the student enters the 4-digit PIN in the Student Mobile App** upon physical meeting. QR codes are excluded.
- **Billing Clock Start Timing**: PIN verification confirms physical arrival/meeting and initiates a **5-minute preparation grace window** (displayed as a countdown timer for both parties to settle in). The billable time clock (`billingStartedAt`) begins when either the tutor taps "Start Lesson" or when the 5-minute preparation grace elapses.
- **Stage-by-Stage Cancellation Charges**:
  - `requested` / `searching`: R0 to student (no tutor accepted yet).
  - `accepted` (<2 min grace): R0 to student (grace period for accidental taps).
  - `accepted` (>2 min, pre-travel): Booking fee only (R1.00–R2.00) retained by platform.
  - `travelling` (tutor en route): Travel surcharge (100% to tutor) + booking fee (100% to platform). No lesson fee charged.
  - `arrived` / `preparing`: Travel surcharge (100% to tutor) + 30-min minimum lesson fee (73% to tutor / 27% to platform) + booking fee (100% to platform).
  - `in_session` (lesson active): Elapsed billable time (subject to 30-min minimum, 73% tutor / 27% platform) + travel surcharge (100% to tutor) + booking fee (100% to platform).
  - **Tutor-initiated cancellation at any stage**: R0 to student (100% full refund). Reliability record updated.

---

## 3. Protocol for Every Scheduled Implementation Run

Every autonomous worker must execute the following 12-step sequence:

1. **Check State**: Read [`automation/STATE.json`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/STATE.json) and locate the active milestone in [`automation/MASTER_PLAN.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/MASTER_PLAN.md).
2. **Evaluate Stop Conditions & Task-Level Blockers**:
   - **Global Project Pause**: Immediately halt without modifying code if `projectStatus` is `"paused"`, `"blocked"`, or `"completed"`, or if `reviewStatus` is `"awaiting_plan_review"`.
   - **Task-Level Blockers vs Global Pause**: Do not confuse task-level blockers (e.g., missing Navigation SDK API key in `ACT-002` or Paystack secret key in `ACT-003`) with a global project pause. A task-level blocker only prevents execution of the specific dependent task (e.g. real-device navigation testing in `M3`). If independent, non-blocked tasks remain within the milestone or across other apps, proceed with those eligible tasks rather than pausing the entire repository.
   - **M7 Human Verification Gate Rule**: `ACT-004` / `[M7-T2-DUAL-DEVICE-VERIFICATION]` is a final physical-device release gate only. It must not block implementation of independent M7 stabilization, bug-fix, onboarding, promotion/referral, tutor verification, Admin Web, or agreement tasks. If `ACT-004` is pending and any open M7 implementation task remains, skip the physical-test task and select the next eligible implementation task.
   - Halt if another worker lock is active.
3. **Review Human Action Inbox**: Read [`automation/USER_ACTIONS.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/USER_ACTIONS.md). Never guess credentials or fake verification.
4. **Check Approved Feature Changes**: Check [`automation/FEATURE_REQUESTS.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/FEATURE_REQUESTS.md) for newly approved features or scope modifications. Incorporate only features marked `"approved"`. Approved feature requests with `Launch Scope Classification: required_initial_launch` are eligible implementation work and must be considered before declaring a milestone blocked by human verification.
5. **Read Only Required Context**: Do not dump the entire repository into context. Read only the active milestone, referenced feature IDs in `automation/features/`, supporting app-plan sections in `automation/plans/`, and necessary source files.
6. **Codebase Overrides Documentation**: Inspect existing code before editing. Implementation evidence takes precedence over plans.
7. **Select and Implement One Bounded Task Only**:
   - Prefer the explicit `nextScheduledTask` in `STATE.json` when it names an eligible implementation task.
   - If `nextScheduledTask` points to a blocked human-only task but open implementation work exists in `MASTER_PLAN.md`, `BUGS.md`, or approved required-launch `FEATURE_REQUESTS.md`, select the highest-priority unblocked implementation task instead.
   - Stay strictly within the scope of **one bounded task—not necessarily a whole milestone**—per scheduled run. Complete that specific unit of work, verify it, and record progress.
8. **Preserve External Preview Supervisor**: Do not edit, restart, stop, kill, or reconfigure `C:\Commander\PreviewRouter`, `preview.json`, or background build coordinators. See [`automation/TESTING.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/TESTING.md).
9. **Never Fake Human Verification**: Distinguish `"implemented"`, `"automated_tests_passed"`, `"awaiting_user_test"`, and `"user_verified"`. Never mark a physical phone test or manual browser check as passed on behalf of the user.
10. **Protected Cloud & Safety Boundaries**:
    - Identify the configured Firebase project before running any cloud commands.
    - Never write secrets, keys, or tokens to tracked files.
    - **Function Deployment Rule**: If a scheduled task modifies any Cloud Function source, exports, dependencies, Firebase function configuration, or backend callable/HTTPS behaviour, deploy the affected function(s) before ending the run so the project owner can test the same day. Prefer targeted deploys such as `firebase deploy --only functions:functionName` when possible.
    - **Auto-Approved Low-Risk Function Deployments**: Request/response functions, callable functions, and bounded backend fixes may be deployed without additional human approval when they do not create a high-volume scheduler, bulk data process, production data migration, or material billing risk.
    - **Approval-Required Cost-Risk Deployments**: Human approval is required before deploying any function, script, or cloud command that may cause a cost surge, including schedules more frequent than once every 24 hours, queue/cron loops, bulk reads/writes/uploads/downloads, payment capture changes, large Firestore/RTDB/Storage migrations, or enabling a Google Cloud service with unclear or material billing exposure. The agent must include a plain-English cost estimate, frequency estimate, worst-case daily/monthly exposure, and mitigation/rollback plan.
    - **Minimal Test Data Allowance**: Up to 10 Firestore, Realtime Database, or Storage reads/writes/uploads/downloads may be performed for focused verification without separate approval, provided no secrets are exposed and the operation is documented in the run report.
    - **Daily Schedule Allowance**: A scheduled function running once per day or less frequently may be deployed without additional approval if the estimated invocation cost is low and the run report records the schedule.
    - **Sub-Daily Schedule Gate**: Any scheduled function running more frequently than once per 24 hours, including every 23 hours, 20 hours, hourly, every few minutes, or every minute, requires explicit human approval and a cost estimate before deployment.
    - **Development Security Rules Policy**: During active development, Firestore, Realtime Database, and Storage rules may be kept permissive enough to unblock testing. Rule-tightening is a mandatory pre-launch requirement before production release.
    - **Google Maps / Navigation Services**: Agents may use authenticated `gcloud` or Firebase CLI commands to enable and configure required Google Maps, Routes, or Navigation SDK services and keys for this project when the expected usage is low and the command does not enable a high-risk paid service. Record the service, key location, and cost assumption without writing secrets to tracked files.
11. **Run Automated Checks & Log Outcome**: Execute specified automated tests, log outcomes in [`automation/RUN_REPORTS.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/RUN_REPORTS.md), and record defects in [`automation/BUGS.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/BUGS.md).
12. **Gated Progression & Git Hygiene**: Check `git status` and `git diff` before any milestone commit. Never absorb unrelated pre-existing user changes. Never delete or discard uncommitted work. Update `STATE.json` only when all gates are satisfied.

---

## 4. Feature Editing & Intake Procedure

A separate feature-editing chat or developer session may update feature specifications using this workflow:
1. **Intake**: Add the proposed feature to [`automation/FEATURE_REQUESTS.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/FEATURE_REQUESTS.md) with origin (`human_requested` vs `agent_suggestion`), stable ID, affected apps, and launch scope classification.
2. **Review & Approval**: Human owner sets status to `"approved"`. (Agent suggestions remain `"proposed"` until explicitly approved).
3. **Document Updates**: Once approved, update the corresponding feature file in `automation/features/` and the master milestone in `automation/MASTER_PLAN.md`.
4. **Execution Safety**: Scheduled implementation runs will only pick up features that have been approved and scheduled in `MASTER_PLAN.md`.

---

## 5. Current M7 Task Selection Override

Until this section is superseded by a later run report or state update, M7 scheduled implementation workers must use this priority order:

1. `[M7-T3-STUDENT-MOBILE-STABILIZATION]`: Resolve Student Mobile request/session blockers and implement approved required-launch Student Mobile requests (`REQ-005`, `REQ-006`, launch-critical `REQ-008`).
2. `[M7-T4-ADMIN-WEB-STABILIZATION]`: Resolve Admin Web release blockers (`BUG-008`, `BUG-009`) and confirm `BUG-010` index availability.
3. `[M7-T5-TUTOR-ONBOARDING-PROMO-GOVERNANCE]`: Implement tutor right-to-work review gate (`REQ-007`) and tutor promotional payout agreement disclosure (`REQ-006`).
4. `[M7-T6-SAFETY-GUARDIAN-MODE]`: Implement Student Safety Profile, Guardian Mode, and soft tutor preference matching (`REQ-011`).
5. `[M7-T2-DUAL-DEVICE-VERIFICATION]`: Run only after the implementation tasks above are complete and the owner is ready to perform the physical-device test.
6. `ACT-006` pre-launch rules tightening: Run after functional testing is complete and before final public launch.

If a worker sees older run reports saying "all implementation tasks are complete" but the current `STATE.json`, `FEATURE_REQUESTS.md`, `BUGS.md`, or `MASTER_PLAN.md` lists open required-launch work, the current files take precedence over the older run report text.
