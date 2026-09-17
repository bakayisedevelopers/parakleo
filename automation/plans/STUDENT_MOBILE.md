# Student Mobile App Supporting Plan (`mobile/`)

> **Application**: Student Mobile App  
> **Source Directory**: [`mobile/src/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/)  
> **Parent Master Plan**: [`automation/MASTER_PLAN.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/MASTER_PLAN.md)

---

## 1. Discovered App Architecture

- **Entry Point**: [`mobile/App.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/App.js)
- **Root Navigator**: [`mobile/src/navigation/RootNavigator.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/navigation/RootNavigator.js)
- **Primary In-Person Screens**:
  - `DashboardScreen`: [`mobile/src/screens/student/DashboardScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/DashboardScreen.js)
  - `SessionScreen` (In-person confirmation & map tracking): [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js)
  - `RequestStatusScreen`: [`mobile/src/screens/student/RequestStatusScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/RequestStatusScreen.js)
  - `ActiveSessionScreen`: [`mobile/src/screens/student/ActiveSessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/ActiveSessionScreen.js)
  - `SessionSummaryScreen`: [`mobile/src/screens/student/SessionSummaryScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionSummaryScreen.js)
  - `WalletScreen`: [`mobile/src/screens/student/WalletScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/WalletScreen.js)
- **Key Components**:
  - `SessionMapView`: [`mobile/src/components/student/SessionMapView.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/SessionMapView.js)
  - `AttachmentPickerModal`: [`mobile/src/components/student/AttachmentPickerModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/AttachmentPickerModal.js)
  - `DescribeRequestModal`: [`mobile/src/components/student/DescribeRequestModal.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/DescribeRequestModal.js)
  - `SessionRatingPrompt`: [`mobile/src/components/student/SessionRatingPrompt.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/SessionRatingPrompt.js)
- **Core Services**:
  - `classRequestService.js`: [`mobile/src/services/classRequestService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/classRequestService.js)
  - `liveTrackingRealtimeService.js`: [`mobile/src/services/liveTrackingRealtimeService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/liveTrackingRealtimeService.js)
  - `sessionService.js`: [`mobile/src/services/sessionService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/sessionService.js)
  - `pricingService.js`: [`mobile/src/services/pricingService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/pricingService.js)

---

## 2. Milestone Implementation Matrix

### Phase M0 — Contract & Pricing Alignment
- **Feature IDs**: `SH-STATUS-MACHINE`, `SH-PRICING-ENGINE`
- **Existing Implementation**:
  - `mobile/src/constants/lessonStatus.js` contains the canonical `LESSON_STATUS`.
  - `LOCAL_TRANSFER_FEE = 40` and rate fallback `1.8` hardcoded in `SessionScreen.js`.
- **Tasks**:
  - Eliminate hardcoded client rates (`1.8`, `LOCAL_TRANSFER_FEE = 40`). All pricing components (Base Price $B$, Rate per Minute $R$, Travel Surcharge $T$, Booking Fee $F_B$) must be fetched directly from Cloud Functions `getPricingQuote`.
  - Update `mobile/src/utils/pricing.js` to define the 1% booking fee rule bounded to R1.00–R2.00 while retaining cents.
- **Checks**:
  - Verify syntax and exports of `mobile/src/constants/lessonStatus.js` and `mobile/src/utils/pricing.js`.

### Phase M2 — In-Person Request Creation & Active State Persistence
- **Feature IDs**: `STU-REQ-CREATE`, `STU-REQ-CONFIRM`
- **Existing Implementation**:
  - Photo intake, OCR extraction, and text description modal in `DashboardScreen.js`.
  - Confirmation screen in `SessionScreen.js` with duration selector and quote display.
- **Known Gaps**:
  - Ephemeral state: If the student app is closed while the tutor is en route, reopening returns to dashboard instead of resuming `SessionScreen.js` tracking.
  - Client hardcoded constants in `SessionScreen.js`.
- **Tasks**:
  - Refactor `SessionScreen.js` and `pricingService.js` to pass route `distanceKm` to `getPricingQuote` and render the backend-computed breakdown ($B, R, T, F_B$) dynamically.
  - Add active request detection on launch in `RootNavigator.js` or `DashboardScreen.js`: if a request exists with status in `['pending', 'offered', 'accepted', 'travelling', 'arrived', 'preparing_for_lesson']`, auto-navigate to `SessionScreen.js`.
- **Checks**:
  - Test: submit request, restart app, confirm tracking screen immediately resumes.

### Phase M3 — 3-Second Live Telemetry Map Tracking
- **Feature IDs**: `STU-LIVE-TRACK`, `SH-RTDB-TELEMETRY`
- **Existing Implementation**:
  - `SessionMapView.js` renders native Google Map with markers, polyline, and ETA badge.
  - Subscribes to RTDB `liveTracking/classRequests/{requestId}`.
- **Tasks**:
  - Optimize marker coordinate animation for the target 3-second RTDB update interval to eliminate jitter.
- **Checks**:
  - Realtime subscriber test verifying coordinate updates trigger marker position animation smoothly.

### Phase M4 & M5 — Arrival Grace, PIN Input & Active Lesson HUD
- **Feature IDs**: `STU-ARR-PREP`, `STU-PIN-INPUT`, `STU-ACTIVE-LESSON`, `SH-PIN-VERIFICATION`
- **Existing Implementation**:
  - Arrival and prep status badges exist in `SessionScreen.js`.
  - `ActiveSessionScreen.js` provides live elapsed timer, topic notes, safety modal, and end lesson button.
- **Tasks**:
  - Implement short one-time PIN input sheet in `SessionScreen.js` when status is `arrived` or `preparing_for_lesson`.
  - Student enters the PIN provided by the tutor $\rightarrow$ calls `verifyStartSession` endpoint.
  - On validation success, update state to `preparing_for_lesson` with 5-minute countdown, then navigate to `ActiveSessionScreen.js` when the session transitions to `in_session` (when either party begins or grace expires).
- **Checks**:
  - Unit test: verify valid PIN triggers transition; invalid PIN increments attempt counter.

### Phase M6 — Summary, Settle & Rating
- **Feature IDs**: `STU-SETTLE-RATING`, `STU-CANCEL-FEE`
- **Existing Implementation**:
  - `SessionSummaryScreen.js` renders final price breakdown, card charged, and 5-star rating inputs.
  - `CancellationQuoteModal.js` displays dynamic cancellation fee breakdown.
- **Tasks**:
  - Update `CancellationQuoteModal.js` to render stage-based cancellation quotes from `getCancellationQuote` (Stages 1–3 confirmed free; Stages 4–7 charges subject to owner decision).
  - Display itemized breakdown in `SessionSummaryScreen.js`: tuition fee, travel fee (R40+), and platform booking fee (1%, R1–R2).
  - Ensure rating submission properly sets session as rated.
- **Checks**:
  - Verify cancellation modal shows correct breakdown before API execution.
  - Verify rating prompt dismisses permanently after submission.
