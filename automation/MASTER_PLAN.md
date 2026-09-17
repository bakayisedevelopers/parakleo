# Parakleo Master Autonomous Development Plan

> **Launch Scope**: In-Person Tutoring Marketplace delivered via dedicated Student Mobile (`mobile/`) and Tutor Mobile (`tutors/`) applications, supported by Cloud Functions (`functions/`), Firebase (Auth, Firestore, RTDB, Storage), and the Admin Web App (`web/src/pages/app/admin/`).  
> **Informational Web Scope**: Public web portals (`/` and `/tutor`) serve strictly as marketing websites directing visitors to download mobile APKs; all student/tutor web-app login, booking, and classroom entry points are unlinked from active public navigation.  
> **Preserved Post-Launch Scope**: Online tutoring (WebRTC video rooms, Tldraw whiteboard canvas, screen sharing) and legacy student/tutor web application suites are preserved intact in the repository for a future post-launch phase.

---

## 1. Confirmed Global Product & Financial Rules (Approved)

1. **In-Person Travel Surcharge**:
   $$\text{TravelFee} = \text{R40.00} + (\max(0, \text{TotalDistanceKm} - 10) \times \text{R4.00})$$
   - First 10 km covered by the base R40.00 fee.
   - R4.00 per km for every kilometre beyond 10 km.
   - Supersedes older R35.00 specifications.
   - **Allocation**: **100% allocated to the tutor** upon completion or applicable cancellation to cover operational transport costs.
2. **Platform Booking Fee**:
   $$\text{BookingFee} = \min(2.00, \max(1.00, \text{round}_2(\text{LessonAmount} \times 0.01)))$$
   - Exactly 1% of the lesson amount only (strictly excluding the travel surcharge).
   - Bounded between R1.00 and R2.00 while retaining cents within that range (e.g. R150 lesson $\rightarrow$ R1.50).
   - Calculated from estimated lesson amount during cancellations; calculated from actual billable lesson amount after attended lessons.
   - Free cancellation before travel begins retains R0.00 booking fee.
   - **Allocation**: **100% allocated to the platform** to cover gateway transactions and operations.
3. **Applicable Revenue Split**:
   - **73% Tutor / 27% Platform on applicable billable lesson revenue**.
   - Supersedes all older 80/20 specifications.
   - **Promotional Exception**: First-time-user promotional lessons follow `REQ-006`: student receives 25% off the first paid lesson, capped at R50, and tutor receives 75% of the discounted total amount paid/settled for that promotional lesson, inclusive of travel and lesson compensation.
4. **Travel Telemetry Rate**:
   - Location streaming targets an update **every 3 seconds** during active travel (`status: 'travelling'`). No sub-second target.
5. **Physical Lesson Start & Verification PIN**:
   - Cryptographically random, **4-digit one-time PIN confirmation** (`0000`–`9999`) generated server-side for the accepted session.
   - **The tutor sees the 4-digit PIN** in the Tutor Mobile App.
   - **The student enters the 4-digit PIN** in the Student Mobile App upon physical meeting.
   - Server-authoritative validation with limited attempts (max 3) and expiration.
   - **Billing Clock Start Timing**: PIN verification confirms arrival/meeting and starts a **5-minute preparation grace window**; billing clock begins when either party taps "Start Lesson" or when the 5-minute preparation grace elapses.
   - QR codes are excluded.
6. **Confirmed Stage-by-Stage Cancellation Schedule**:
   - `requested` / `matching`: R0 to student.
   - `accepted` (<2 min grace): R0 to student.
   - `accepted` (>2 min pre-travel): Booking fee (R1.00–R2.00) retained by platform.
   - `travelling`: Travel surcharge (100% to tutor) + booking fee (100% to platform).
   - `arrived` / `preparing`: Travel surcharge (100% to tutor) + 30-min minimum lesson fee (73% tutor / 27% platform) + booking fee (100% to platform).
   - `in_session`: Elapsed billable time (min 30 min, 73/27 split) + travel surcharge (100% to tutor) + booking fee (100% to platform).
   - Tutor cancellation at any stage: R0 to student (100% full refund).
7. **Student Launch Promotion & Referral Qualification**:
   - New student accounts should not receive automatic default free minutes simply for account creation.
   - First completed paid lesson receives a 25% discount capped at R50, calculated against the full student-facing order total for transparency.
   - Referring students receive 15 free minutes only after the referred student verifies email and phone, completes onboarding, completes their first paid/discounted lesson, and the lesson remains completed without cancellation, refund, or dispute.
8. **Tutor Right-to-Work Verification**:
   - Tutors must upload police clearance plus South African ID, or passport plus valid South African work visa/right-to-work evidence.
   - These documents are manually reviewed by Admin Web and must not be AI-approved.
   - Tutors cannot go online or receive requests until admin approval is granted.
9. **Student Safety Profile & Guardian Mode**:
   - In-person tutoring launch must support a student safety profile. Minor learners require guardian details, guardian consent/presence rules, and safety reminders throughout request and session flow.
   - Same-gender tutor matching is a soft student/guardian preference and ranking signal, not a blanket hard exclusion by default.
   - Requests and sessions should carry a bounded safety snapshot so tutors see guardian/safe-location requirements before accepting.

---

## 2. Global Milestone Roadmap

| ID | Milestone Name | Primary Apps & Services | Status | Review Gate |
| :--- | :--- | :--- | :---: | :---: |
| **M0** | Contract & Pricing Parameters Reconciliation | `functions`, `mobile`, `tutors` | `completed` | Plan approved by owner |
| **M1** | Tutor Onboarding & Public Web Surface Realignment | `tutors`, `web`, `functions` | `completed` | Automated + Admin check |
| **M2** | In-Person Request Creation & Proximity Dispatch | `mobile`, `tutors`, `functions` | `completed` | Automated + Device check |
| **M3** | In-Person Travel, Navigation SDK & 3s Telemetry | `tutors`, `mobile`, `functions` | `completed` | Device GPS check |
| **M4** | Arrival Geofence, PIN Generation & Lesson Prep | `tutors`, `mobile`, `functions` | `completed` | Automated + Device check |
| **M5** | PIN Verification, Lesson Start & Active Timers | `mobile`, `tutors`, `functions` | `completed` | Automated + Device check |
| **M6** | Billing Settlement, Paystack Debit & Cancellation | `functions`, `mobile`, `tutors`, `web` | `in_progress` | Payment review gate |
| **M7** | End-to-End Dual-Device Verification & Release | All applications | `not_started` | Final human release gate |
| **P-POST** | Online Tutoring & Web Classroom Re-Activation | `web`, `mobile`, `tutors` | `planned_post_launch` | Post-launch roadmap |

---

## 3. Cloud Deployment & Pre-Launch Governance

### Development Deployment Policy
- If any task modifies Cloud Function code, exports, dependencies, or callable/HTTPS backend behaviour, the affected function(s) must be deployed before the run ends so the project owner can test immediately.
- Low-risk request/response functions and bounded backend fixes are pre-approved for deployment during development, provided the run report records what was deployed and why.
- Human approval is required before deploying or running anything with material cost risk: schedules more frequent than once every 24 hours, queue/cron loops, bulk Firestore/RTDB/Storage reads or writes, large uploads/downloads, payment capture changes, production migrations, or enabling a cloud service with unclear billing exposure.
- Any cost-risk approval request must include estimated volume, estimated daily/monthly cost, worst-case exposure, and rollback/disable steps.
- Up to 10 Firestore, Realtime Database, or Storage reads/writes/uploads/downloads are allowed for focused verification without separate approval.
- Google Maps, Routes API, and Navigation SDK services/keys may be enabled/configured by agents when required for app testing and expected usage is low. Never commit raw keys.

### Pre-Launch Requirements
- `ACT-004`: Complete dual-device physical in-person flow verification after current Student Mobile blockers are fixed.
- `ACT-006`: Tighten Firestore, Realtime Database, and Storage rules before public production launch. Development rules may remain permissive during active testing, but final launch requires least-privilege production rules.
- `REQ-005`: Implement Student Mobile onboarding revamp before launch: required selfie, verified phone/email, optional card setup, and cash default payment method.
- `REQ-006`: Implement launch-safe first-lesson discount and qualified referral rewards before launch, replacing automatic new-account free minutes and profile-completion referral rewards.
- `REQ-007`: Implement tutor police-clearance plus right-to-work ID/passport/work-visa admin review gate before launch.
- `REQ-008`: Complete bounded Student Mobile UI polish on launch-critical screens while preserving brand colours.
- `REQ-011`: Implement Student Safety Profile, Guardian Mode, and soft tutor preference matching before launch for in-person safety.
- Production release cannot be marked complete while `BUG-005`, `BUG-006`, `BUG-008`, `BUG-009`, or other M7-blocking runtime defects remain open.

---

## 4. Detailed Milestone Execution Plan

### Milestone 0: Contract & Pricing Parameters Reconciliation (`M0`)
- **Status**: `completed` (Verified across M0-T1, M0-T2, M0-T3)
- **Objective**: Standardize business rules, pricing logic, and lifecycle constants across backend functions and mobile client constants:
  1. Confirm `functions/pricingEngine.js` and `functions/index.js` implement dynamic server-authoritative calculations:
     - Base Price ($B$): dynamically generated from pricing band and market multipliers.
     - Rate per Minute ($R$): dynamically generated with duration discount tiers.
     - Base travel fee: R40.00 up to 10 km, R4.00/km beyond 10 km (100% allocated to tutor).
     - Booking fee: 1% of lesson-only amount, bounded between R1.00 and R2.00 with cents retention (100% allocated to platform).
     - Revenue split: 73% Tutor / 27% Platform for applicable lesson revenue.
     - Confirmed cancellation stage pricing table.
  2. Verify canonical `LESSON_STATUS` across `functions/lessonStatus.js`, `mobile/src/constants/lessonStatus.js`, and `tutors/src/constants/lessonStatus.js`.
  3. Eliminate client hardcoded rates (e.g. `1.8`, `LOCAL_TRANSFER_FEE = 40`) in `mobile/src/screens/student/SessionScreen.js` and ensure all quotes are fetched directly from backend `getPricingQuote`.
- **Execution Granularity**: Each scheduled run executes **one bounded task** within the milestone. The worker assigns a unique task identifier based on the milestone/phase (e.g. `[M0-T1-PRICE-RECONCILIATION]`).
- **Referenced Features**: [`SH-STATUS-MACHINE`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md), [`SH-PRICING-ENGINE`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md), [`SH-STAGE-PRICING-AND-CANCELLATIONS`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md)
- **App Plan Sections**:
  - `plans/STUDENT_MOBILE.md` $\rightarrow$ Phase M0
  - `plans/TUTOR_MOBILE.md` $\rightarrow$ Phase M0
- **Prerequisites**: Approval of [`automation/USER_ACTIONS.md:ACT-001`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/USER_ACTIONS.md#L20) (Approved).
- **Verification Plan**:
  - Automated test suite in `functions/`: `npm --prefix functions test`
  - Unit tests verifying boundary values for booking fee (e.g. R50 lesson $\rightarrow$ R1.00; R150 lesson $\rightarrow$ R1.50; R300 lesson $\rightarrow$ R2.00) and travel fee calculations.

---

### Milestone 1: Tutor Onboarding & Public Web Realignment (`M1`)
- **Status**: `in_progress`
- **Objective**: Complete two critical launch foundations:
  1. **Tutor Onboarding & Verification Journey (`JRN-TUT-ONBOARD`)**:
     - Tutor uploads qualification transcripts and police clearance PDF in `tutors/`.
     - Cloud Function creates document records in `tutorDocuments`.
     - Admin Web App displays applicant in `AdminTutorsPage.jsx` and document details in `AdminTutorDetailsPage.jsx`.
     - Admin approves (`verified`); Tutor Mobile App receives status and unlocks the online dial.
  2. **Public Web Realignment (`SH-PUBLIC-WEBSITES`)**:
     - Update public marketing landing pages (`web/src/pages/LandingPage.jsx`, `TutorLandingPage.jsx`, and `PortalLandingPage.jsx`) to function strictly as informational download hubs.
     - Replace student/tutor web login, registration, booking, and classroom CTAs with prominent "Download Student App" and "Download Tutor App" buttons pointing to APK download services.
     - Unlink student/tutor web-app routes from public navigation while preserving underlying code for post-launch/legacy use.
     - Ensure the Admin Web application (`/app/admin/*`) and its login pathways remain fully functional and unhindered.
- **Referenced Features**:
  - [`TUT-ONBOARD-DOC`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md), [`TUT-AGREEMENT`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md)
  - [`ADM-TUTOR-QUEUE`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/ADMIN_WEB.md), [`ADM-TUTOR-VERIFY`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/ADMIN_WEB.md)
  - [`SH-PUBLIC-WEBSITES`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md)
- **App Plan Sections**:
  - `plans/TUTOR_MOBILE.md` $\rightarrow$ Phase M1
  - `plans/ADMIN_WEB.md` $\rightarrow$ Phase M1
- **Prerequisites**: `M0` completed.
- **Verification Plan**:
  - Automated: Unit tests for legal agreements and document upload triggers in `functions/`.
  - Manual Admin Check: Log into Admin Web, review uploaded sample documents, approve tutor, verify Firestore state.
  - Web Navigation Check: Verify public site at `/` and `/tutor` displays mobile APK download CTAs and has no active web-classroom or student-login links. Verify `/app/admin` remains accessible.

---

### Milestone 2: In-Person Request Creation & Proximity Dispatch (`M2`)
- **Status**: `not_started`
- **Objective**: Complete the integrated request and dispatch journey **`JRN-REQ-MATCH`**:
  1. Student captures problem photo (OCR) or types description in Student Mobile (`mobile/`).
  2. AI/OCR classifies subject and topic, and generates initial quote including R40.00 base travel surcharge.
  3. Student confirms meeting location on map in `SessionScreen.js` and submits request (`mode: 'in_person'`).
  4. Active request state persistence: Fix `SessionScreen.js` so app reboots rehydrate active pending/en-route requests.
  5. Cloud Function `syncClassRequestLifecycle` executes radial proximity query (Haversine distance) filtering online, verified tutors teaching the subject.
  6. Delivers a 45-second timed offer popup to the closest tutor.
  7. Tutor Mobile App displays `TutorOfferOverlay` with chime and countdown; tutor accepts.
- **Referenced Features**:
  - [`STU-REQ-CREATE`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/STUDENT_MOBILE.md), [`STU-REQ-CONFIRM`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/STUDENT_MOBILE.md)
  - [`TUT-ONLINE-STATUS`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md), [`TUT-OFFER-POPUP`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md)
  - [`SH-PROXIMITY-DISPATCH`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md)
- **App Plan Sections**:
  - `plans/STUDENT_MOBILE.md` $\rightarrow$ Phase M2
  - `plans/TUTOR_MOBILE.md` $\rightarrow$ Phase M2
- **Prerequisites**: `M1` completed.
- **Verification Plan**:
  - Automated: Unit test radial query and 45s offer expiration in `functions/`.
  - Device Check: With tutor online, submit student request from mobile build; verify offer popup appears within 3 seconds.

---

### Milestone 3: In-Person Travel, Navigation SDK & 3-Second Telemetry (`M3`)
- **Status**: `not_started`
- **Objective**: Complete travel guidance and real-time synchronization **`JRN-TRV-TRACK`**:
  1. Tutor accepts offer $\rightarrow$ launches `TutorNavigationScreen.js` with Google Navigation SDK.
  2. Tutor taps "Start Travel" $\rightarrow$ status transitions to `travelling`.
  3. Turn-by-turn guidance guides tutor to student destination.
  4. Real-time GPS coordinates stream to RTDB `liveTracking/classRequests/{requestId}` targeted at **3-second intervals**.
  5. Student Mobile App displays live tracking map (`SessionMapView.js`) with moving tutor marker, route polyline, and live ETA countdown.
- **Referenced Features**:
  - [`TUT-NAV-SDK`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md), [`TUT-GPS-STREAM`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md)
  - [`STU-LIVE-TRACK`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/STUDENT_MOBILE.md), [`SH-RTDB-TELEMETRY`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md)
- **App Plan Sections**:
  - `plans/TUTOR_MOBILE.md` $\rightarrow$ Phase M3
  - `plans/STUDENT_MOBILE.md` $\rightarrow$ Phase M3
- **Prerequisites**: `M2` completed, `ACT-002` (Navigation SDK credentials) verified.
- **Verification Plan**:
  - Automated: Verify RTDB rules and telemetry data normalization.
  - Device Check: Start navigation on tutor build; verify student app map marker updates position every 3 seconds.

---

### Milestone 4: Arrival Geofence, PIN Generation & Lesson Prep (`M4`)
- **Status**: `completed` (Verified across M4-T1 and M4-T2)
- **Objective**: Complete arrival detection and preparation window **`JRN-ARR-PREP`**:
  1. Navigation SDK detects tutor is $\le 50\text{m}$ from student destination $\rightarrow$ triggers arrival.
  2. Backend updates status to `arrived` and starts 5-minute arrival grace countdown.
  3. Server generates cryptographically random short one-time PIN for the session and stores it securely in Firestore session state. (*Exact PIN digit length is pending human decision*).
  4. Tutor Mobile App displays the short one-time PIN on screen with student contact details.
  5. Student receives arrival alert and sees arrival grace countdown.
  6. Upon physical meeting, tutor taps "Preparing for lesson" $\rightarrow$ transitions to `preparing_for_lesson` with existing 5-minute prep grace window.
  7. No billing clock runs during travel or arrival grace (5m).
- **Execution Granularity**: Each scheduled run executes **one bounded task** within the milestone.
- **Referenced Features**:
  - [`TUT-ARR-PREP`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md), [`STU-ARR-PREP`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/STUDENT_MOBILE.md)
  - [`SH-STATUS-MACHINE`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md), [`SH-PIN-VERIFICATION`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md)
- **App Plan Sections**:
  - `plans/TUTOR_MOBILE.md` $\rightarrow$ Phase M4
  - `plans/STUDENT_MOBILE.md` $\rightarrow$ Phase M4
- **Prerequisites**: `M3` completed.
- **Verification Plan**:
  - Automated: Test PIN generation, rate-limiting, and status transition rules.
  - Manual Device Check: Simulate arrival coordinates; verify PIN appears on tutor screen and arrival grace countdown displays on both devices.

---

### Milestone 5: PIN Verification, Lesson Start & Active Timers (`M5`)
- **Status**: `completed` (Verified across M5-T1 and M5-T2)
- **Objective**: Complete physical meeting validation and active lesson lifecycle **`JRN-SES-TIMER`**:
  1. Student enters the short one-time PIN in the Student Mobile App.
  2. Cloud Function validates PIN (enforces max 3 attempts and session matching).
  3. On success, server emits meeting verification event. PIN verification confirms arrival/meeting and starts 5-minute preparation grace window; billing clock begins when either party taps "Start Lesson" or when the 5-minute preparation grace elapses.
  4. Both apps transition to active lesson screens (`ActiveSessionScreen.js` in student, `TutorActiveSessionScreen.js` in tutor).
  5. Synchronized second-by-second elapsed timer runs on both devices.
  6. Student and tutor see running estimated cost (with 73% tutor tuition share + 100% travel fee breakdown) and topic notes.
  7. Tutor taps "End Lesson" $\rightarrow$ transitions to settlement.
- **Execution Granularity**: Each scheduled run executes **one bounded task** within the milestone.
- **Referenced Features**:
  - [`STU-ACTIVE-LESSON`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/STUDENT_MOBILE.md), [`TUT-ACTIVE-LESSON`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md)
  - [`SH-STATUS-MACHINE`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md), [`SH-PIN-VERIFICATION`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md)
- **App Plan Sections**:
  - `plans/STUDENT_MOBILE.md` $\rightarrow$ Phase M5
  - `plans/TUTOR_MOBILE.md` $\rightarrow$ Phase M5
- **Prerequisites**: `M4` completed.
- **Verification Plan**:
  - Automated: Unit test PIN validation endpoint, invalid attempt lockout, and billing timestamp setting.
  - Manual Device Check: Student enters PIN; verify both apps transition to active timer screens within 1 second.

---

### Milestone 6: Billing Settlement, Paystack Debit & Stage Cancellation Engine (`M6`)
- **Status**: `completed` (Tasks `[M6-T1-BILLING-SETTLEMENT-ENGINE]` and `[M6-T2-SESSION-RECEIPT-RATING]` verified)
- **Objective**: Complete financial settlement **`JRN-SET-BILL`** and cancellation settlement **`JRN-CAN-FEE`**:
  1. **Task [M6-T1-BILLING-SETTLEMENT-ENGINE] (Completed)**:
     - Backend `finalizeSessionBilling` calculates total:
       $$\text{Total} = \text{Tuition} + \text{TravelFee} + \text{BookingFee} - \text{Discount}$$
       where $\text{Tuition} = B + \text{DurationDiscountedAmount}(M_{\text{billed}}, R)$, TravelFee is R40 base (+ R4/km beyond 10km, 100% to tutor), and BookingFee is 1% of lesson-only amount bounded to R1.00–R2.00 retaining cents (100% to platform).
     - Revenue split: 73% Tutor / 27% Platform on applicable discounted tuition.
     - Debits student's primary Paystack card token via HTTPS call; if failed or gateway unconfigured, records amount to wallet balance debt.
     - Credits tutor payout ledger with 73% lesson tuition + 100% travel fee; credits platform ledger with 27% tuition + 100% booking fee.
     - Hardened `cancelInPersonLesson` to calculate stage cancellation fee, execute Paystack debit / wallet debt fallback, and record payout breakdown.
  2. **Task [M6-T2-SESSION-RECEIPT-RATING] (Completed)**:
     - Hardened student and tutor summary screens with itemized receipts displaying accurate 73% tuition share, 100% travel fee reimbursement, booking fee, and wallet debt notices.
     - Mutual rating submission wired to live profile rating calculations (`asTutor` and `asStudent` summaries in `users/{uid}`) in both mobile apps.
- **Execution Granularity**: Each scheduled run executes **one bounded task** within the milestone.
- **Referenced Features**:
  - [`STU-SETTLE-RATING`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/STUDENT_MOBILE.md), [`STU-CANCEL-FEE`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/STUDENT_MOBILE.md)
  - [`TUT-PAYOUTS`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md), [`TUT-CANCEL-HANDLING`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/TUTOR_MOBILE.md), [`ADM-PAYMENTS`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/ADMIN_WEB.md)
  - [`SH-BILLING-SETTLEMENT`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md), [`SH-PRICING-ENGINE`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md), [`SH-STAGE-PRICING-AND-CANCELLATIONS`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/features/SHARED_PLATFORM.md)
- **App Plan Sections**:
  - `plans/STUDENT_MOBILE.md` $\rightarrow$ Phase M6
  - `plans/TUTOR_MOBILE.md` $\rightarrow$ Phase M6
  - `plans/ADMIN_WEB.md` $\rightarrow$ Phase M6
- **Prerequisites**: `M5` completed, `ACT-003` (Paystack credentials) verified.
- **Verification Plan**:
  - Automated: Full test suite in `functions/pricingEngine.test.js`.
  - Review Gate: Inspect Paystack transaction ledger and tutor payout summary in Admin Web before enabling production debits.

---

### Milestone 7: End-to-End Dual-Device Verification & Release (`M7`)
- **Status**: `in_progress` (Implementation tasks `[M7-T1]`, `[M7-T3]`, `[M7-T4]`, `[M7-T5]`, and `[M7-T6]` completed; awaiting owner physical dual-device verification `[M7-T2]` / `ACT-004`)
- **Objective**: Full release-readiness verification across physical environments:
  1. **Task [M7-T1-E2E-RELEASE-AUDIT] (Completed)**:
     - Audited and verified security rules across Firestore, Cloud Storage, and Realtime Database (`firestore.rules`, `storage.rules`, `database.rules.json`).
     - Added `isAdmin()` read permissions in `storage.rules` for back-office admin tutor document reviews while preserving strict owner-only write permissions.
     - Verified clean production build for Web (`npm --prefix web run build` passing with 0 errors).
     - Verified all 115 backend unit test suites in `functions/` pass with 0 failures.
     - Staged 12-step dual-device test protocol in `automation/USER_TEST_REPORTS.md` for `ACT-004`.
  2. **Task [M7-T2-DUAL-DEVICE-VERIFICATION] (Deferred Until Implementation Blockers Are Cleared)**:
     - Project owner completes dual-device physical test run (`ACT-004`) on two physical Android devices following the 12-step protocol.
     - Final production release sign-off (`ACT-005`).
     - **Do not select this task while `BUG-005`, `BUG-006`, `BUG-008`, `BUG-009`, `REQ-005`, `REQ-006`, `REQ-007`, or launch-critical `REQ-008` remain open/pending.** This task is a human-only physical verification gate, not an autonomous implementation stop condition.
  3. **Task [M7-T3-STUDENT-MOBILE-STABILIZATION] (Pending after `UTR-20260914-01`)**:
     - Resolve `BUG-005`: Student Mobile `SessionScreen` becomes unresponsive after request flow / active request rehydration.
     - Resolve `BUG-006`: pricing quote remains loading indefinitely and `Confirm order` is enabled before a valid quote is ready.
     - Resolve `BUG-007`: PDF/document upload does not work in student request intake.
     - Implement approved `REQ-005` onboarding revamp if it is still pending before final release, including required selfie, phone verification, email verification, optional card setup, and cash default payment method.
     - Implement approved `REQ-006` launch promotion and referral change: remove automatic new-account free minutes, apply 25% first paid lesson discount capped at R50, and grant 15 referral free minutes only after the referred student completes their first paid/discounted lesson.
     - Implement approved `REQ-008` bounded Student Mobile visual polish on affected launch screens while preserving the Parakleo colours and existing flow architecture.
     - Coordinate with `REQ-011` so student onboarding/profile completion can include the safety profile fields needed for guardian mode.
     - Deploy affected low-risk functions immediately if backend/function code changes are required, following the development deployment policy in Section 3.
  4. **Task [M7-T4-ADMIN-WEB-STABILIZATION] (Pending after `UTR-20260914-02`)**:
     - Resolve `BUG-008`: Admin Agreements console `startTime` TypeError, first verifying whether it is app code or browser extension/runtime instrumentation noise.
     - Resolve `BUG-009`: Admin Payouts/Payments Firestore `Missing or insufficient permissions` failure for authorized admins.
     - Confirm `BUG-010`: sessions composite index is available in the Firebase project and, if needed, captured in deployable Firestore index configuration.
     - Retest Admin Agreements and Payouts/Payments screens in a clean browser context before release sign-off.
  5. **Task [M7-T5-TUTOR-ONBOARDING-PROMO-GOVERNANCE] (Completed)**:
     - Implemented approved `REQ-007`: tutor onboarding requires both police clearance AND right-to-work identity documents (South African ID or passport with valid work visa) independently; both must be present to advance past the clearance step.
     - Implemented review state routing and access control in Tutor Mobile (`tutors/src/screens/onboarding/TutorReviewStatusScreen.js` and `RootNavigator.js`). On login and after onboarding completion, unverified tutors are routed to `ReviewStatus`. If pending, displays verification checklist, explanation of manual operations review, and status refresh button; if rejected, displays admin rejection feedback and mandatory 24-hour private-document deletion policy notice.
     - Updated Admin Tutor review surfaces (`AdminTutorDetailsPage.jsx` and `userService.js`) to enforce that academic results, police clearance, and right-to-work documents are all present before manual admin verification is permitted. Added 24-hour document deletion notice in rejection modal.
     - Implemented `REQ-006` promotional payout disclosure in the canonical Tutor Agreement (`functions/legalAgreements.js`, `AdminTutorAgreementsPage.jsx`, and `tutors/src/services/legalAgreementService.js`): published version `1.1.0` detailing that for first-time-user promotional lessons (25% discount capped at R50), the tutor receives 75% of the discounted total amount paid/settled, inclusive of travel and lesson compensation.
  6. **Task [M7-T6-SAFETY-GUARDIAN-MODE] (Completed)**:
     - Implement approved `REQ-011`: Student Safety Profile, Guardian Mode, and soft tutor preference matching.
     - Add student safety profile fields and onboarding/profile completion requirements for adult/minor learner type, guardian details for minors, guardian consent/presence confirmation, same-gender tutor preference, and public meeting place preference.
     - Copy a bounded `safetySnapshot` into `classRequests`, RTDB live-tracking where appropriate, and `sessions` so tutor apps receive only the safety information needed to handle the in-person lesson.
     - Update backend tutor matching so same-gender preference ranks matching tutors first when consented gender fields exist, but does not silently hard-block all other verified tutors. Provide a clear fallback path if no preferred tutor is available.
     - Update Tutor offer/navigation/session screens to show safety badges and guardian-presence reminders before acceptance and during arrival/preparation.
     - Extend Student/Tutor Safety Center share text and trusted-contact/guardian flows using the existing safety modals.
- **Referenced Features**: All launch features.
- **Prerequisites**: Milestones `M0` through `M6` verified; `REQ-005`, `REQ-006`, `REQ-007`, `REQ-011`, and launch-critical pieces of `REQ-008` implemented; `BUG-005`, `BUG-006`, `BUG-008`, `BUG-009`, and M7-blocking runtime defects resolved; `ACT-004`, `ACT-005`, and `ACT-006` completed.
- **Verification Plan**: Checklist in [`automation/TESTING.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/TESTING.md) executed and logged in [`automation/USER_TEST_REPORTS.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/USER_TEST_REPORTS.md).
- **Review Gate**: User final sign-off before production launch.

#### Current M7 Autonomous Execution Priority

Scheduled autonomous workers must treat this as the active M7 implementation queue:

1. `[M7-T3-STUDENT-MOBILE-STABILIZATION]`
2. `[M7-T4-ADMIN-WEB-STABILIZATION]`
3. `[M7-T5-TUTOR-ONBOARDING-PROMO-GOVERNANCE]`
4. `[M7-T6-SAFETY-GUARDIAN-MODE]`
5. `[M7-T2-DUAL-DEVICE-VERIFICATION]` only after the implementation tasks above are complete and the owner can run the physical-device test
6. `ACT-006` pre-launch security rules tightening after functional testing passes

---

### Post-Launch Roadmap: Scheduling, Recurring Lessons & Broader Rewards (`P-POST`)
- **Status**: `planned_post_launch`
- **Objective**: Preserve owner-approved future ideas without scheduling them into the initial launch implementation queue.
- **Post-Launch Feature Requests**:
  - `REQ-009` / `SH-SCHEDULED-LESSONS`: Scheduled lessons and recurring lessons, including future-time tutor assignment, replacement-tutor handling if unavailable, same/different tutor recurrence options, advance payment, and discounted recurring pricing. Needs more planning before implementation.
  - `REQ-010` / `SH-REWARD-SYSTEM`: Broader student/tutor reward system with notifications, budget controls, anti-abuse gates, naming, eligibility rules, and admin configuration. Needs more planning before implementation.
- **Review Gate**: Owner must approve complete specifications before any scheduled/recurring lesson or broader reward-system implementation begins.
