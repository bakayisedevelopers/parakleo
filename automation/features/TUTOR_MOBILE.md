# Tutor Mobile App Features (`tutors/`)

> **Application**: Tutor Mobile App  
> **Repository Path**: [`tutors/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/)  
> **Tech Stack**: React Native 0.81.5, Expo SDK 54, Firebase JS SDK 11.10.0, `@googlemaps/react-native-navigation-sdk` 0.16.3, `expo-location` 19.0.8, `expo-document-picker` 14.0.8

---

## Cross-App Journeys Referenced
- **`JRN-TUT-ONBOARD`**: Tutor Onboarding, Document Submission & Admin Verification Approval
- **`JRN-REQ-MATCH`**: Incoming Timed Class Offer, Subject Verification, and Acceptance
- **`JRN-TRV-TRACK`**: Turn-by-Turn Navigation, Route Guidance, and 3-Second RTDB GPS Streaming
- **`JRN-ARR-PREP`**: Arrival Detection (50m), One-Time PIN Display, Grace Periods, and Material Setup
- **`JRN-SES-TIMER`**: Synchronized In-Person Lesson Timer and Session Completion
- **`JRN-SET-BILL`**: Final Lesson Closure, Payout Calculation (73% lesson fee + 100% travel fee)
- **`JRN-CAN-FEE`**: Cancellation Handling, Travel Compensation, and No-Payout State Transitions

---

## Feature Inventory

### `TUT-AUTH`: Tutor Authentication & Profile Persistence
- **Behaviour**: Tutors sign up with email and password, sign in, and persist their authentication state. The profile is fetched from Firestore `users/{uid}`, containing `tutorProfile`, subjects, verification status, and payout accounts.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/context/AuthContext.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/context/AuthContext.js), [`tutors/src/screens/auth/HomeScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/auth/HomeScreen.js), [`tutors/src/screens/auth/LoginScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/auth/LoginScreen.js), [`tutors/src/screens/auth/SignupScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/auth/SignupScreen.js)
- **Unresolved Decisions**: None.

### `TUT-ONBOARD-DOC`: Onboarding Wizard & Document Verification Submission
- **Behaviour**: Part of **`JRN-TUT-ONBOARD`**. Tutors complete mandatory onboarding steps before being eligible to receive student offers:
  1. Personal Profile (phone, bio, headline, profile photo/selfie)
  2. Academic Qualifications (upload Matric / University transcript PDFs via `expo-document-picker`)
  3. Police Clearance / Background Check (upload official clearance certificate PDF)
  4. Right-to-work identity verification (upload South African ID document, or passport plus valid South African work visa/right-to-work evidence)
  5. Payout Banking Information (bank name, account type, account number, branch code)
  Documents are written to Firestore `tutorDocuments` and storage bucket, entering the Admin review queue. Police clearance and right-to-work identity documentation are both required; one must not substitute for the other. These documents are manually reviewed by an admin, not verified by AI. Tutors remain blocked from going online or receiving offers until admin approval is granted.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed baseline in code; approved right-to-work hardening (`REQ-007`) pending implementation.
- **Dependencies & References**: [`tutors/src/screens/onboarding/TutorOnboardingScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/onboarding/TutorOnboardingScreen.js), [`tutors/src/services/tutorDocumentService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/tutorDocumentService.js), [`tutors/src/constants/onboarding.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/constants/onboarding.js), [`web/src/pages/app/admin/AdminTutorDetailsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminTutorDetailsPage.jsx)
- **Unresolved Decisions**: None.

### `TUT-AGREEMENT`: Independent Contractor Agreement Digital Execution
- **Behaviour**: Part of **`JRN-TUT-ONBOARD`**. Tutors review the latest published Parakleo Tutor Agreement, sign digitally with full legal name, date, and agreement version hash. The signed agreement is stored in Firestore and emailed to both tutor and platform records. The agreement must clearly and prominently disclose the launch promotional payout rule: for first-time-user promotional lessons, the tutor receives 75% of the discounted total amount paid/settled for that lesson, inclusive of travel and lesson compensation for that promotional booking.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/screens/onboarding/TutorAgreementScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/onboarding/TutorAgreementScreen.js), [`tutors/src/services/legalAgreementService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/legalAgreementService.js), [`functions/legalAgreements.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/legalAgreements.js)
- **Unresolved Decisions**: None.

### `TUT-ONLINE-STATUS`: Online Availability Toggle & Location Readiness
- **Behaviour**: Tutor toggles their online/offline state via the dashboard dial. Going online updates `users/{uid}.isOnline = true` and records current GPS coordinates so the Cloud Functions proximity matching engine can locate and rank the tutor for nearby in-person requests.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/screens/dashboard/TutorDashboardScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/dashboard/TutorDashboardScreen.js), [`tutors/src/components/dashboard/CircularOnlineDial.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/dashboard/CircularOnlineDial.js), [`tutors/src/services/userService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/userService.js), [`tutors/src/services/locationService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/locationService.js)
- **Unresolved Decisions**: None.

### `TUT-OFFER-POPUP`: High-Priority Timed Incoming Offer HUD (45s Window)
- **Behaviour**: Part of **`JRN-REQ-MATCH`**. When an in-person request matches a tutor's subjects and location, Cloud Functions writes `offered` to `classRequests/{requestId}` with `currentOfferTutorId: tutorId` and a 45-second expiration timer. The tutor app displays a global pop-up overlay (`TutorOfferOverlay`) with audible chime and countdown bar showing subject, topic description, student distance, estimated payout, and R40+ travel fee.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/components/offers/TutorOfferOverlay.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/offers/TutorOfferOverlay.js), [`tutors/src/components/offers/OfferCountdownModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/offers/OfferCountdownModal.js), [`tutors/src/services/classRequestService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/classRequestService.js)
- **Unresolved Decisions**: None.

### `TUT-SAFETY-BADGES`: Guardian Mode & Safety Requirements in Tutor Flow
- **Behaviour**: Tutor Mobile should show safety requirements from the request `safetySnapshot` before a tutor accepts an offer and throughout navigation/arrival/session preparation. Offer cards and incoming offer overlays should show badges such as `Minor learner`, `Guardian present required`, `Public place preferred`, and `Same-gender preferred` where applicable. Tutor Navigation and Active Session screens should remind the tutor not to begin the lesson unless the required guardian/safe-location condition is satisfied.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-011`), pending implementation.
- **Dependencies & References**: [`tutors/src/components/offers/TutorOfferOverlay.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/offers/TutorOfferOverlay.js), [`tutors/src/components/offers/OfferCountdownModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/offers/OfferCountdownModal.js), [`tutors/src/screens/navigation/TutorNavigationScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/navigation/TutorNavigationScreen.js), [`tutors/src/screens/session/TutorActiveSessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/session/TutorActiveSessionScreen.js), [`tutors/src/components/common/SafetySupportModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/common/SafetySupportModal.js)
- **Unresolved Decisions**: None. Tutor visibility should use a bounded safety snapshot and avoid exposing unnecessary private guardian data.

### `TUT-NAV-SDK`: Turn-by-Turn In-Person Navigation & Travel HUD
- **Behaviour**: Part of **`JRN-TRV-TRACK`**. Accepting an in-person offer immediately launches `TutorNavigationScreen` powered by `@googlemaps/react-native-navigation-sdk`. Sets destination coordinates from the student request, starts turn-by-turn visual and voice driving guidance, displays student destination notes, and provides 1-tap call/message actions.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/screens/navigation/TutorNavigationScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/navigation/TutorNavigationScreen.js), [`tutors/src/services/sessionService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/sessionService.js)
- **Unresolved Decisions**: None.

### `TUT-GPS-STREAM`: 3-Second Realtime GPS Telemetry Streaming to RTDB
- **Behaviour**: Part of **`JRN-TRV-TRACK`**. While en route, tutor GPS coordinates (`latitude`, `longitude`, `heading`, `speed`, `distanceRemaining`, `etaSeconds`) are continuously streamed at **3-second intervals** to Firebase Realtime Database at `liveTracking/classRequests/{requestId}` for smooth student map tracking.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/services/liveTrackingRealtimeService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/liveTrackingRealtimeService.js), [`database.rules.json`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/database.rules.json)
- **Unresolved Decisions**: None.

### `TUT-ARR-PREP`: 50m Arrival Proximity Gate & Lesson Preparation Transition
- **Behaviour**: Part of **`JRN-ARR-PREP`**. When the tutor arrives within 50 meters of the student location, the navigation SDK arrival callback triggers a transition to `status: 'arrived'`. The 5-minute arrival grace countdown begins. Once tutor and student meet physically, tutor taps "Preparing for lesson" (`status: 'preparing_for_lesson'`) to allow a 5-minute material setup window before billing begins.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/screens/navigation/TutorNavigationScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/navigation/TutorNavigationScreen.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`tutors/src/constants/lessonStatus.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/constants/lessonStatus.js)
- **Unresolved Decisions**: None.

### `TUT-PIN-DISPLAY`: 4-Digit Physical Meeting PIN Display
- **Behaviour**: Part of **`JRN-ARR-PREP`** & **`JRN-SES-TIMER`**. On arrival, the tutor's navigation and arrival HUD displays the **4-digit one-time PIN** generated server-side for the session. The tutor presents this PIN to the student. When the student successfully enters the 4-digit PIN in their app, physical co-location is confirmed and the 5-minute preparation grace window begins.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Partial (PIN display card in `TutorNavigationScreen.js` bottom sheet).
- **Dependencies & References**: [`tutors/src/screens/navigation/TutorNavigationScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/navigation/TutorNavigationScreen.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js)
- **Unresolved Decisions**: None.

### `TUT-ACTIVE-LESSON`: Active In-Person Lesson Timer & Session Closure
- **Behaviour**: Part of **`JRN-SES-TIMER`** and **`JRN-SET-BILL`**. When lesson begins (`status: 'in_session'`), the tutor app transitions to `TutorActiveSessionScreen`. Displays elapsed time, current accumulated payout amount, subject/topic, student details, safety support, and an "End Lesson & Settle" button. Ending the lesson invokes `finalizeSessionBilling` on the server to settle payment.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/screens/session/TutorActiveSessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/session/TutorActiveSessionScreen.js), [`tutors/src/screens/session/TutorSessionSummaryScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/session/TutorSessionSummaryScreen.js), [`tutors/src/services/sessionService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/sessionService.js)
- **Unresolved Decisions**: None.

### `TUT-PAYOUTS`: Earnings Dashboard & Payout Account Setup (73% Split on Tuition, 100% on Travel)
- **Behaviour**: Displays historical earnings, completed in-person sessions, weekly payout breakdowns, and bank account settings. Payout calculations credit the tutor with **73% of applicable billable lesson revenue** and **100% of the travel surcharge** (R40.00 base + R4.00/km beyond 10 km). All rates and fees are dynamically populated from server-side pricing snapshots, with zero hardcoded client calculation fallbacks.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`tutors/src/screens/payments/TutorPaymentsScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/payments/TutorPaymentsScreen.js), [`tutors/src/components/payments/EarningsSummaryCard.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/payments/EarningsSummaryCard.js), [`tutors/src/components/payments/BankingDetailsCard.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/payments/BankingDetailsCard.js), [`tutors/src/services/payoutService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/payoutService.js)
- **Unresolved Decisions**: None.

### `TUT-LAUNCH-PROMO-PAYOUT`: First-Lesson Promotional Payout Disclosure
- **Behaviour**: For launch first-time-user promotional lessons, tutors are paid 75% of the discounted total amount paid/settled for that promotional lesson. This promotional payout is inclusive of travel compensation and lesson compensation for that booking, and must be disclosed clearly in the Tutor Agreement before tutors accept work. Normal non-promotional payouts continue to follow the standard 73% lesson revenue plus 100% travel surcharge model unless the backend pricing snapshot explicitly identifies the promotional payout path.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved feature request (`REQ-006`), pending implementation.
- **Dependencies & References**: [`tutors/src/screens/payments/TutorPaymentsScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/payments/TutorPaymentsScreen.js), [`tutors/src/screens/session/TutorSessionSummaryScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/session/TutorSessionSummaryScreen.js), [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js), [`functions/legalAgreements.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/legalAgreements.js)
- **Unresolved Decisions**: None.

### `TUT-CANCEL-HANDLING`: Stage-Based Cancellation Compensation (Approved Policy)
- **Behaviour**: Part of **`JRN-CAN-FEE`**. Protects tutors against dead mileage and lost time if a student cancels:
  - **Cancellation while Travelling**: Tutor receives 100% of the calculated travel surcharge ($T$) for transit costs incurred.
  - **Cancellation after Arrival / Preparation**: Tutor receives 100% of the travel surcharge ($T$) plus 73% of the 30-minute minimum lesson charge.
  - **Cancellation during Active Lesson**: Tutor receives 100% of the travel surcharge ($T$) plus 73% of actual elapsed lesson tuition (subject to 30-min minimum).
  - **Tutor-Initiated Cancellation**: If the tutor cancels at any stage, the tutor receives R0.00 payout and the cancellation is recorded against their reliability rating.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Approved for implementation in `M6`.
- **Dependencies & References**: [`tutors/src/services/sessionService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/sessionService.js), [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js)
- **Unresolved Decisions**: None.

### `TUT-ONL-CLASS`: Online Classroom & WebRTC (Preserved Post-Launch)
- **Behaviour**: Part of **`JRN-ONL-CLASS`**. WebRTC audio/video call and collaborative whiteboard canvas.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Planned after launch (Preserved existing code; excluded from initial in-person launch)
- **Implementation Status**: Inactive / Preserved (`SessionRoomScreen.js` and `TutorRtcSessionView.js`).
- **Dependencies & References**: [`tutors/src/screens/session/SessionRoomScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/session/SessionRoomScreen.js)
- **Unresolved Decisions**: Deferred to post-launch phase.

### `TUT-SCHEDULED-AVAILABILITY`: Scheduled & Recurring Lesson Availability (Post-Launch Planning)
- **Behaviour**: Planned post-launch tutor availability and scheduling support for future lessons and recurring lessons. Tutors may be assigned to future lessons, and the system must define what happens if the tutor is unavailable when the scheduled time arrives.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Planned after launch
- **Implementation Status**: Proposed feature request (`REQ-009`), needs more planning.
- **Dependencies & References**: Future availability calendar, notifications, cancellation/refund handling, replacement tutor matching, and recurring payment rules.
- **Unresolved Decisions**: Needs complete specification before implementation.

### `TUT-LOYALTY`: Tutor Reward System (Post-Launch Planning)
- **Behaviour**: Planned post-launch reward system for tutors. The handwritten intake requested a reward system that can notify tutors/users and reward tutors/students, but the exact reward names, eligible actions, budget caps, and fairness rules still need planning.
- **Owning App**: Tutor Mobile App (`tutors/`)
- **Lifecycle**: Planned after launch
- **Implementation Status**: Proposed feature request (`REQ-010`), needs more planning.
- **Dependencies & References**: Future reward ledger, notification service, payout/budget controls, and admin configuration.
- **Unresolved Decisions**: Needs complete specification before implementation.
