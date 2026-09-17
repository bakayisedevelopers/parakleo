# Shared Platform Features & Backend Services

> **Scope**: Cross-Cutting Backend Services, Firebase Infrastructure, Shared Business Logic, and Platform Infrastructure  
> **Key Paths**: [`functions/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/), [`shared/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/shared/), [`firestore.rules`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/firestore.rules), [`database.rules.json`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/database.rules.json), [`storage.rules`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/storage.rules), [`firebase.json`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/firebase.json)

---

## Cross-App Journeys Referenced
- **`JRN-TUT-ONBOARD`**: Automated Document Processing, Storage Triggers, and Status Propagation
- **`JRN-REQ-MATCH`**: Radial Distance Proximity Queries, Timed Offer Cascades, and Expiration
- **`JRN-TRV-TRACK`**: 3-Second RTDB Telemetry Pipeline
- **`JRN-ARR-PREP`**: Server-Authoritative Arrival, PIN Generation, and Grace Period Enforcement
- **`JRN-SES-TIMER`**: Physical PIN Verification, Lesson Start Event, and Timestamp Synchronization
- **`JRN-SET-BILL`**: Unified Time-Elapsed Pricing Settlement, Paystack Debits, and Tutor Ledgers
- **`JRN-CAN-FEE`**: Travel-Distance Fee Computation and Automated Settlement

---

## Feature Inventory

### `SH-STATUS-MACHINE`: Canonical In-Person Lesson State Machine
- **Behaviour**: A single, strict state machine governing both Firestore documents (`classRequests` and `sessions`) and RTDB live tracking (`liveTracking/classRequests`). Defines valid state transitions and blocks illegal status jumps:
  - `pending` $\rightarrow$ `matching` $\rightarrow$ `offered` $\rightarrow$ `accepted` $\rightarrow$ `travelling` $\rightarrow$ `arrived` $\rightarrow$ `waiting_student` $\rightarrow$ `preparing_for_lesson` $\rightarrow$ `in_session` $\rightarrow$ `ending_requested` $\rightarrow$ `completed` / `settled`
  - Cancellation paths: `canceled_by_student`, `canceled_by_tutor`, `expired`
- **Owning Area**: Cloud Functions & Shared Constants
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`functions/lessonStatus.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/lessonStatus.js), [`mobile/src/constants/lessonStatus.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/constants/lessonStatus.js), [`tutors/src/constants/lessonStatus.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/constants/lessonStatus.js)
- **Unresolved Decisions**: None.

#### `SH-PIN-VERIFICATION`: Trusted One-Time PIN Generation & Physical Meeting Verification
- **Behaviour**: Part of **`JRN-ARR-PREP`** & **`JRN-SES-TIMER`**. Guarantees physical meeting before lesson commencement:
  1. **Trusted Server Generation**: When tutor arrives ($\le 50\text{m}$), Cloud Function generates a cryptographically random **4-digit one-time PIN** (`0000`–`9999`) for the session and stores it securely in Firestore session state.
  2. **Visibility**: The tutor sees the 4-digit PIN on their Tutor Mobile screen.
  3. **Input & Validation**: The student inputs the 4-digit PIN in the Student Mobile App. Cloud Function validates the entry with rate-limiting (max 3 attempts to prevent brute-force guessing) and expiration bounds.
  4. **Start Event & Preparation Grace Timing**: On successful validation, the server confirms that tutor and student are physically co-located and transitions state to `preparing_for_lesson`, initiating a **5-minute preparation grace countdown window**. Billable time clock (`billingStartedAt`) begins when either the tutor taps "Start Lesson" or when the 5-minute preparation grace elapses. QR codes are excluded.
- **Owning Area**: Cloud Functions (`functions/index.js`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved for implementation in `M4`.
- **Dependencies & References**: [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`tutors/src/screens/navigation/TutorNavigationScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/navigation/TutorNavigationScreen.js), [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js)
- **Unresolved Decisions**: None.

### `SH-PROXIMITY-DISPATCH`: Radial Geographic Tutor Matching Engine
- **Behaviour**: Part of **`JRN-REQ-MATCH`**. Triggered when an in-person request is submitted. Uses the Haversine formula to compute distance between the student's coordinates and active online tutors teaching the requested subject. Delivers a 45-second timed offer to the top-ranked closest tutor. If declined or expired, cascades automatically to the next closest tutor in the queue.
- **Owning Area**: Cloud Functions (`functions/index.js` `syncClassRequestLifecycle`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js)
- **Unresolved Decisions**: None.

### `SH-RTDB-TELEMETRY`: 3-Second Realtime Database Telemetry Pipeline
- **Behaviour**: Part of **`JRN-TRV-TRACK`**. Hosts live GPS location streaming at `liveTracking/classRequests/{requestId}` in Firebase Realtime Database. Tracks:
  `tutorLocation`, `studentLocation`, `destination`, `routeSnapshot`, `distanceRemainingMeters`, `etaSeconds`, `status`, and timestamps. Targets a **3-second update interval** during active travel (`status: 'travelling'`).
- **Owning Area**: Firebase Realtime Database & Client Services
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`database.rules.json`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/database.rules.json), [`mobile/src/services/liveTrackingRealtimeService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/liveTrackingRealtimeService.js), [`tutors/src/services/liveTrackingRealtimeService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/liveTrackingRealtimeService.js)
- **Unresolved Decisions**: None.

### `SH-PRICING-ENGINE`: Dynamic Backend Pricing Engine (No Hard-Coded Client Rates)
- **Behaviour**: Authoritative pricing calculations for quotes, lesson billing, and stage-by-stage cancellation charges. **No hard-coded rates or transfer fees are permitted in client mobile apps** (e.g. eliminating fallback `1.8`, fixed `40`, or static `3.0`):
  1. **Dynamic Base Price ($B$)**: Computed server-side based on system pricing bands (`low`: R5, `normal`: R7, `high`: R8) adjusted by dynamic multipliers (time-of-day, demand/supply ratio, tutor availability, subject complexity, season).
  2. **Dynamic Rate per Minute ($R$)**: Computed server-side based on system pricing bands (`low`: R3.00, `normal`: R3.60, `high`: R4.50) adjusted by dynamic multipliers and duration rate discount tiers.
  3. **Travel Surcharge Formula ($T$)**: Computed server-side from route distance in km ($D$):
     - For $D \le 10\text{ km}$: $T = \text{R}40.00$.
     - For $D > 10\text{ km}$: $T = \text{R}40.00 + (D - 10) \times \text{R}4.00$.
     - **Allocation**: **100% allocated to the Tutor** as an operational expense reimbursement.
  4. **Booking Fee Formula ($F_B$)**: Exactly 1% of the **lesson-only amount** (excluding travel fee), bounded strictly between **R1.00 and R2.00**, preserving decimal cents within that range:
     $$F_B = \min(2.00, \max(1.00, \text{round}_2(\text{Tuition} \times 0.01)))$$
     - Free cancellation stages incur $F_B = \text{R}0.00$.
     - **Allocation**: **100% allocated to the Platform** to cover gateway processing and platform costs.
  5. **Revenue Split on Applicable Lesson Revenue**: 73% Tutor / 27% Platform on applicable billable lesson revenue.
  6. **Authoritative Billing Calculation**: Paid lesson tuition is calculated dynamically:
     $$\text{Tuition}_{\text{actual}} = B + \text{DurationDiscountedAmount}(M_{\text{attended}}, R)$$
- **Owning Area**: Cloud Functions (`functions/pricingEngine.js`, `functions/index.js`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed backend baseline; scheduled for client cleanup in `M1` and full settlement integration in `M6`.
- **Dependencies & References**: [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`mobile/src/services/pricingService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/pricingService.js)
- **Unresolved Decisions**: None.

### `SH-LAUNCH-PROMOS`: First-Lesson Discount & Promotional Settlement
- **Behaviour**: Launch promotion for new students. New student accounts should not receive automatic default free minutes merely for account creation. Instead, the first completed paid lesson receives a 25% discount capped at R50, calculated against the full student-facing order total for that first lesson. The settlement snapshot must explicitly identify promotional lessons and the exact discount applied.

  Promotional tutor payout rule: for first-time-user promotional lessons only, the tutor receives 75% of the discounted total amount paid/settled for that lesson, inclusive of travel and lesson compensation. This is a promotion-specific exception to the normal non-promotional payout model and must be disclosed in the Tutor Agreement before tutors accept work.
- **Owning Area**: Cloud Functions, pricing/settlement, and agreement versioning
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-006`), pending implementation.
- **Dependencies & References**: [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`functions/legalAgreements.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/legalAgreements.js)
- **Unresolved Decisions**: None.

### `SH-REFERRAL-REWARDS`: Qualified Referral Free-Minute Rewards
- **Behaviour**: Referring students earn 15 free minutes only after the referred student completes a qualified first paid/discounted lesson. The referred student must have signed up through the referral link, verified email, verified phone number, completed onboarding, and completed the first paid lesson without cancellation, refund, or dispute. Referral rewards must not trigger on profile completion alone. Anti-abuse protections must prevent self-referrals, duplicate rewards for the same referred student, and unverified/fake account reward farming.
- **Owning Area**: Cloud Functions, user profiles, referral ledger, and settlement events
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-006`), pending implementation.
- **Dependencies & References**: [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`mobile/src/screens/student/DashboardScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/DashboardScreen.js), [`mobile/src/screens/student/ProfileScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/ProfileScreen.js)
- **Unresolved Decisions**: None.

### `SH-IDENTITY-VERIFICATION`: Student Contact Verification & Tutor Right-to-Work Review
- **Behaviour**: Shared identity/verification requirement across launch onboarding. Students must verify phone number and email as part of completed onboarding because card setup is optional. Tutors must upload police clearance plus right-to-work identity evidence (South African ID, or passport plus valid South African work visa/right-to-work evidence). Tutor identity/right-to-work documents are manually reviewed by admin, not AI-approved, before the tutor can go online or receive student requests.
- **Owning Area**: Firebase Auth/Profile, Cloud Functions, Storage, and Admin review tooling
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature requests (`REQ-005`, `REQ-007`), pending implementation.
- **Dependencies & References**: [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`tutors/src/screens/onboarding/TutorOnboardingScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/onboarding/TutorOnboardingScreen.js), [`web/src/pages/app/admin/AdminTutorDetailsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminTutorDetailsPage.jsx)
- **Unresolved Decisions**: None.

### `SH-SAFETY-MATCHING`: Guardian Mode, Safety Snapshot & Soft Preference Matching
- **Behaviour**: Shared safety layer for in-person tutoring. Student profiles may include learner type, guardian details for minors, and safety preferences. When a request is created, Cloud Functions/client request services should copy only a bounded `safetySnapshot` into `classRequests` and later `sessions`, including whether the learner is a minor, whether guardian presence is required, whether a public meeting place is preferred, and whether same-gender tutor matching is preferred.

  Same-gender tutor matching must be a soft ranking preference, not a blanket hard exclusion. Backend tutor queue ranking may boost matching tutors when gender fields are present and consented, but if no preferred tutor is available the request should expose a clear fallback path: keep waiting for preferred tutors or continue with any verified eligible tutor. For minor learners, guardian presence is mandatory regardless of tutor gender.
- **Owning Area**: Cloud Functions, class request snapshots, tutor matching, and shared safety rules
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-011`), pending implementation.
- **Dependencies & References**: [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`mobile/src/services/classRequestService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/classRequestService.js), [`tutors/src/services/classRequestService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/classRequestService.js), [`mobile/src/components/common/SafetySupportModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/common/SafetySupportModal.js), [`tutors/src/components/common/SafetySupportModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/common/SafetySupportModal.js)
- **Unresolved Decisions**: Legal/policy review may later change preference wording, but launch implementation should avoid hard gender exclusion by default.

### `SH-STAGE-PRICING-AND-CANCELLATIONS`: Confirmed Stage-by-Stage Request & Cancellation Model (Approved)
- **Behaviour**: Part of **`JRN-CAN-FEE`** and **`JRN-SET-BILL`**. Authoritative rules for determining charges and payouts across the request lifecycle using the backend variables ($B, R, T, F_B$):

| Stage # | Lifecycle State (`status`) | Stage Description | Student Charge | Tutor Payout | Platform Allocation | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 1** | `pending` / `matching` | Searching for nearby tutors. No tutor accepted. | **R0.00 (Free)** | R0.00 | R0.00 | Free cancellation |
| **Stage 2** | `offered` | Direct offer sent to nearby tutor; awaiting acceptance. | **R0.00 (Free)** | R0.00 | R0.00 | Free cancellation |
| **Stage 3a** | `accepted` (<2 min) | Tutor accepted within past 2 minutes; pre-travel grace. | **R0.00 (Free)** | R0.00 | R0.00 | Accidental tap grace window |
| **Stage 3b** | `accepted` (>2 min pre-travel) | Tutor accepted over 2 min ago, preparing to depart. | $F_B$ (R1.00–R2.00) | R0.00 | $F_B$ | Compensates platform reservation |
| **Stage 4** | `travelling` | Tutor en route to student; GPS active; transit cost incurred. | $T + F_B$ | $T$ (100% travel) | $F_B$ (100% booking) | Fuel & transit reimbursed |
| **Stage 5** | `arrived` / `waiting_student` | Tutor arrived at address; 5-min arrival grace. | $T + \text{Lesson}_{30\text{m}} + F_B$ | $T + (\text{Lesson}_{30\text{m}} \times 0.73)$ | $F_B + (\text{Lesson}_{30\text{m}} \times 0.27)$ | Reimburses transit + 30 min minimum |
| **Stage 6** | `preparing_for_lesson` | Tutor met student; 5-min setup / 4-digit PIN active. | $T + \text{Lesson}_{30\text{m}} + F_B$ | $T + (\text{Lesson}_{30\text{m}} \times 0.73)$ | $F_B + (\text{Lesson}_{30\text{m}} \times 0.27)$ | Reimburses transit + 30 min minimum |
| **Stage 7** | `in_session` (Early Cancellation) | Lesson running; ended prematurely before agreed duration. | $T + \text{Tuition}_{\text{actual}} + F_B$ | $T + (\text{Tuition}_{\text{actual}} \times 0.73)$ | $F_B + (\text{Tuition}_{\text{actual}} \times 0.27)$ | Elapsed time (min 30 min) |
| **Stage 8** | `ending_requested` $\rightarrow$ `completed` | Full scheduled or agreed lesson completed. | $T + \text{Tuition}_{\text{actual}} + F_B$ | $T + (\text{Tuition}_{\text{actual}} \times 0.73)$ | $F_B + (\text{Tuition}_{\text{actual}} \times 0.27)$ | Normal full completion settlement |

- **Tutor Cancellation Policy**: If the tutor cancels at any stage prior to completed lesson, student pays **R0.00** (100% full refund), tutor receives R0.00, and a reliability infraction is recorded on the tutor's account.
- **Owning Area**: Cloud Functions (`functions/pricingEngine.js`, `functions/index.js`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved for implementation in `M1` (pricing engine calculations) and `M6` (settlement integration).
- **Dependencies & References**: [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js)
- **Unresolved Decisions**: None.

### `SH-PUBLIC-WEBSITES`: Public Informational Websites & APK Download Hub
- **Behaviour**: The public web surfaces at `/` and `/tutor` explain the tutoring service and direct visitors to download the respective Student and Tutor mobile APKs. All student/tutor web-app login, booking, dashboard, and lesson room links are unlinked from active public navigation and marketing CTAs. The underlying web app code (`web/src/pages/app/student/`, `web/src/pages/app/tutor/`) is preserved untouched in the codebase for post-launch/legacy use. The Admin Web App (`/app/admin/*`) remains fully functional and accessible.
- **Owning Area**: Web App (`web/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Partial (Unlinking of public CTAs and navigation scheduled for Milestone `M1`).
- **Dependencies & References**: [`web/src/pages/LandingPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/LandingPage.jsx), [`web/src/pages/TutorLandingPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/TutorLandingPage.jsx), [`web/src/pages/portal/PortalLandingPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/portal/PortalLandingPage.jsx), [`scripts/serve-student-download.mjs`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/scripts/serve-student-download.mjs), [`scripts/serve-tutors-download.mjs`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/scripts/serve-tutors-download.mjs)
- **Unresolved Decisions**: None.

### `SH-SECURITY-RULES`: Firestore & Storage Security Rules
- **Behaviour**: Strict role-based and participant-based data isolation:
  - Users can read/write their own profile; public tutor profile fields readable by authenticated users
  - Class requests and sessions readable and updateable only by student, assigned tutor, offered tutor, or admin
  - Tutor documents and background checks readable only by document owner and admin
  - Realtime database `/liveTracking/classRequests/$requestId` restricted to authenticated users
- **Owning Area**: Firebase Security Rules
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`firestore.rules`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/firestore.rules), [`database.rules.json`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/database.rules.json), [`storage.rules`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/storage.rules)
- **Unresolved Decisions**: None.

### `SH-AI-OCR`: Academic Brain & OCR Extraction Pipeline
- **Behaviour**: Extracts text and math equations from uploaded student assignment photos using PaddleOCR and Google Gemini models. Classifies subject and topic, and generates initial duration estimates.
- **Owning Area**: Cloud Functions & Supporting Services
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`functions/aiSubjectExtraction.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/aiSubjectExtraction.js), [`functions/geminiExtraction.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/geminiExtraction.js)
- **Unresolved Decisions**: None.

### `SH-LEGACY-WEB`: Preserved Legacy Student & Tutor Web Portals (Post-Launch)
- **Behaviour**: Older React Vite web applications for students and tutors (`web/src/pages/app/student/` and `web/src/pages/app/tutor/`). Preserved intact for desktop use in a later phase; unlinked from public launch navigation.
- **Owning Area**: Web App (`web/`)
- **Lifecycle**: Planned after launch (Preserved existing code; not primary launch target)
- **Implementation Status**: Inactive / Preserved.
- **Dependencies & References**: [`web/src/App.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/App.jsx)
- **Unresolved Decisions**: None.

### `SH-SCHEDULED-LESSONS`: Scheduled & Recurring Lesson System (Post-Launch Planning)
- **Behaviour**: Planned post-launch system for scheduled lessons and recurring lessons. Scheduled lessons should support finding/assigning a tutor now for a later time, with a fallback/replacement-tutor path if that tutor is unavailable when the lesson time arrives. Recurring lessons should eventually support same-tutor or different-tutor occurrences, advance payment where appropriate, and discounted recurring pricing.
- **Owning Area**: Cloud Functions, scheduling, tutor availability, notifications, and payments
- **Lifecycle**: Planned after launch
- **Implementation Status**: Proposed feature request (`REQ-009`), needs more planning.
- **Dependencies & References**: Future specification required before implementation.
- **Unresolved Decisions**: Booking states, advance payment/refunds, recurring discount model, replacement-tutor rules, calendar UX, and cancellation policy.

### `SH-REWARD-SYSTEM`: Broader Tutor/Student Rewards (Post-Launch Planning)
- **Behaviour**: Planned post-launch loyalty/reward system for both students and tutors. This is separate from launch referral free-minute rewards. It may notify users/tutors and grant rewards based on approved behaviours, but the system requires more planning before implementation.
- **Owning Area**: Cloud Functions, reward ledger, notifications, admin controls, and payout/budget tracking
- **Lifecycle**: Planned after launch
- **Implementation Status**: Proposed feature request (`REQ-010`), needs more planning.
- **Dependencies & References**: Future specification required before implementation.
- **Unresolved Decisions**: Reward names, qualifying actions, budget caps, expiry, anti-abuse gates, tutor fairness, accounting treatment, and admin controls.
