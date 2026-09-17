# Tutor Mobile App Supporting Plan (`tutors/`)

> **Application**: Tutor Mobile App  
> **Source Directory**: [`tutors/src/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/)  
> **Parent Master Plan**: [`automation/MASTER_PLAN.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/MASTER_PLAN.md)

---

## 1. Discovered App Architecture

- **Entry Point**: [`tutors/App.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/App.js)
- **Root Navigator**: [`tutors/src/navigation/RootNavigator.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/navigation/RootNavigator.js)
- **Primary In-Person Screens**:
  - `TutorDashboardScreen`: [`tutors/src/screens/dashboard/TutorDashboardScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/dashboard/TutorDashboardScreen.js)
  - `TutorOnboardingScreen`: [`tutors/src/screens/onboarding/TutorOnboardingScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/onboarding/TutorOnboardingScreen.js)
  - `TutorAgreementScreen`: [`tutors/src/screens/onboarding/TutorAgreementScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/onboarding/TutorAgreementScreen.js)
  - `TutorNavigationScreen`: [`tutors/src/screens/navigation/TutorNavigationScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/navigation/TutorNavigationScreen.js)
  - `TutorActiveSessionScreen`: [`tutors/src/screens/session/TutorActiveSessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/session/TutorActiveSessionScreen.js)
  - `TutorSessionSummaryScreen`: [`tutors/src/screens/session/TutorSessionSummaryScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/session/TutorSessionSummaryScreen.js)
  - `TutorSessionsScreen`: [`tutors/src/screens/history/TutorSessionsScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/history/TutorSessionsScreen.js)
  - `TutorPaymentsScreen`: [`tutors/src/screens/payments/TutorPaymentsScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/screens/payments/TutorPaymentsScreen.js)
- **Key Components**:
  - `TutorOfferOverlay`: [`tutors/src/components/offers/TutorOfferOverlay.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/offers/TutorOfferOverlay.js)
  - `CircularOnlineDial`: [`tutors/src/components/dashboard/CircularOnlineDial.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/dashboard/CircularOnlineDial.js)
  - `CancellationQuoteModal`: [`tutors/src/components/common/CancellationQuoteModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/common/CancellationQuoteModal.js)
  - `SafetySupportModal`: [`tutors/src/components/common/SafetySupportModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/components/common/SafetySupportModal.js)
- **Core Services**:
  - `classRequestService.js`: [`tutors/src/services/classRequestService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/classRequestService.js)
  - `sessionService.js`: [`tutors/src/services/sessionService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/sessionService.js)
  - `liveTrackingRealtimeService.js`: [`tutors/src/services/liveTrackingRealtimeService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/liveTrackingRealtimeService.js)
  - `tutorDocumentService.js`: [`tutors/src/services/tutorDocumentService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/tutorDocumentService.js)
  - `legalAgreementService.js`: [`tutors/src/services/legalAgreementService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/legalAgreementService.js)
  - `payoutService.js`: [`tutors/src/services/payoutService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/src/services/payoutService.js)

---

## 2. Milestone Implementation Matrix

### Phase M0 — Contract & Pricing Alignment
- **Feature IDs**: `SH-STATUS-MACHINE`, `SH-PRICING-ENGINE`
- **Existing Implementation**:
  - `tutors/src/constants/lessonStatus.js` contains the canonical `LESSON_STATUS`.
  - Payout rules: 73% Tutor / 27% Platform.
- **Tasks**:
  - Centralize travel fee constant: R40.00 base up to 10 km + R4.00/km beyond 10 km (100% to tutor).
  - Update `tutors/src/constants/pricing.js` to reference confirmed 73/27 revenue split.
- **Checks**:
  - Verify syntax and exports of `tutors/src/constants/lessonStatus.js` and `tutors/src/constants/pricing.js`.

### Phase M1 — Onboarding Document Submission & Digital Agreement
- **Feature IDs**: `TUT-ONBOARD-DOC`, `TUT-AGREEMENT`
- **Existing Implementation**:
  - `TutorOnboardingScreen.js` implements 4-step wizard (Profile, Academic Results, Police Clearance, Banking Details).
  - `TutorAgreementScreen.js` displays full legal contract and captures digital signature.
- **Tasks**:
  - Ensure real-time profile listener in `AuthContext.js` properly refreshes `verificationStatus` and unlocks online dial immediately when approved in Admin Web.
- **Checks**:
  - Upload test document; verify file exists in Firebase Storage and record exists in Firestore `tutorDocuments`.

### Phase M2 — 45-Second Timed Incoming Offer HUD
- **Feature IDs**: `TUT-ONLINE-STATUS`, `TUT-OFFER-POPUP`
- **Existing Implementation**:
  - `CircularOnlineDial.js` sets `isOnline = true` and updates tutor GPS.
  - `TutorOfferOverlay.js` renders floating modal with 45-second animated countdown bar.
- **Tasks**:
  - Verify offer acceptance immediately transitions app to `TutorNavigationScreen.js` with active request params.
- **Checks**:
  - Verify offer timer counts down from 45 seconds to 0; verify auto-dismissal on expiration.

### Phase M3 — Turn-by-Turn Navigation & 3-Second Telemetry Streaming
- **Feature IDs**: `TUT-NAV-SDK`, `TUT-GPS-STREAM`, `SH-RTDB-TELEMETRY`
- **Existing Implementation**:
  - `TutorNavigationScreen.js` initializes `@googlemaps/react-native-navigation-sdk`, sets destination, and starts driving guidance.
  - Subscribes to location changes and writes to RTDB `liveTracking/classRequests/{requestId}`.
- **Tasks**:
  - Tune GPS throttling to target a stable **3-second interval** during active travel.
- **Checks**:
  - Verify RTDB writes occur every 3 seconds while driving; inspect write frequency in RTDB console.

### Phase M4 & M5 — Arrival Detection, One-Time PIN Display & Active Lesson HUD
- **Feature IDs**: `TUT-ARR-PREP`, `TUT-PIN-DISPLAY`, `TUT-ACTIVE-LESSON`, `SH-PIN-VERIFICATION`
- **Existing Implementation**:
  - Navigation SDK arrival callback invokes backend `markTutorArrived`.
  - "Preparing for lesson" button invokes backend `markPreparingForLesson` (with 5-minute prep grace window).
  - `TutorActiveSessionScreen.js` displays active session elapsed timer, student info, and end lesson button.
- **Tasks**:
  - Display the server-generated short one-time PIN prominently in the bottom sheet card of `TutorNavigationScreen.js` upon arrival.
  - Add instructions: *"Share this PIN with the student to verify meeting and proceed to lesson."*
  - Listen for session transition: when the student submits the valid PIN, state transitions to `preparing_for_lesson` with the 5-minute preparation grace countdown timer; transitions to `TutorActiveSessionScreen.js` when either party taps "Start Lesson" or the grace expires.
- **Checks**:
  - Simulate arrival; confirm PIN is displayed on tutor screen; confirm app auto-navigates once student verifies PIN.

### Phase M6 — Payout Settlement & Cancellation Handling
- **Feature IDs**: `TUT-PAYOUTS`, `TUT-CANCEL-HANDLING`, `SH-BILLING-SETTLEMENT`
- **Existing Implementation**:
  - `TutorPaymentsScreen.js` renders weekly payouts accordion and banking details card.
  - `cancelInPersonSession` helper in `sessionService.js`.
- **Tasks**:
  - Verify payout calculation credits 73% of lesson tuition fee plus travel fee allocation as decided by owner.
  - Implement tutor cancellation compensation display based on owner policy decisions for student cancellations during travel or arrival.
- **Checks**:
  - Complete test session; verify tutor session record displays correct 73% split on tuition.
  - Simulate student cancellation; verify tutor wallet is credited according to decided compensation rules.
