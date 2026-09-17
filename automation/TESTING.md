# Testing, Cloud Boundaries & Verification Guide

> **Scope**: Testing procedures, automated checks, physical device testing, browser verification, preview supervisor integration, and cloud execution policies.  
> **Notice**: This document describes how testing is conducted. It does **not** authorise any automated agent to start, stop, restart, or alter the external preview supervisor. Cloud deployment authority is governed by Section 1 and [`automation/ENTRY.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/ENTRY.md).

---

## 1. Cloud & Environment Execution Policy

Future autonomous implementation runs must adhere to the following cloud and emulator safety policies:

1. **Identify Environment Before Execution**:
   - Before executing any Firebase, GCP, or Cloud Function commands, verify the active Firebase project:
     ```powershell
     firebase use
     ```
   - Never write secrets, keys, or private tokens into tracked files.
2. **Local Emulators vs. Real Device Network Constraints**:
   - Prefer properly configured local emulators (`firebase emulators:start`) or a designated development project for risky backend changes.
   - **Crucial Phone Reachability Note**: A physical phone running a debug APK **cannot** reach emulators running on the host machine through the phone's own `localhost` (127.0.0.1). A physical device requires the host machine's LAN IP address (e.g. `192.168.x.x:5001`) or a secure tunnel proxy.
   - Do not assume an `.env` flag alone connects every SDK or mobile device to local emulators.
   - **Future Task**: Audit emulator integration with local mobile startup before relying on emulator-based mobile tests.
3. **Third-Party API Keys & Secrets**:
   - The presence of `gcloud` or Firebase CLI does not guarantee access to third-party credentials (e.g. Paystack Secret Key, Google Maps Navigation SDK API key).
   - Missing third-party credentials block only their directly dependent integrations (e.g. real card debits, turn-by-turn navigation voice guidance); they do **not** block unrelated UI, state machine, or onboarding tasks.
4. **Cloud Function Deployment Policy**:
   - If a task changes Cloud Function source, exports, dependencies, or backend callable/HTTPS behaviour, deploy the affected function(s) before ending the run so human testing can begin immediately.
   - Prefer targeted deploys such as `firebase deploy --only functions:functionName` when possible.
   - Request/response functions and bounded backend fixes are auto-approved for deployment when they do not introduce a high-volume scheduler, bulk data operation, payment capture risk, or material billing exposure.
   - Scheduled functions running once every 24 hours or less frequently are auto-approved if the run report records the schedule and cost assumption.
   - Scheduled functions running more frequently than once every 24 hours require explicit human approval and a cost estimate before deployment.
5. **Cost-Risk Approval Gate**:
   - Require human approval for any command that may create a billing surge: high-frequency cron, queue loops, bulk Firestore/RTDB/Storage reads or writes, large uploads/downloads, payment capture changes, production migrations, or enabling a paid cloud service with unclear costs.
   - Approval requests must include estimated invocation/read/write/download volume, estimated daily/monthly cost, worst-case exposure, and rollback/disable steps.
   - Up to 10 Firestore, Realtime Database, or Storage reads/writes/uploads/downloads may be performed for focused verification without separate approval.
6. **Development Rules Policy**:
   - During active development, Firestore, Realtime Database, and Storage rules may remain permissive enough to unblock real-device testing.
   - Tight security rules are mandatory before launch and tracked as a pre-launch requirement in the master plan.
7. **Google Maps / Navigation SDK Services**:
   - Agents may use authenticated `gcloud` or Firebase CLI commands to enable/configure Google Maps, Routes API, or Navigation SDK services and local keys required by the app when expected usage is low.
   - Record the enabled service, key location, and cost assumption in `RUN_REPORTS.md`; never commit raw keys.

---

## 2. External Preview Supervisor (Read-Only Observed Role)

The local preview environment is supervised by an external orchestrator at `C:\Commander\PreviewRouter` (Supervisor API: `http://127.0.0.1:9001`).

### Observed Processes in `preview.json`
- `student-web`, `tutors-web`, `admin-web`: Vite dev server in `web/`
- `mobile-metro`: Expo dev client in `mobile/` (`parakleo-mobile-metro.bakayisedevelopers.co.za`)
- `tutors-metro`: Expo dev client in `tutors/` (`parakleo-tutors-dev.bakayisedevelopers.co.za`)
- `student-apk-download` & `tutors-apk-download`: Node download portals serving debug APKs

### Live Fast Refresh vs. Native Rebuild
- **Instant Live Fast Refresh (No Rebuild Required)**:
  - Changes to source files (`src/**`, `App.js`, styling, assets) instantly update running mobile apps via Expo Metro and web apps via Vite HMR without rebuilding binaries.
- **Native APK Rebuild Required**:
  - Changes to `nativeInputs` (`app.json`, `android/build.gradle`, etc.) trigger `compile:debug-apk` and `stage:debug-apk` via the build coordinators.
- **Safety**: Do not kill processes, change ports, edit `preview.json`, or touch `C:\Commander\`.

---

## 3. Automated Checks (Executable by Agents)

Autonomous runs can execute the following automated validation checks:

### Cloud Functions Unit Tests
```powershell
npm --prefix functions test
```
Executes test suites in `functions/`:
- `pricingEngine.test.js`: Validates travel surcharge (R40 + R4/km), booking fee (1% bounded R1–R2), 73/27 revenue split, and cancellation quotes.
- `paymentPricing.test.js`: Payment calculation and rounding.
- `legalAgreements.test.js`: Contract versioning and signing.
- `aiSubjectExtraction.test.js`: Problem extraction and duration estimation.

### Web Application Production Build
```powershell
npm --prefix web run build
```
Validates that JSX/TSX compiles cleanly without asset or bundle errors.

### Node Syntax Lint Checks
```powershell
node --check functions/index.js
node --check functions/pricingEngine.js
node --check functions/lessonStatus.js
```

---

## 4. Physical Android Device Testing Guide

> **Policy**: AI agents must **never** record manual phone tests as passed. Physical device testing is reserved exclusively for the human project owner.

### Dual-Device Physical In-Person Flow
1. **Download Builds**:
   - Student Device: Install debug APK from `https://parakleo-student-download.bakayisedevelopers.co.za`.
   - Tutor Device: Install debug APK from `https://parakleo-tutors-download.bakayisedevelopers.co.za`.
2. **Tutor Online Readiness**:
   - Log into Tutor Mobile App $\rightarrow$ toggle online status dial $\rightarrow$ verify green active dial.
3. **Student Request Submission**:
   - Log into Student Mobile App $\rightarrow$ take photo or type description.
   - Verify subject classification and upfront quote (including R40 base travel surcharge).
   - Confirm meeting location on map $\rightarrow$ tap submit request.
4. **Offer & Navigation**:
   - Tutor receives 45-second incoming offer popup $\rightarrow$ tap Accept.
   - Google Navigation SDK initializes turn-by-turn guidance.
   - Tutor drives/moves toward student location.
   - Verify Student App map updates tutor location every 3 seconds with ETA countdown.
5. **Arrival, One-Time PIN & Meeting**:
   - At $\le 50\text{m}$ proximity, Tutor App transitions to `arrived` and displays the 4-digit one-time PIN.
   - Student sees arrival alert and 5-minute arrival grace countdown.
   - Tutor taps "Preparing for lesson" (5-minute preparation grace begins; no billing clock).
   - Student enters the 4-digit PIN in the Student Mobile App $\rightarrow$ server validates PIN.
6. **Active Lesson & Settlement**:
   - Both apps transition to active lesson timer screens; synchronized elapsed timer starts.
   - Tutor taps "End Lesson".
   - Final settlement executes: billable minutes * rate + travel fee (R40+) + booking fee (1%, R1–R2).
   - Student rates lesson; tutor inspects payout breakdown (73% tuition + 100% travel fee).
7. **Record Findings**: Log the outcome in [`automation/USER_TEST_REPORTS.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/USER_TEST_REPORTS.md).

---

## 5. Admin Web Browser Checks

1. **Access**: Navigate to `/app/admin`.
2. **Tutor Applications**:
   - Open `/app/admin/tutors`.
   - Open tutor detail page `/app/admin/tutors/:uid`.
   - Inspect uploaded transcript and police clearance PDFs.
   - Click "Verify"; confirm status updates in Firestore.
3. **Public Navigation Isolation**:
   - Open `/` and `/tutor` in an incognito window.
   - Verify marketing copy displays download buttons for Student and Tutor mobile APKs.
   - Verify no student/tutor web-app login or booking entry points are exposed to public visitors.
   - Verify `/app/admin` remains accessible and protected by admin auth guards.
4. **Payments & Ledgers**:
   - Open `/app/admin/payments`.
   - Audit ledger breakdown: 27% platform commission, booking fees, 73% tutor payouts, and 100% travel fee pass-through.
