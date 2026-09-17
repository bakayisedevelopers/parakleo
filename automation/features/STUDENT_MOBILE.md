# Student Mobile App Features (`mobile/`)

> **Application**: Student Mobile App  
> **Repository Path**: [`mobile/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/)  
> **Tech Stack**: React Native 0.81.5, Expo SDK 54, Firebase JS SDK 11.10.0, `react-native-maps` 1.20.1, `expo-location` 19.0.8

---

## Cross-App Journeys Referenced
- **`JRN-REQ-MATCH`**: In-Person Class Request Creation, AI Extraction, and Matching Dispatch
- **`JRN-TRV-TRACK`**: Live Map Tracking & ETA Countdown during Tutor Travel (3s interval)
- **`JRN-ARR-PREP`**: Tutor Arrival Notification, Grace Period, and Lesson Preparation
- **`JRN-SES-TIMER`**: One-Time PIN Entry, Lesson Start, Active Timer, and Running Cost Display
- **`JRN-SET-BILL`**: Final Billing Settlement, Payment Receipt, and Rating
- **`JRN-CAN-FEE`**: Distance-Based Cancellation Quote and Fee Processing

---

## Feature Inventory

### `STU-AUTH`: Student Authentication & Password Recovery
- **Behaviour**: Students sign up with email and password, log in with active credentials, or reset forgotten passwords via email link. On login, profile data is loaded from Firestore `users/{uid}`.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`mobile/src/context/AuthContext.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/context/AuthContext.js), [`mobile/src/screens/auth/LoginScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/auth/LoginScreen.js), [`mobile/src/screens/auth/SignupScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/auth/SignupScreen.js), [`mobile/src/screens/auth/ForgotPasswordScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/auth/ForgotPasswordScreen.js)
- **Unresolved Decisions**: None.

### `STU-ONBOARD`: Student Academic Profile Onboarding
- **Behaviour**: Enforces initial profile setup before tutoring requests can be placed. Collects grade/level, school/institution, and learning objectives.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`mobile/src/screens/student/OnboardingScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/OnboardingScreen.js), [`mobile/src/utils/onboarding.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/utils/onboarding.js)
- **Unresolved Decisions**: None.

### `STU-ONBOARD-REVAMP`: Student Onboarding Completion Criteria, Selfie & Optional Card
- **Behaviour**: Part of the initial student account readiness flow. Student onboarding should mark the profile complete after required identity/profile fields, subject/learning profile selection, required selfie capture, phone number verification, and email verification are completed. Card setup must be optional and framed as a convenience step, not a blocker. If the student skips card setup, the app should default to the existing cash payment method. If the student adds a card, Paystack verification remains available and the card may become the preferred payment method.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-005`), pending implementation.
- **Dependencies & References**: [`mobile/src/screens/student/OnboardingScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/OnboardingScreen.js), [`mobile/src/context/AuthContext.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/context/AuthContext.js), [`mobile/src/services/userService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/userService.js), [`mobile/src/screens/student/WalletScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/WalletScreen.js)
- **Unresolved Decisions**: None. Coordinate with `REQ-006`: referral rewards must not be granted solely on profile completion.

### `STU-LAUNCH-PROMOS`: First-Lesson Discount & New-Student Offer
- **Behaviour**: New students receive a launch promotion of 25% off their first completed paid lesson, capped at R50 maximum discount. This replaces automatic new-account free minutes/free lesson entitlement. The first-lesson discount should be shown transparently against the full student-facing order total for the first lesson.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-006`), pending implementation.
- **Dependencies & References**: [`mobile/src/components/student/StudentRequestComposer.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/StudentRequestComposer.js), [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js), [`mobile/src/screens/student/SessionSummaryScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionSummaryScreen.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js)
- **Unresolved Decisions**: Implementation must confirm whether the R50 cap is applied before or after booking fee rounding in backend settlement snapshots.

### `STU-REFERRAL-UI`: Qualified Referral Free-Minute Rewards
- **Behaviour**: Students can share their referral link from the home/profile referral surfaces. The referring student receives 15 free minutes only after the referred student verifies email and phone, completes onboarding, completes their first paid/discounted lesson, and the lesson remains completed without cancellation, refund, or dispute. Referral copy must no longer claim that profile completion alone grants the reward.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-006`), pending implementation.
- **Dependencies & References**: [`mobile/src/screens/student/DashboardScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/DashboardScreen.js), [`mobile/src/screens/student/ProfileScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/ProfileScreen.js), [`mobile/src/services/userService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/userService.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js)
- **Unresolved Decisions**: None for launch. Broader loyalty/reward systems remain post-launch under `REQ-010`.

### `STU-UI-POLISH`: Figma-Like Visual Polish While Preserving Brand Colours
- **Behaviour**: Improve Student Mobile visual polish with cleaner iconography, spacing, and Figma-like UI treatment while preserving the existing Parakleo colour system and core flows. Focus on launch-critical student areas such as onboarding, payments, referrals, request confirmation, and session status screens.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-008`), pending implementation.
- **Dependencies & References**: Launch student screens touched by `REQ-005`, `REQ-006`, `BUG-005`, and `BUG-006`.
- **Unresolved Decisions**: None. This is scoped polish, not a broad redesign.

### `STU-SAFETY-PROFILE`: Student Safety Profile & Guardian Mode
- **Behaviour**: Student Mobile should collect and persist safety profile information as part of onboarding/profile completion for in-person tutoring. The profile should identify whether the learner is an adult or under 18. Minor learners require guardian mode: guardian name, relationship, phone number, optional email, consent/presence confirmation, and a default guardian-presence-required flag for in-person lessons. Adult learners can still choose safety preferences such as public meeting place preference and same-gender tutor preference.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-011`), pending implementation.
- **Dependencies & References**: [`mobile/src/screens/student/OnboardingScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/OnboardingScreen.js), [`mobile/src/utils/onboarding.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/utils/onboarding.js), [`mobile/src/services/userService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/userService.js), [`mobile/src/screens/student/ProfileScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/ProfileScreen.js)
- **Unresolved Decisions**: Exact age-capture UX can be either date of birth or age confirmation, but the implementation must clearly support under-18 guardian mode.

### `STU-GUARDIAN-MODE`: Guardian Presence Request & Session Safety Flow
- **Behaviour**: For minor learners, every in-person request should require guardian presence confirmation and carry a bounded `safetySnapshot` into the request/session. Student request confirmation should remind the student/guardian that a guardian must be present. Student session and Safety Center screens should allow sharing session/location details with a trusted contact or guardian, and safety cancellation remains available without penalty.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-011`), pending implementation.
- **Dependencies & References**: [`mobile/src/components/student/StudentRequestComposer.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/StudentRequestComposer.js), [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js), [`mobile/src/components/common/SafetySupportModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/common/SafetySupportModal.js), [`mobile/src/services/classRequestService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/classRequestService.js)
- **Unresolved Decisions**: None. Guardian presence is required for minors; same-gender matching is a soft preference.

### `STU-TUTOR-PREFERENCES`: Same-Gender Tutor Preference & Safe Meeting Preference
- **Behaviour**: Students or guardians can optionally prefer same-gender tutors and public/safe meeting places. Same-gender preference should be presented as a preference, not a mandatory exclusion. If no preferred tutor is available, the app should allow the student/guardian to keep waiting or continue with any verified tutor.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-011`), pending implementation.
- **Dependencies & References**: [`mobile/src/screens/student/OnboardingScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/OnboardingScreen.js), [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js)
- **Unresolved Decisions**: None. Do not implement a blanket gender hard block unless the owner later approves a separate legal/product policy.

### `STU-REQ-CREATE`: Request Composition & Problem Intake (Attachment / Description)
- **Behaviour**: Part of **`JRN-REQ-MATCH`**. Student can either take/upload a photo/document of their academic problem or type a text description. The problem is processed via OCR/AI classification to identify the subject, topic, and estimated duration, generating an upfront price quote.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`mobile/src/screens/student/DashboardScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/DashboardScreen.js), [`mobile/src/components/student/DescribeRequestModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/DescribeRequestModal.js), [`mobile/src/components/student/AttachmentPickerModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/AttachmentPickerModal.js), [`functions/aiSubjectExtraction.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/aiSubjectExtraction.js), [`mobile/src/services/pricingService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/pricingService.js)
- **Unresolved Decisions**: None.

### `STU-REQ-CONFIRM`: In-Person Request Review & Dynamic Backend Pricing Quote
- **Behaviour**: Part of **`JRN-REQ-MATCH`**. Shows review screen before dispatching request. Student confirms meeting location (GPS coordinates + specific notes like "Library 2nd floor"), lesson duration, payment method, and **dynamic backend pricing quote** retrieved via `getPricingQuote`:
  - **No Hard-Coded Rates**: Removes all client hardcoded fallbacks (`1.8`, `LOCAL_TRANSFER_FEE = 40`). All values (Base Price $B$, Rate per Minute $R$, Travel Surcharge $T$, and Booking Fee $F_B$) are computed authoritative outputs from Cloud Functions.
  - Displays full itemized upfront estimate: Lesson Tuition ($B + \text{Duration} \times R$), Route Travel Surcharge ($T$: R40 base + R4/km beyond 10km), and Booking Fee ($F_B$: 1% bounded R1.00–R2.00). Submits request to `classRequests` with authoritative pricing snapshot attached.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Partial (Client UI in `SessionScreen.js` needs hardcoded constants replaced with dynamic backend quote parameters; active request persistence across app reboots required).
- **Dependencies & References**: [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js), [`mobile/src/services/pricingService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/pricingService.js), [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js)
- **Unresolved Decisions**: None.

### `STU-LIVE-TRACK`: Live En-Route Map Tracking HUD & ETA Countdown (3s Interval)
- **Behaviour**: Part of **`JRN-TRV-TRACK`**. Once a tutor accepts and begins travel (`status: 'travelling'`), the student sees a live full-screen map with tutor location marker, student destination marker, route polyline, live ETA countdown, and vehicle/tutor details. Listens to Firebase Realtime Database at `liveTracking/classRequests/{requestId}` targeted at 3-second updates.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code (`SessionMapView.js` renders real Google Maps polyline and markers; RTDB subscription handles live coordinate updates).
- **Dependencies & References**: [`mobile/src/components/student/SessionMapView.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/SessionMapView.js), [`mobile/src/services/liveTrackingRealtimeService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/liveTrackingRealtimeService.js), [`mobile/src/screens/student/RequestStatusScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/RequestStatusScreen.js)
- **Unresolved Decisions**: None.

### `STU-ARR-PREP`: Tutor Arrival Notification & Preparation Grace Period
- **Behaviour**: Part of **`JRN-ARR-PREP`**. When the tutor arrives at the student destination (`status: 'arrived'`), student receives an alert and sees a 5-minute arrival grace period countdown. Transitions to `preparing_for_lesson` with another 5-minute preparation grace period while the tutor and student sit down and unpack materials before billing begins.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Partial (UI status badges exist in `SessionScreen.js`, but backend-synchronized grace timers require final binding).
- **Dependencies & References**: [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js), [`functions/lessonStatus.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/lessonStatus.js), [`mobile/src/constants/lessonStatus.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/constants/lessonStatus.js)
- **Unresolved Decisions**: None.

### `STU-PIN-INPUT`: Physical Meeting Verification PIN Entry
- **Behaviour**: Part of **`JRN-SES-TIMER`**. When the tutor arrives and presents the short one-time PIN shown on the tutor's device, the student inputs this PIN in the Student Mobile App. The app calls the backend verification endpoint to confirm the tutor and student are physically co-located.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Partial (PIN input sheet/modal to be wired in `SessionScreen.js`).
- **Dependencies & References**: [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js)
- **Unresolved Decisions**: Exact PIN length, and whether verification starts billing immediately or initiates/completes the preparation grace period.

### `STU-ACTIVE-LESSON`: Active Lesson Timer & Running Cost HUD
- **Behaviour**: Part of **`JRN-SES-TIMER`**. Once the lesson starts (`status: 'in_session'`), the student sees an active session HUD with an elapsed time counter, calculated running estimated cost based on per-minute agreed rate, tutor info, topic notes, safety support modal, and an "End Lesson & Settle" action. PIN verification starts a 5-minute preparation grace window; billing clock begins when either party taps "Start Lesson" or when the 5-minute grace elapses.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code (`ActiveSessionScreen.js`).
- **Dependencies & References**: [`mobile/src/screens/student/ActiveSessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/ActiveSessionScreen.js), [`mobile/src/services/sessionService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/sessionService.js)
- **Unresolved Decisions**: None.

### `STU-SETTLE-RATING`: Lesson Summary, Final Billing Breakdown & Rating
- **Behaviour**: Part of **`JRN-SET-BILL`**. After lesson closure (`status: 'completed'` or `'settled'`), student is routed to `SessionSummaryScreen` showing final billed minutes, lesson rate, travel fee (R40+), platform booking fee (1%, R1–R2), total charged amount, payment card charged, and a 5-star rating submission form with tags and feedback.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`mobile/src/screens/student/SessionSummaryScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionSummaryScreen.js), [`mobile/src/components/student/SessionRatingPrompt.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/SessionRatingPrompt.js), [`mobile/src/services/sessionService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/sessionService.js)
- **Unresolved Decisions**: None.

### `STU-CANCEL-FEE`: In-Person Cancellation Flow & Stage Breakdown Modal (Approved Policy)
- **Behaviour**: Part of **`JRN-CAN-FEE`**. When the student initiates cancellation, the app requests an authoritative cancellation quote from the backend (`getCancellationQuote`) and displays a confirmation modal with the stage-based breakdown:
  - **Stages 1–3a (`pending`, `matching`, `offered`, `accepted` <2 min)**: Explicitly displays **R0.00 (Free cancellation)**.
  - **Stage 3b (`accepted` >2 min pre-travel)**: Displays Booking Fee only (R1.00–R2.00).
  - **Stage 4 (`travelling`)**: Displays Travel Surcharge (R40.00 base + R4.00/km > 10 km) + Booking Fee (R1.00–R2.00).
  - **Stages 5–6 (`arrived`, `preparing`)**: Displays Travel Surcharge + 30-min minimum lesson fee + Booking Fee.
  - **Stage 7 (`in_session`)**: Displays Travel Surcharge + actual elapsed billable time (min 30 min) + Booking Fee.
  - Student must explicitly confirm the displayed fee before the cancellation API (`cancelInPersonLesson`) executes.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Partial (Cancellation modal exists in `CancellationQuoteModal.js`; backend quote integration scheduled for Milestone `M6`).
- **Dependencies & References**: [`mobile/src/components/common/CancellationQuoteModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/common/CancellationQuoteModal.js), [`mobile/src/services/sessionService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/sessionService.js), [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js)
- **Unresolved Decisions**: None.

### `STU-PAY-WALLET`: Payment Method Management & Wallet Debt Clearance
- **Behaviour**: Student adds payment cards via Paystack WebView authorization (`verifyPaystack`). Displays stored card tokens, outstanding balances/debt, and allows 1-tap debt settlement.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`mobile/src/screens/student/WalletScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/WalletScreen.js), [`mobile/src/components/student/PaystackAuthorizationModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/PaystackAuthorizationModal.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js)
- **Unresolved Decisions**: None.

### `STU-ONL-CLASS`: Online Classroom & Whiteboard (Preserved Post-Launch)
- **Behaviour**: Part of **`JRN-ONL-CLASS`**. WebRTC video/audio call and collaborative whiteboard canvas via WebView.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Planned after launch (Preserved existing code; excluded from initial in-person launch)
- **Implementation Status**: Inactive / Preserved (`SessionRoomScreen.js`).
- **Dependencies & References**: [`mobile/src/screens/student/SessionRoomScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionRoomScreen.js)
- **Unresolved Decisions**: Deferred to post-launch phase.

### `STU-SCHEDULED-BOOKING`: Scheduled & Recurring Lessons (Post-Launch Planning)
- **Behaviour**: Planned post-launch booking flow for scheduled lessons and recurring lessons. Scheduled lessons should allow students to arrange a future in-person lesson. Recurring lessons may use the same tutor or different tutors at each occurrence, with possible advance payment and discounted recurring pricing.
- **Owning App**: Student Mobile App (`mobile/`)
- **Lifecycle**: Planned after launch
- **Implementation Status**: Proposed feature request (`REQ-009`), needs more planning.
- **Dependencies & References**: Future scheduling/calendar, payment, cancellation, tutor availability, and replacement-tutor planning.
- **Unresolved Decisions**: Needs complete specification before implementation.
