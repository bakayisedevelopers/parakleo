# User Actions & Human Review Inbox

> This document is the primary inbox for the human project owner.  
> It tracks human-only decisions, physical device tests, credential verifications, and safety gates.  
>
> **Security Policy**: Never write secrets, tokens, private keys, or credentials into this file or any tracked document. Use local environment files or Firebase Secret Manager as specified, and record only the verification status here.

---

## 1. Action Item Status Definitions
- `pending`: Action is required from the human owner.
- `completed_by_user`: Owner has executed the action; ready for automated verification where applicable.
- `verified`: Action has been verified by the agent or test run.
- `deferred`: Action is non-blocking for current milestone and postponed to a later phase.

---

## 2. Active Human Action Items

### [ACT-001] Review Updated Autonomous Plan & Confirm Open Decisions
- **Required Action**: Review the updated `automation/` documents (`MASTER_PLAN.md`, feature files, app plans, and `STATE.json`) and provide decisions on the open points.
- **Outcome**: Completed and approved by project owner on 2026-09-13.
  1. **Stage-by-Stage Cancellation Charges**: Confirmed fair lifecycle model (R0 pre-departure; booking fee >2m pre-travel; travel surcharge + booking fee en route; travel surcharge + 30m lesson fee + booking fee on arrival/prep; elapsed billable time + travel surcharge + booking fee in session; tutor cancellation R0 100% refund).
  2. **Fee Allocations**: Confirmed 100% of travel surcharge allocated to Tutor; 100% of booking fee allocated to Platform; 73% Tutor / 27% Platform for billable lesson revenue.
  3. **PIN Digit Length**: Confirmed 4-digit numeric PIN (`0000`–`9999`).
  4. **Billing Clock Start Trigger**: Confirmed PIN verification confirms arrival/meeting and starts the 5-minute preparation grace window; billing clock begins when either party taps "Start Lesson" or when the 5-minute preparation grace elapses.
- **Status**: `completed_by_user`

---

### [ACT-002] Provide / Verify Google Maps Navigation SDK Key for Android
- **Required Action**: Confirm that a valid Google Navigation SDK API key is present in the local Android environment (`local.properties` or environment variables) for `tutors/`.
- **Reason**: The Tutor Mobile App uses `@googlemaps/react-native-navigation-sdk` for turn-by-turn navigation. Without a valid key, native navigation initialization fails on real Android builds.
- **Owner Update 2026-09-14**: Human tester could not reach Google Maps Navigation SDK testing because Student Mobile request/session flow is blocked by `BUG-005` and `BUG-006`. Owner authorizes agents to use authenticated `gcloud`/Firebase CLI commands to enable required Google Maps, Routes API, or Navigation SDK services and configure local keys for this project when expected usage is low. Do not commit raw keys. Record enabled services, key location, and cost assumptions in `RUN_REPORTS.md`.
- **Safe Steps**: Add `MAPS_API_KEY` to local configuration without committing secrets. Enable required Google APIs through authenticated CLI if needed and if cost risk remains low.
- **Affected Tasks / Milestones**: Milestone `M3` (In-Person Travel & Navigation).
- **Blocking Scope**: Blocks real-device navigation testing in `M3`; does **not** block unrelated backend, onboarding, or request creation tasks in `M0`, `M1`, `M2`.
- **Status**: `pending`

---

### [ACT-003] Confirm Paystack API Key in Firebase Secret Manager
- **Required Action**: Verify that `PARAKLEO_PAYMENTS_SECRETS` contains valid Paystack test keys in Google Secret Manager for the designated Firebase project.
- **Owner Update 2026-09-14**: Human tester successfully created a student account, completed profile flow, added card details, and observed Paystack card verification working. This indicates the Paystack verification path/key is functioning for card authorization in the tested environment. Agent-side secret inspection or settlement debit verification is still not recorded here.
- **Reason**: Cloud Functions `verifyPaystack` and `finalizeSessionBilling` require Paystack secret keys to charge authorizations.
- **Safe Steps**: Configure secret via `firebase functions:secrets:set PARAKLEO_PAYMENTS_SECRETS` in terminal.
- **Affected Tasks / Milestones**: Milestone `M6` (Billing Settlement).
- **Blocking Scope**: Blocks payment settlement execution in `M6`; does **not** block earlier milestones.
- **Status**: `completed_by_user`

---

### [ACT-004] Physical Dual-Device In-Person Flow Verification
- **Required Action**: Install latest debug APKs for Student (`mobile/`) and Tutor (`tutors/`) on two separate physical Android devices. Execute the end-to-end meeting flow: student request $\rightarrow$ tutor offer accept $\rightarrow$ navigation $\rightarrow$ arrival $\rightarrow$ one-time PIN entry $\rightarrow$ active lesson $\rightarrow$ end lesson $\rightarrow$ rating.
- **Owner Update 2026-09-14**: Human tester attempted the flow but could not complete the dual-device verification because Student Mobile becomes unresponsive on the session/request screen and pricing quote loading does not complete. See `BUG-005`, `BUG-006`, and user test report `UTR-20260914-01`.
- **Reason**: Physical GPS sensors, background location streaming, and Navigation SDK audio guidance cannot be fully validated by unit tests or emulators.
- **Safe Steps**: Download debug builds from the preview download sites, run the steps, and log findings in [`automation/USER_TEST_REPORTS.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/USER_TEST_REPORTS.md).
- **Affected Tasks / Milestones**: Milestone `M7` (Release Readiness).
- **Blocking Scope**: Final release gate and physical-device verification only. Does **not** block ongoing non-dependent implementation work in M7, including `M7-T3-STUDENT-MOBILE-STABILIZATION`, `M7-T4-ADMIN-WEB-STABILIZATION`, `M7-T5-TUTOR-ONBOARDING-PROMO-GOVERNANCE`, approved required-launch feature requests, or bug fixes needed before the physical test can be retried.
- **Status**: `pending`

---

### [ACT-005] Production Cloud Deployment & Rule Publish Gate
- **Required Action**: Apply the owner-approved cloud deployment policy for development runs.
- **Outcome**: Authorized by user on 2026-09-14 ("Before I can do the tests, are there functions deployed to hosting? If not please deploy them so I can test."). All required Cloud Functions, Hosting sites, and Security Rules successfully deployed and live-verified in production.
- **Owner Update 2026-09-14**: Standing approval added for low-risk Cloud Function deployments after function code changes, low-volume request/response backend fixes, daily-or-less-frequent scheduled functions, and required low-risk Google Maps/Routes/Navigation SDK enablement/configuration. Human approval is still required for cost-risk actions: schedules more frequent than 24 hours, bulk Firestore/RTDB/Storage reads/writes/uploads/downloads, payment capture changes, high-volume loops/queues, production migrations, and paid cloud services with unclear or material billing exposure. Approval requests must include estimated volume, estimated daily/monthly cost, worst-case exposure, and rollback/disable steps.
- **Reason**: Avoid losing the project owner's limited daily testing window when backend functions are changed but not deployed, while still protecting against expensive cloud operations.
- **Safe Steps**: Deploy affected functions after modification, prefer targeted deploys, keep secrets out of tracked files, and log deployment/cost assumptions in `RUN_REPORTS.md`.
- **Affected Tasks / Milestones**: Production deployment / Release.
- **Blocking Scope**: Only high-cost or high-risk cloud operations require fresh approval. Low-risk function deployments after code changes are approved for development testing.
- **Status**: `verified`

---

### [ACT-006] Pre-Launch Security Rules Tightening
- **Required Action**: Before production launch, review and tighten Firestore, Realtime Database, and Storage security rules from permissive development mode to production-safe least-privilege access.
- **Reason**: Owner has approved keeping rules open/permissive during active development to unblock testing, but launch must not proceed with development-open data access.
- **Safe Steps**: After `ACT-004` defects are resolved and release testing passes, audit `firestore.rules`, `database.rules.json`, and `storage.rules`; restrict reads/writes to authenticated owners, participants, assigned tutors, offered tutors, and admins as appropriate; run emulator/rules tests where available; request owner review before final production rule publish.
- **Affected Tasks / Milestones**: Pre-launch release hardening / `M7`
- **Blocking Scope**: Blocks final public production launch. Does not block current development testing or low-risk function deployment.
- **Status**: `pending`
