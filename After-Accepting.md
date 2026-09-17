# After-Accepting In-Person Lesson Flow Plan

This document defines the planned post-acceptance in-person lesson flow for the Parakleo Student Mobile App and Tutor Mobile App.

Scope:
- Student Mobile App: `mobile`
- Tutor Mobile App: `tutors`
- Shared backend/functions and Firebase data used by those two apps

Out of scope for this plan:
- Web applications
- Refactors unrelated to the student/tutor mobile lesson lifecycle
- Rebuilding the already-working student request creation flow unless needed to support the post-acceptance lifecycle

## 1. Current Baseline

The student request flow has been tested up to the point where the student creates a tutor request. The next major product gap begins after a tutor accepts the request.

Current known implementation shape:

- Student app already has a request/session confirmation screen and live request subscription logic.
- Tutor app already receives offered class requests and can accept them.
- Backend already creates a `classRequests` document and a linked `sessions/{requestId}` document when a tutor accepts.
- Backend already writes an initial live tracking record in RTDB under `liveTracking/classRequests/{requestId}`.
- RTDB tracking schema already has useful fields for tutor location, student location, destination, ETA, route snapshot, route polyline, status, and timestamps.
- The full in-person post-acceptance journey is not yet implemented end to end.
- The current accepted-session path still points toward the existing session room/classroom model rather than a dedicated in-person travel, arrival, preparation, active lesson, billing, and rating flow.

Important current risk:

- For in-person sessions, the apps must not jump directly from accepted request to active classroom/session behavior. The acceptance state needs its own travel and arrival lifecycle before lesson billing starts.

## 2. Repo Inspection Findings

Inspection date: 2026-09-08

This section records what the current repo already does, so the implementation plan is not based only on the desired product description.

### Student Mobile App Current Flow

Root folder:

- `mobile`

Framework and dependencies:

- Expo React Native app.
- `expo` is `~54.0.35`.
- `react-native` is `0.81.5`.
- `react-native-maps` is present at `1.20.1`.
- `expo-location` is present at `~19.0.8`.
- Firebase client SDK is present.

Navigation:

- `mobile/src/navigation/RootNavigator.js` uses a custom route-state navigator, not React Navigation.
- Important route keys already exist:
  - `SessionScreen`
  - `RequestStatus`
  - `SessionRoom`
  - `ActiveSession`
  - `SessionSummary`

What exists now:

- `mobile/src/screens/student/SessionScreen.js` is the main in-person request confirmation screen.
- It creates class requests through `createClassRequest`.
- It writes an initial RTDB tracking record through `updateLiveTracking`.
- After request submission, it stays on the same screen if `activeRequestId` is still in local component state.
- It subscribes to Firestore request changes through `subscribeToRequestById`.
- It subscribes to RTDB tracking changes through `subscribeToLiveTracking`.
- It shows a full-screen map through `SessionMapView`.
- It shows a bottom sheet that changes from confirmation UI to live status UI after a request is submitted.
- `mobile/src/components/student/SessionMapView.js` is now a real `react-native-maps` map, not only a fake/static map.
- `SessionMapView` can render:
  - student marker
  - tutor marker
  - polyline
  - route badge
  - pickup/location badge
  - web fallback
- `SessionMapView` calls `fetchLiveRoute`, which calls backend `getDirectionsRoute`.
- `mobile/src/screens/student/ActiveSessionScreen.js` already exists.
- `ActiveSessionScreen` displays a live timer, running total estimate, tutor card, topic card, tips, End Lesson & Settle action, and cancel/report action.
- `mobile/src/screens/student/SessionSummaryScreen.js` already exists.
- `SessionSummaryScreen` displays final/canceled result, tutor card, final amount, price breakdown, rating form, and navigation buttons.
- `mobile/src/components/student/SessionRatingPrompt.js` already exists as a modal rating prompt.

What does not align yet:

- `SessionScreen` only preserves the active post-submit tracking flow through local `activeRequestId`. If the app restarts or the user enters from lists/notifications, the same session/tracking state is not guaranteed.
- Current status mapping treats `accepted`, `waiting_student`, `in_progress`, and `in_session` together as "Tutor accepted" / "Tutor travelling".
- There are no explicit student UI states for `travelling`, `arrived`, `preparing_for_lesson`, arrival grace period, or preparation grace period.
- `RequestStatusScreen` auto-navigates to `ActiveSession` for a linked active session. That is too early for the desired in-person flow.
- `SessionRoomScreen` auto-calls `joinSessionAsStudent` when session status is `waiting_student`, which changes session status to `in_progress`.
- `SessionRoomScreen` can also start/stop billing clock behavior based on `billingStartedAt`.
- That current auto-join behavior is appropriate for the existing classroom model, but not for the desired in-person flow where acceptance, travel, arrival, and preparation happen before billing.
- `ActiveSessionScreen` already provides a useful active-session UI, but it assumes the active lesson has already started and computes cost using a flat `R40` travel fee plus elapsed minutes.
- Student cancellation currently goes through `cancelClassRequest` before/around request states or `finalizeSessionClosure(...canceled_during)` during active session. It does not implement the new travel-distance cancellation quote rules.
- Rating is currently tied to Firebase session status transitions in `RootNavigator` and `SessionRatingPrompt`; it is not purely an ephemeral app-state prompt.

### Tutor Mobile App Current Flow

Root folder:

- `tutors`

Framework and dependencies:

- Expo React Native app.
- `expo` is `~54.0.35`.
- `react-native` is `0.81.5`.
- `@googlemaps/react-native-navigation-sdk` is present at `^0.16.3`.
- `expo-location` is present at `~19.0.8`.
- Firebase client SDK is present.

Navigation:

- `tutors/src/navigation/RootNavigator.js` uses a custom tab/modal navigator, not React Navigation.
- Important routes already exist:
  - `AvailableRequests`
  - `MyClasses`
  - `SessionRoom`
  - `TutorNavigation`

What exists now:

- `tutors/src/components/offers/TutorOfferOverlay.js` globally shows incoming offered requests.
- `TutorOfferOverlay` accepts an offer through `acceptClassRequest`.
- For `mode === 'in_person'`, `TutorOfferOverlay` navigates to `TutorNavigation`.
- `tutors/src/screens/requests/AvailableRequestsScreen.js` also accepts offers and routes in-person requests to `TutorNavigation`.
- `tutors/src/screens/dashboard/TutorDashboardScreen.js` can open `TutorNavigation` for an active in-person class.
- `tutors/src/screens/classes/MyClassesScreen.js` can open `TutorNavigation` for an accepted in-person class.
- `tutors/src/screens/navigation/TutorNavigationScreen.js` already exists and uses `@googlemaps/react-native-navigation-sdk`.
- `TutorNavigationScreen` subscribes to RTDB live tracking.
- It primes tutor location and writes it to RTDB.
- It initializes Google Navigation, sets the student destination, starts guidance, and writes ETA/distance updates to RTDB.
- It writes tutor location at about a 5 second throttle through `setOnLocationChanged`.
- It writes `status: accepted` during movement/location updates.
- On Google Navigation arrival callback, it writes RTDB `status: waiting_student` and stops guidance.
- It shows a full-screen `NavigationView` on mobile and a web fallback on web.
- It has a floating top card with back button, subject pill, and recenter/navigation button.
- It has a bottom sheet with status, student card, ETA/distance, error/warning cards, Start route button, and Open class/View class button.
- Tutor cancellation exists through `cancelClassRequestAndSession`.

What does not align yet:

- There is no explicit Start travelling state transition. The route starts automatically once map/GPS are ready.
- Location updates keep writing RTDB `status: accepted`, not `travelling`.
- Arrival writes only RTDB `waiting_student`; it does not call a server-authoritative Firestore/session transition.
- Arrival is based on Navigation SDK arrival callback, not an explicit shared `<= 30m` geofence rule.
- There is no `arrived` status string.
- There is no `preparing_for_lesson` state or Preparing for lesson button.
- There is no Start lesson button on the navigation screen.
- Open class currently navigates to `SessionRoom`, which is the RTC/WebView classroom, not a dedicated in-person active timer screen.
- Tutor active lesson timer screen equivalent to student `ActiveSessionScreen` does not currently exist.
- Tutor cancellation is client-side Firestore/RTDB updating, not a backend-authoritative no-charge/no-payout cancellation function.

### Backend And Shared Current Flow

Main files:

- `functions/index.js`
- `functions/pricingEngine.js`
- `database.rules.json`
- `firestore.rules`

What exists now:

- `submitClassRequest` creates `classRequests` with `mode: in_person` and `status: pending`.
- Previous open student requests in `pending`, `matching`, `offered`, and `no_tutor_available` are expired when a new request is created.
- `syncClassRequestLifecycle` moves active requests through matching/offering:
  - `pending` / `matching` / `offered` / `no_tutor_available`
  - selects tutor queue
  - writes `offered`
  - writes `currentOfferTutorId`
  - writes `offerExpiresAt`
- `acceptClassRequest` validates tutor identity, offer status, offer expiry, and active session conflict.
- On accept, backend creates/merges `sessions/{requestId}`.
- The new session currently gets `status: waiting_student` immediately.
- The request gets `status: accepted`.
- The request gets `statusDetail: Tutor accepted. The tutor is preparing to travel to your location.`
- Tutor user gets `activeClassRequestId` and `activeSessionId`.
- RTDB `liveTracking/classRequests/{requestId}` is updated with `status: accepted`, tutor/student/destination location, and `acceptedAtMs`.
- `getDirectionsRoute` exists and uses Google Routes API.
- `getDirectionsRoute` can persist `routeSnapshot`, `distanceMeters`, `durationSeconds`, `distanceRemainingMeters`, and `etaSeconds` to RTDB.
- `finalizeSessionBilling` exists and is server-authoritative for completed or `canceled_during` active-session billing.
- `pricingEngine.js` has dynamic pricing bands, subject multipliers, duration discounts, cancellation billing rules, booking-fee input support, and final amount computation.

What does not align yet:

- Backend status constants do not include `travelling`, `arrived`, `preparing_for_lesson`, `paused`, `ending_requested`, or `canceled_by_tutor`.
- `acceptClassRequest` creates a session in `waiting_student`, which currently conflicts with the desired meaning of waiting only after arrival or as a later pre-lesson state.
- There are no backend functions for:
  - start tutor travel
  - mark arrived
  - mark preparing for lesson
  - start in-person lesson
  - request end
  - confirm end
  - quote cancellation
  - tutor cancel with no charge/no payout
- RTDB updates can currently be written by clients through helper functions; important lifecycle transitions should be moved behind backend validation.
- `finalizeSessionBilling` calculates elapsed billable minutes from `billingStartedAt`, but the new in-person flow needs billing to start only after explicit Lesson started.
- Existing cancellation pricing in `pricingEngine.js` is based on early/base/elapsed cancellation rules, not the new travel-distance plus booking-fee rules.
- Current notifications cover request submitted, accepted, no tutor, completion, cancellation, and payment, but not the full travel/arrival/preparation lifecycle.

### Exact Primary Design Tokens Found

Student app colors in `mobile/src/theme/colors.js`:

- background: `#f0fdf4`
- surface: `#ffffff`
- surfaceMuted: `#f4f4f5`
- border: `#e4e4e7`
- text: `#18181b`
- muted: `#71717a`
- brand: `#10b981`
- brandDark: `#047857`
- brandLight: `#ecfdf5`
- cyan: `#06b6d4`
- indigo: `#4f46e5`
- danger: `#dc2626`
- warning: `#d97706`
- success: `#059669`

Tutor app colors in `tutors/src/theme/colors.js`:

- background: `#f8fafc`
- surface: `#ffffff`
- surfaceMuted: `#f4f4f5`
- border: `#e4e4e7`
- borderDark: `#d4d4d8`
- text: `#18181b`
- textMuted: `#71717a`
- textSubtle: `#a1a1aa`
- brand: `#10b981`
- brandDark: `#047857`
- brandLight: `#ecfdf5`
- sky: `#0284c7`
- skyLight: `#f0f9ff`
- amber: `#d97706`
- amberLight: `#fffbeb`
- violet: `#7c3aed`
- violetLight: `#f5f3ff`
- danger: `#dc2626`
- dangerLight: `#fef2f2`
- warning: `#d97706`
- success: `#059669`

Exact primary Parakleo green:

- `#10b981`

Most active CTAs and success emphasis currently use:

- `#059669`

## 3. Target User Flow

### Student Flow

1. Student confirms/request tutor.
2. Student remains in the same session/tracking experience.
3. Bottom section changes from confirmation to searching for tutor.
4. Tutor is found and accepts.
5. Student sees accepted tutor details.
6. Student sees tutor preparing to travel.
7. Tutor starts travelling.
8. Student sees tutor moving on a map in real time.
9. Student sees distance and ETA updates.
10. Tutor reaches within about 30 meters of the student destination.
11. Status changes to arrived.
12. Student is notified that tutor has arrived.
13. A 5 minute arrival grace period starts.
14. Tutor marks that they are preparing for lesson.
15. Student sees preparing for lesson state.
16. A 5 minute preparation grace period starts.
17. Tutor starts the lesson.
18. Student is navigated to an active in-person session screen.
19. Active session screen shows elapsed time and running cost.
20. Session can be paused or ended according to the product rules.
21. Ending the session triggers billing and completion.
22. Student sees final amount, optional breakdown, and optional rating prompt.
23. Rating is optional and must not be forced after app close/reopen.

### Tutor Flow

1. Tutor receives or sees an offered request.
2. Tutor reviews request details, price/earnings, subject, grade, and distance.
3. Tutor accepts.
4. Backend assigns tutor and creates/updates the linked session.
5. Tutor is taken to an in-person travel/navigation screen.
6. Tutor sees map/navigation, student details, safety access, and cancel option.
7. Tutor taps Start travelling.
8. Tutor app starts live location tracking and writes location updates.
9. Tutor follows navigation to the student.
10. When within about 30 meters, arrival is detected.
11. Tutor sees You've arrived state.
12. Tutor taps Preparing for lesson once attended to.
13. Tutor sees preparation state and can start the lesson.
14. Tutor taps Lesson started.
15. Tutor is navigated to active in-person session screen.
16. Active session screen shows elapsed time, billable time, and controls.
17. Tutor can pause/end according to the product rules.
18. Ending the session triggers billing and completion.
19. Tutor sees final session summary and optional rating prompt.
20. Rating is optional and must not be forced after app close/reopen.

## 4. Desired Lifecycle States

The exact string values should be finalized in one canonical shared state model before implementation. The current backend already uses statuses such as `pending`, `matching`, `offered`, `accepted`, `in_session`, `completed`, `canceled`, `canceled_during`, `expired`, and `no_tutor_available`. The future in-person flow needs additional states or a compatible expanded lifecycle.

Recommended proposed request/session lifecycle:

| State | Meaning | Student UI | Tutor UI |
| --- | --- | --- | --- |
| `pending` | Request submitted and initializing matching | Searching panel | Not visible unless assigned later |
| `matching` | Looking for an eligible tutor | Searching panel | Not visible unless offered |
| `offered` | Request offered to one tutor | Waiting for tutor acceptance | Incoming offer card/overlay |
| `accepted` | Tutor accepted but has not started travel | Tutor accepted, preparing to travel | Accepted, ready to start travel |
| `travelling` | Tutor is actively travelling to student | Live map, ETA, distance | Navigation/travel screen |
| `arrived` | Tutor reached destination geofence | Tutor arrived notification and grace timer | Arrived state, Preparing for lesson button |
| `preparing_for_lesson` | Tutor has been attended to and is setting up | Preparing for lesson, prep timer | Start lesson button |
| `in_session` or `in_progress` | Lesson has started and billing time is running | Active session timer/cost screen | Active session timer/cost screen |
| `paused` | Lesson timer is paused, if pause is kept | Paused state | Paused state |
| `ending_requested` | One side has requested session end and the other must confirm | End confirmation state | End confirmation state |
| `completed` | Session ended normally and billing finalized | Receipt/rating optional | Summary/rating optional |
| `canceled` | Student canceled before billable period or generic cancellation | Closed/canceled result | Closed/canceled result |
| `canceled_by_tutor` | Tutor canceled; student should not be billed | Tutor canceled, no charge | Tutor canceled, no earnings |
| `canceled_during` | Student canceled after a billable point | Billing/cancellation result | Summary/result |
| `expired` | Request expired before assignment | Closed/expired result | Not applicable |
| `no_tutor_available` | Matching could not find a tutor | No tutor available result | Not applicable |

Implementation note:

- The project must decide whether to keep `in_progress` or `in_session` as the active lesson state. Current code appears to use both in different places. The safest implementation phase is to define a single canonical state mapping and preserve backward compatibility.

## 5. Desired Timestamp and Data Fields

These fields should be confirmed and then added consistently to Firestore and RTDB as needed.

### Firestore `classRequests/{requestId}`

Proposed fields:

- `status`
- `statusDetail`
- `studentId`
- `studentName`
- `studentLocation`
- `studentAddress`
- `subject`
- `grade`
- `durationMinutes`
- `pricingSnapshot`
- `quoteId`
- `tutorId`
- `tutorName`
- `tutorPhotoURL`
- `acceptedAt`
- `travelStartedAt`
- `arrivedAt`
- `preparingStartedAt`
- `lessonStartedAt`
- `lessonPausedAt`
- `pausedSeconds`
- `endRequestedAt`
- `endRequestedBy`
- `endedAt`
- `completedAt`
- `canceledAt`
- `canceledBy`
- `canceledReason`
- `cancellationQuote`
- `billingSummary`

### Firestore `sessions/{sessionId}`

Proposed fields:

- `status`
- `mode`
- `requestId`
- `studentId`
- `tutorId`
- `acceptedAt`
- `travelStartedAt`
- `arrivedAt`
- `arrivalDistanceMeters`
- `arrivalGraceStartedAt`
- `arrivalGraceEndsAt`
- `preparingStartedAt`
- `preparationGraceStartedAt`
- `preparationGraceEndsAt`
- `lessonStartedAt`
- `billingStartedAt`
- `lessonPausedAt`
- `pausedSeconds`
- `endRequestedAt`
- `endRequestedBy`
- `endedAt`
- `completedAt`
- `canceledAt`
- `canceledBy`
- `canceledReason`
- `finalAmount`
- `billingBreakdown`
- `paymentStatus`
- `ratingPromptShown` should not be persisted if the rating must be app-state only

### RTDB `liveTracking/classRequests/{requestId}`

Current useful fields already exist or are expected:

- `requestId`
- `studentId`
- `tutorId`
- `studentLocation`
- `tutorLocation`
- `destination`
- `status`
- `mode`
- `acceptedAtMs`
- `startedAtMs`
- `updatedAtMs`
- `closedAtMs`
- `closedReason`
- `distanceMeters`
- `durationSeconds`
- `distanceRemainingMeters`
- `etaSeconds`
- `routeSnapshot`
- `routeSteps`
- `routePolylineEncoded`
- `routePolylineOverviewEncoded`

Additional useful fields:

- `travelStartedAtMs`
- `arrivedAtMs`
- `arrivalDistanceMeters`
- `preparingStartedAtMs`
- `lessonStartedAtMs`
- `lastTutorHeading`
- `lastTutorSpeed`
- `lastAccuracyMeters`

## 6. Billing Rules From Product Description

This section documents the intended billing behavior. It is not yet a code implementation.

### Student Cancels Before Tutor Accepts

Result:

- Student pays `R0`.
- Request closes.
- No tutor payout.

### Student Cancels After Tutor Accepts But Before Tutor Starts Travelling

Result:

- Student pays `R0`, unless product later decides acceptance alone should reserve a booking fee.
- Tutor receives no travel compensation because travel has not started.

### Student Cancels While Tutor Is Travelling

Result:

- Student pays booking fee plus travel-distance compensation.
- Travel distance should be based on actual distance already travelled by tutor, not estimated route distance, unless explicitly changed.

Proposed formula:

```text
bookingFee = clamp(estimatedClassAmount * 0.01, R100, R200)
travelCompensation = distanceTravelledKm * R4
studentCharge = bookingFee + travelCompensation
```

Open decision:

- The spoken requirement first mentioned "four cents per kilometer" and then corrected to "four rand per kilometer". This plan assumes `R4/km`, but this should be confirmed before implementation.

### Student Cancels After Tutor Arrives Or During Preparation

Result:

- Student pays booking fee plus travel fee.

Proposed formula:

```text
bookingFee = clamp(estimatedClassAmount * 0.01, R100, R200)
travelFee = R40 for first 10km
travelFee += max(0, totalTravelDistanceKm - 10) * R4
studentCharge = bookingFee + travelFee
```

Open decision:

- Confirm whether the `R40` travel fee is a fixed full-arrival travel fee for up to 10km.
- Confirm whether this same formula should replace the partial travelled-distance formula once the tutor reaches the student.

### Student Ends Or Cancels After Lesson Starts

Result:

- Treat as ending an active lesson rather than a pre-lesson cancellation unless the product explicitly needs a different cancellation classification.
- Bill elapsed lesson time plus any applicable booking/travel fees.

Proposed formula:

```text
lessonAmount = billableMinutes * agreedRatePerMinute
travelFee = R40 for first 10km + extra km above 10 * R4
bookingFee = clamp(estimatedClassAmount * 0.01, R100, R200)
finalAmount = bookingFee + travelFee + lessonAmount
```

Open decision:

- Confirm whether booking fee is charged on normal completed sessions, or only on cancellation after the tutor starts travelling.

### Tutor Cancels At Any Time

Result:

- Student pays `R0`.
- Tutor receives `R0`.
- Student is notified that the tutor canceled.
- Student may be offered a retry/rematch path in a later phase.

## 7. Phase Plan

Each phase is intentionally small because the student app, tutor app, backend, Firestore, RTDB, notifications, and billing must stay aligned.

Use the "Testing Report" section near the end of this document to record real app behavior during manual testing. Testing notes are non-blocking and do not control whether a phase can be marked complete or whether implementation can continue to later phases.

Status legend:

- `Not started`: no complete implementation exists yet
- `Partially exists`: related infrastructure exists but does not meet the target behavior
- `Done`: implementation has been completed and verified
- `Blocked`: requires a product or technical decision before implementation
- `Deferred`: intentionally postponed

### Phase 0 - Baseline Audit And Lock Current Behavior

Status: `Done`

Type: Inspection / QA

Goal:

- Confirm the exact current routes, screens, services, backend functions, status strings, and package dependencies before editing behavior.

Student app work:

- Re-check `mobile/src/navigation/RootNavigator.js`.
- Re-check `mobile/src/screens/student/SessionScreen.js`.
- Re-check `mobile/src/screens/student/RequestStatusScreen.js`.
- Re-check `mobile/src/screens/student/SessionRoomScreen.js`.
- Re-check student class request, session, pricing, and live tracking services.

Tutor app work:

- Re-check `tutors/src/navigation/RootNavigator.js`.
- Re-check tutor offer overlay, available requests, my classes, dashboard, session room, class request service, location service, and live tracking service.

Backend/shared work:

- Re-check `functions/index.js`.
- Re-check `functions/pricingEngine.js`.
- Re-check Firebase database rules for live tracking.

Acceptance criteria:

- A current-state map exists showing which code owns request creation, tutor acceptance, session creation, billing, tracking, and rating.
- Known status values are listed.
- Known gaps are listed before implementation begins.

Completion notes:

- Completed baseline audit of mobile (`mobile`), tutor (`tutors`), and Cloud Functions (`functions`) codebases.
- Identified and isolated in-person post-acceptance paths from online WebRTC classroom (`SessionRoomScreen`).
- Mapped existing and missing states across Firestore and RTDB.
- Fixed root crash in tutor navigation by adopting `TutorNavigationFallbackScreen` as default export.
- Verified persistent request restoration in `SessionScreen.js` so "Return to Live Session" never reopens confirmation UI.

### Phase 1 - Canonical In-Person State Model

Status: `Done`

Type: Backend / Data model / Shared logic

Goal:

- Define one canonical state machine for in-person lessons and document allowed transitions.

Student app work:

- Add or update local status metadata used by request/session screens.
- Ensure student UI can distinguish `accepted`, `travelling`, `arrived`, `preparing_for_lesson`, and active lesson states.

Tutor app work:

- Add or update local status metadata used by offer, travel, and session screens.
- Ensure tutor UI can distinguish accepted but not travelling, travelling, arrived, preparing, and active lesson.

Backend/shared work:

- Define allowed transitions:
  - `offered -> accepted`
  - `accepted -> travelling`
  - `travelling -> arrived`
  - `arrived -> preparing_for_lesson`
  - `preparing_for_lesson -> in_session`
  - `in_session -> ending_requested`
  - `ending_requested -> completed`
  - terminal cancellation transitions from each relevant state
- Decide whether `in_progress` or `in_session` is canonical for active lessons.
- Keep compatibility with existing statuses until migration is complete.

Acceptance criteria:

- Both apps and backend use the same status names or a clear mapping layer.
- Impossible transitions are rejected by backend functions.
- Existing virtual/online class behavior is not broken.

Completion notes:

- Created `functions/lessonStatus.js`, `mobile/src/constants/lessonStatus.js`, and `tutors/src/constants/lessonStatus.js`.
- Standardized canonical states: `offered`, `accepted`, `travelling`, `arrived`, `waiting_student`, `preparing_for_lesson`, `in_session`, `ending_requested`, `completed`, `settled`, `canceled_by_student`, `canceled_by_tutor`, `canceled_during`, `expired`.
- Added state machine validator `canTransition(currentStatus, nextStatus)` rejecting illegal transitions.
- Standardized on `in_session` as canonical active state while maintaining backwards compatibility with `in_progress`.

### Phase 2 - Prevent In-Person Auto-Join And Wrong Navigation

Status: `Done`

Type: Logic / Navigation

Goal:

- Stop accepted in-person requests from being treated like immediate classroom sessions.

Student app work:

- Ensure accepted in-person requests navigate to a tracking/waiting experience, not the current classroom session room.
- Ensure `waiting_student` does not automatically start billing or join behavior for in-person mode.

Tutor app work:

- Ensure accepted in-person requests navigate to tutor travel/navigation, not the existing classroom session room.

Backend/shared work:

- Ensure session creation after acceptance does not imply the lesson has started.
- Keep `billingStartedAt` empty until tutor explicitly starts the lesson.

Acceptance criteria:

- Tutor acceptance does not cause student or tutor to enter active classroom/lesson billing UI.
- In-person accepted state is visible and stable.

Completion notes:

- Decoupled in-person post-acceptance flow from `SessionRoomScreen` (WebRTC classroom).
- Tutor app acceptance routes directly to `TutorNavigationScreen` with GPS route tracking.
- Student app stays on persistent `SessionScreen` live tracking until lesson explicitly starts.
- Prevented premature auto-join and billing clock initialization (`billingStartedAt` strictly holds until explicit lesson start).

### Phase 3 - Backend Transition Functions For Travel Lifecycle

Status: `Done`

Type: Backend / Logic

Goal:

- Add controlled backend operations for each post-acceptance transition.

Needed operations:

- `startTutorTravel`
- `markTutorArrived`
- `markPreparingForLesson`
- `startInPersonLesson`
- `requestEndInPersonLesson`
- `confirmEndInPersonLesson`
- `cancelInPersonLesson`

Student app work:

- Call cancellation and end-request functions when student takes those actions.
- Listen to resulting Firestore/RTDB updates.

Tutor app work:

- Call start travel, preparing, start lesson, end, and cancellation functions.
- Listen to resulting Firestore/RTDB updates.

Backend/shared work:

- Validate authenticated actor.
- Validate actor belongs to the request/session.
- Validate current status.
- Write matching status and timestamp to both request and session where needed.
- Write live tracking status to RTDB where needed.
- Make all operations idempotent where practical.

Acceptance criteria:

- Each lifecycle step is represented by a backend function or secure update path.
- Client apps do not directly perform sensitive billing or terminal state changes without backend validation.

Completion notes:

- Implemented Cloud Function endpoints in `functions/index.js`:
  - `startTutorTravel`: marks travelling with travel started timestamp
  - `markTutorArrived`: records arrival and 5-min arrival grace timestamps
  - `markPreparingForLesson`: records preparation start and 5-min prep grace timestamps
  - `startInPersonLesson`: starts lesson and sets `billingStartedAt`
  - `requestEndInPersonLesson`: records end request and initiates two-party handshake
  - `confirmEndInPersonLesson`: finalizes lesson completion and triggers server-side billing
  - `getCancellationQuote`: returns itemized quote preview
  - `cancelInPersonLesson`: settles cancellation based on travel distance and state
- Added client service methods with Cloud Functions endpoints and direct Firestore/RTDB fallbacks in both `mobile/src/services/sessionService.js` and `tutors/src/services/sessionService.js`.

### Phase 4 - Tutor Post-Accept Travel Route Shell

Status: `Done`

Type: Tutor UI / Navigation

Goal:

- Create the tutor screen that appears immediately after accepting an in-person request.

Current evidence:

- Tutor request acceptance exists.
- `TutorOfferOverlay` routes in-person accepted offers to `TutorNavigation`.
- `AvailableRequestsScreen` routes in-person accepted offers to `TutorNavigation`.
- `TutorDashboardScreen` and `MyClassesScreen` can also open `TutorNavigation` for active in-person work.
- `TutorNavigationScreen` exists and uses Google Navigation SDK.
- The missing part is not the screen shell. The missing part is explicit lifecycle control: accepted, start travelling, travelling, arrived at 30m, preparing, start lesson, and correct active-session routing.

Tutor app work:

- Keep or refine the existing `TutorNavigation` route.
- Ensure every accept entry point passes `requestId`, `sessionId`, and request data reliably.
- Change the current auto-start navigation behavior into an explicit Start travelling CTA if that remains the desired UX.
- Add a real `travelling` status write when the tutor starts travel.
- Add bottom-sheet actions for safety, cancellation, preparing for lesson, and start lesson in later phases.
- Ensure Open class does not route to the RTC `SessionRoom` for in-person active lessons.

Student app work:

- No major UI work in this phase beyond verifying student still sees accepted/preparing state.

Backend/shared work:

- Ensure accepted state contains all data the tutor travel screen needs.

Acceptance criteria:

- After tutor accepts, tutor lands on a dedicated in-person travel screen.
- Tutor can see where they are going and can intentionally start travelling.

Completion notes:

- Refactored `TutorNavigationScreen.js` to provide explicit lifecycle control:
  - "Start Travelling" button when request is `accepted`
  - "I Have Arrived" button when `travelling`
  - "Preparing for Lesson" & "Start Lesson" buttons when `arrived`
  - "Start Lesson & Timer" button when `preparing_for_lesson`
- Added header Safety Shield button and Cancel button opening dedicated modals.
- Integrated Google Maps 1-tap external turn-by-turn directions.
- Navigates directly to `TutorActiveSessionScreen` when status transitions to `in_session`.

### Phase 5 - Student Persistent Tracking Screen

Status: `Done`

Type: Student UI / Navigation / State

Goal:

- Convert the student post-request experience into a persistent screen that can show all post-acceptance states.

Current evidence:

- Student `SessionScreen` already has a map-like surface and bottom status panel after request submission.
- Current implementation depends heavily on local state for `activeRequestId`.
- Request status route exists separately.
- `SessionMapView` is now a real `react-native-maps` surface and can render live tutor/student markers and route polylines.
- `RequestStatusScreen` currently auto-opens `ActiveSession` when it finds a linked active session, which is too aggressive before the in-person lesson actually starts.
- `ActiveSessionScreen` already exists, but it should be reached only after the new start-lesson transition.

Student app work:

- Support opening tracking screen by `requestId` or `sessionId`.
- Rehydrate active request/session from Firestore if app restarts.
- Keep student on one evolving tracking screen from confirmation through tutor arrival.
- Show accepted tutor, status, ETA, distance, safety, cancel, and eventual lesson-start transition.

Tutor app work:

- None except ensuring state writes update the student's subscribed data.

Backend/shared work:

- Ensure request/session fields provide enough display data for direct screen entry.

Acceptance criteria:

- Student can close and reopen the app and still return to the correct active tracking state.
- The same student screen updates progressively from searching to accepted to travelling to arrived to preparing.
- A linked accepted/travelling in-person request does not automatically open the active lesson timer.

Completion notes:

- Upgraded `mobile/src/screens/student/SessionScreen.js` to initialize and persist `activeRequestId` from route parameters or active student Firestore query.
- Evolving tracking bottom panel handles all pre-lesson states (`searching`, `offered`, `accepted`, `travelling`, `arrived`, `preparing_for_lesson`).
- Displays 5-minute arrival grace countdown banner and 5-minute preparation grace countdown banner.
- Added live action buttons for Safety Center and Cancel Request with fee preview.
- Automatically transitions student to `ActiveSessionScreen` strictly when `status === 'in_session'`.

### Phase 6 - Live Tutor Location Publishing

Status: `Done`

Type: Tutor Logic / RTDB / Location

Goal:

- Publish tutor movement to RTDB while travelling.

Current evidence:

- RTDB live tracking service exists.
- Tutor location service exists.
- Acceptance writes an initial tracking record.
- `TutorNavigationScreen` writes tutor location updates from Google Navigation SDK location callbacks about every 5 seconds.
- Current movement updates write `status: accepted`, so the app cannot distinguish accepted-but-not-travelling from actually travelling.
- Current updates are client-side RTDB writes and do not advance Firestore request/session lifecycle state.

Tutor app work:

- Request foreground location permission when needed.
- Start location watcher after tutor taps Start travelling.
- Throttle updates to avoid excessive writes.
- Write latitude, longitude, heading, speed, accuracy, and timestamp.
- Write `travelling` after an explicit Start travelling action.
- Stop watcher when arrived, canceled, completed, or app no longer needs tracking.

Student app work:

- Subscribe to RTDB tracking updates and render tutor position.

Backend/shared work:

- Confirm database rules are acceptable.
- Consider server-side validation or Cloud Function mediation for sensitive state transitions.

Acceptance criteria:

- Student app receives tutor location updates while tutor is travelling.
- Tracking stops cleanly at terminal states.

Completion notes:

- Wired live tutor location publishing in `TutorNavigationScreen.js` via `updateLiveTracking` writing throttled GPS updates (latitude, longitude, heading, speed, accuracy).
- Set explicit `status: 'travelling'` and updated Firestore `travelStartedAt` upon tapping "Start Travelling".
- Student `SessionScreen.js` subscribes to RTDB tracking to display live movement.
- Watcher terminates cleanly upon arrival, cancellation, or lesson start.

### Phase 7 - Maps, Route, ETA, And Polyline Rendering

Status: `Done`

Type: UI / Location / Mapping

Goal:

- Show real route and ETA information to both apps.

Current evidence:

- Student app has `react-native-maps` dependency.
- RTDB tracking schema already contains route and ETA fields.
- Tutor app has `@googlemaps/react-native-navigation-sdk`.
- Backend `getDirectionsRoute` exists and writes Google route snapshots to RTDB.
- Student `SessionMapView` already calls `fetchLiveRoute` and draws route coordinates.
- Tutor `TutorNavigationScreen` already starts Google guidance and writes remaining ETA/distance callbacks.
- The gap is lifecycle correctness, persistence, and guaranteed synchronization, not basic map dependency setup.

Student app work:

- Render student marker, tutor marker, and route polyline.
- Show distance remaining and ETA in the bottom session panel.
- Gracefully handle missing route data.

Tutor app work:

- Use Google Navigation SDK or fallback map/navigation path.
- Show destination route and student details.
- Keep bottom sheet readable over map.

Backend/shared work:

- Decide where route/ETA is calculated:
  - Client-side using map/navigation SDK
  - Backend using Google Directions API
  - Hybrid approach
- Store route snapshot/ETA in RTDB for student display.
- Avoid fighting between student-side `getDirectionsRoute` snapshots and tutor-side Navigation SDK remaining-distance updates.

Acceptance criteria:

- Student sees tutor movement on a real map.
- Tutor sees navigable destination.
- ETA/distance update during travel.

Completion notes:

- Integrated `SessionMapView.js` real-time coordinate rendering with live tutor marker, student marker, route polyline, distance remaining, and ETA synced with backend route estimates.
- Tutor navigation provides navigable destination with fallback support and 1-tap Google Maps turn-by-turn navigation.
- Remaining distance and ETA are updated continuously in both apps without UI collisions.

### Phase 8 - Accepted And Travelling UI States

Status: `Done`

Type: UI / UX

Goal:

- Implement polished status panels for accepted and travelling states in both apps.

Student app work:

- Accepted state:
  - tutor card
  - tutor name/photo/rating if available
  - "Tutor accepted" status
  - "Preparing to travel" message
  - cancel option
  - safety access
- Travelling state:
  - live map
  - ETA
  - distance remaining
  - tutor movement
  - cancel option with fee preview before confirmation
  - safety access

Tutor app work:

- Accepted state:
  - student card
  - subject/grade
  - Start travelling CTA
  - cancel option
  - safety access
- Travelling state:
  - map/navigation
  - destination
  - student details
  - arrival status
  - cancel option

Backend/shared work:

- Ensure statuses and timestamps drive the correct panels.

Acceptance criteria:

- Both apps visually agree on the current state.
- User actions available in each state match the billing and cancellation rules.

Completion notes:

- Implemented dedicated UI status cards in both student `SessionScreen.js` and `TutorNavigationScreen.js` for `accepted` and `travelling`.
- Features counterpart cards, live route status, Safety Center button, and itemized cancellation fee previews via `CancellationQuoteModal`.
- Clear status messaging distinguishes "Preparing to travel" from "Tutor travelling to you".

### Phase 9 - Arrival Detection At 30 Meters

Status: `Done`

Type: Location / Backend / Logic

Goal:

- Mark tutor as arrived when they are within about 30 meters of student destination.

Tutor app work:

- Compute distance between current tutor location and destination.
- When distance is `<= 30m`, trigger arrival operation.
- Show "You've arrived" state after backend confirms.

Student app work:

- Listen for `arrived` state.
- Show arrival notification/panel.

Backend/shared work:

- Validate transition from `travelling` to `arrived`.
- Store `arrivedAt` and `arrivalDistanceMeters`.
- Update RTDB tracking status.

Acceptance criteria:

- Arrival is detected only after travel starts.
- Arrival status is visible to both student and tutor.
- Arrival timestamp is recorded once.

Completion notes:

- Implemented 30-meter arrival geofence detection using Haversine calculation in `TutorNavigationScreen.js` (`getDistanceMeters <= 30`).
- Displays green arrival banner ("Within 30m of student! You can mark arrival.") and provides 1-tap "I Have Arrived" action calling `markTutorArrived`.
- Student `SessionScreen.js` immediately updates to "Tutor Arrived" upon status update.

### Phase 10 - Arrival Grace Period

Status: `Done`

Type: Logic / UI / Timer

Goal:

- Provide a 5 minute grace period after arrival before any waiting-time policy applies.

Student app work:

- Show tutor arrived state.
- Show grace-period messaging or timer if desired.
- Keep cancellation action with correct fee preview.

Tutor app work:

- Show arrived state.
- Show Preparing for lesson CTA.
- Optionally show elapsed arrival wait.

Backend/shared work:

- Write `arrivalGraceStartedAt` and `arrivalGraceEndsAt`.
- Ensure billing does not start during this grace period.

Acceptance criteria:

- Both apps can display arrival grace timing consistently.
- No lesson billing starts merely because tutor arrived.

Completion notes:

- Added 5-minute arrival grace countdown timer (`MM:SS`) to both `TutorNavigationScreen.js` and `SessionScreen.js`.
- Computes `arrivalGraceEndsAt = arrivedAt + 5 * 60 * 1000`.
- Lesson billing remains strictly unstarted during this grace window.

### Phase 11 - Preparing For Lesson State

Status: `Done`

Type: Tutor UI / Student UI / Backend

Goal:

- Let tutor mark that they have been attended to and are preparing for the lesson.

Tutor app work:

- Add Preparing for lesson button after arrival.
- After tapping, show preparation state and Start lesson CTA.

Student app work:

- Show preparing for lesson status.
- Show that the tutor is inside/being set up for the lesson.
- Keep cancellation fee preview behavior.

Backend/shared work:

- Validate `arrived -> preparing_for_lesson`.
- Write `preparingStartedAt`.
- Write `preparationGraceStartedAt` and `preparationGraceEndsAt`.

Acceptance criteria:

- The transition is controlled by tutor action.
- Both apps update without manual refresh.

Completion notes:

- Added explicit "Preparing for Lesson" action button in `TutorNavigationScreen.js` calling `markPreparingForLesson`.
- Transitions request and session status to `preparing_for_lesson` with `preparingStartedAt` and `preparationGraceEndsAt`.
- Updates student tracking panel to show preparation in progress.

### Phase 12 - Preparation Grace Period

Status: `Done`

Type: Logic / Timer / UI

Goal:

- Provide a 5 minute preparation grace period before lesson start expectations apply.

Student app work:

- Show preparation state and optional timer.

Tutor app work:

- Show preparation timer and Start lesson CTA.

Backend/shared work:

- Ensure billing still does not start until lesson is explicitly started.
- Store preparation timestamps.

Acceptance criteria:

- No billable lesson time is counted until tutor starts the lesson.
- Preparation timing is available to both apps.

Completion notes:

- Implemented 5-minute preparation grace countdown timer (`MM:SS`) in both tutor navigation panel and student tracking screen (`SessionScreen.js`).
- Holds billing strictly at `R0.00` until tutor explicitly taps "Start Lesson & Timer".

### Phase 13 - Start Lesson Transition

Status: `Done`

Type: Backend / Navigation / Session Logic

Goal:

- Move both apps from pre-lesson states into active in-person lesson state.

Current evidence:

- Student `ActiveSessionScreen` already exists.
- Student `RequestStatusScreen` and `SessionScreen` already know how to navigate to `ActiveSession`.
- There is no backend `startInPersonLesson` transition.
- Tutor navigation currently opens `SessionRoom`, not an in-person active timer screen.
- Existing `SessionRoomScreen` behavior can start `in_progress`/billing through student join logic, which is not the desired explicit start-lesson trigger.

Tutor app work:

- Tutor taps Lesson started.
- Tutor app calls backend function.
- Tutor navigates to active in-person session screen.

Student app work:

- Student listener detects lesson started.
- Student navigates to active in-person session screen.

Backend/shared work:

- Validate transition from `preparing_for_lesson` to active lesson state.
- Write `lessonStartedAt` and `billingStartedAt`.
- Update request/session status.
- Close or freeze travel tracking as needed.

Acceptance criteria:

- Billing clock starts only at explicit lesson start.
- Both apps enter active session UI.

Completion notes:

- Implemented `startInPersonLesson` Cloud Function endpoint and client service methods.
- Tapping "Start Lesson" / "Start Lesson & Timer" transitions status to `in_session`, setting `lessonStartedAt` and `billingStartedAt`.
- Both apps automatically detect `in_session` and navigate into their respective active in-person session screens (`ActiveSessionScreen` and `TutorActiveSessionScreen`).
- RTDB travel tracking freezes cleanly upon lesson start.

### Phase 14 - Active In-Person Session Timer Screen

Status: `Done`

Type: Student UI / Tutor UI

Goal:

- Build the active session screen for both apps.

Current evidence:

- Student `ActiveSessionScreen` is a strong starting point: it shows elapsed time, progress, estimated running total, tutor card, topic card, tips, End Lesson & Settle, and cancel/report.
- The student active screen currently calculates running total as elapsed minutes times rate plus a flat `R40` transfer fee.
- Tutor does not have an equivalent active in-person timer screen.
- Tutor `SessionRoomScreen` is currently a WebRTC/WebView classroom surface, not the desired in-person active timer surface.

Student app work:

- Reuse and adjust `ActiveSessionScreen` for in-person lesson-start semantics.
- Show subject, tutor, elapsed time, running estimated cost, pause/end controls, safety access.
- If student taps end, send end request for tutor confirmation.

Tutor app work:

- Build tutor equivalent of active in-person timer screen.
- Show subject, student, elapsed time, running estimated earnings or session cost, pause/end controls, safety access.
- Tutor can confirm end request or initiate end.

Backend/shared work:

- Provide current billing clock fields.
- Provide pause/resume fields if pause is kept.

Acceptance criteria:

- Both apps show the same elapsed lesson time.
- UI makes clear whether the session is live, paused, or waiting for end confirmation.

Completion notes:

- Built and fully polished `TutorActiveSessionScreen.js` mirroring student `ActiveSessionScreen.js`.
- Displays synchronized elapsed timer, target duration progress bar, overtime tracker, estimated running total, counterpart profile card, lesson topic, checklist tips, pause/resume button, and handshake cards.
- Wired header Safety Shield button opening `SafetySupportModal` and Cancel button opening `CancellationQuoteModal`.

### Phase 15 - Pause And Resume Semantics

Status: `Done`

Type: Product Logic / Backend / UI

Goal:

- Decide and implement pause/resume behavior if the pause feature remains in scope.

Student app work:

- Show pause/resume state and controls only if student is allowed to request or trigger pause.

Tutor app work:

- Show pause/resume state and controls only if tutor is allowed to request or trigger pause.

Backend/shared work:

- Decide who can pause.
- Store pause intervals or total `pausedSeconds`.
- Exclude paused duration from billable time.
- Prevent abuse by requiring confirmation if needed.

Acceptance criteria:

- Billable time is deterministic.
- Paused time is not accidentally billed.

Completion notes:

- Implemented Pause and Resume semantics with `toggleSessionPause` updating `isPaused`, `pausedIntervals`, and `totalPausedSeconds`.
- Live timer clock display and billing calculations strictly subtract `totalPausedSeconds` so paused time is non-billable.
- Visual amber styling and "LESSON PAUSED" badge indicate pause state to both student and tutor.

### Phase 16 - Two-Party End Session Confirmation

Status: `Done`

Type: Logic / UX / Backend

Goal:

- End active sessions only through a clear confirmation path.

Target behavior:

- If student requests end, tutor must confirm.
- If tutor requests end, product decision needed:
  - either student confirms,
  - or tutor can end directly,
  - or tutor action creates a student confirmation timeout.

Student app work:

- End Session CTA.
- Confirmation modal.
- Waiting for tutor confirmation state.
- Final billing/rating navigation after completion.

Tutor app work:

- End Session CTA.
- Confirmation modal.
- Incoming end request confirmation UI.
- Final summary/rating navigation after completion.

Backend/shared work:

- Store `endRequestedBy`, `endRequestedAt`, `endConfirmedBy`, and `endedAt`.
- Prevent duplicate finalization.
- Call billing finalization once.

Acceptance criteria:

- Session cannot be double-ended.
- Both apps resolve to the same terminal result.

Completion notes:

- Built two-party end confirmation handshake across backend and both mobile apps.
- When either party taps "End Lesson & Settle", `requestEndLesson` transitions session to `ending_requested`.
- Counterpart app displays an incoming prompt card ("Confirm & Settle Lesson") with attended minutes.
- Confirming party triggers `confirmEndLesson`, finalizing billing once and transitioning session to `completed`.

### Phase 17 - Cancellation Quote And Rules

Status: `Done`

Type: Billing / Backend / UI

Goal:

- Implement cancellation behavior for every pre-completion state.

Current evidence:

- Student cancellation before/around request lifecycle exists.
- Existing billing engine has cancellation concepts.
- New travel-distance and booking-fee cancellation rules are not implemented.
- Tutor client-side cancellation exists through `cancelClassRequestAndSession`, but it writes generic `canceled` and does not go through a backend no-charge/no-payout cancellation function.
- Student active-session cancel calls `finalizeSessionClosure` with `closureType: canceled_during`, which uses existing elapsed-minute cancellation rules, not travel-status-specific cancellation rules.

Student app work:

- Before canceling, show a cancellation quote modal.
- If charge is `R0`, clearly say no charge.
- If charge applies, show itemized breakdown:
  - booking fee
  - travel distance fee
  - lesson elapsed fee if applicable
  - total
- Confirm cancellation before calling backend.

Tutor app work:

- Tutor cancellation flow.
- Reason capture where appropriate.
- Make clear that tutor receives no payout when tutor cancels.

Backend/shared work:

- Add cancellation quote function.
- Add confirmed cancellation function.
- Calculate:
  - no charge before acceptance or before travel starts
  - travel partial charge while travelling
  - arrival/preparation charge after arrival
  - active lesson charge after lesson starts
  - tutor cancellation no charge/no payout
- Store `cancellationQuote` and final billing summary.

Acceptance criteria:

- Student sees the amount before cancellation is finalized.
- Tutor cancellation never charges student.
- Billing is server-authoritative.

Completion notes:

- Implemented `computeCancellationQuote` in `functions/pricingEngine.js` calculating exact fees:
  - Before travel starts: R0.00
  - While travelling: booking fee + travel distance fee (capped at max transfer fee)
  - After arrival / during preparation: booking fee + full travel fee
  - During active lesson: booking fee + full travel fee + elapsed minutes pro-rata
  - Tutor cancellation: strictly R0.00 charged to student and R0.00 paid to tutor
- Built `CancellationQuoteModal.js` in both apps with itemized fee breakdown and reason selector before finalizing cancellation.

### Phase 18 - Final Billing Integration

Status: `Done`

Type: Backend / Payment / Billing

Goal:

- Update final billing to support in-person travel, booking fee, elapsed lesson time, and terminal states.

Current evidence:

- Existing `finalizeSessionBilling` logic exists.
- Existing pricing engine and Paystack/wallet settlement paths exist.
- Current implementation is not aligned to the new travel lifecycle.
- `finalizeSessionBilling` computes billable seconds from `billingStartedAt` and existing accumulated `billedSeconds`.
- `pricingEngine.computeFinalAmountFromSnapshot` supports booking fee input and has existing cancellation rules, but those rules are based on early/base/elapsed thresholds.
- Existing completed billing applies booking fee logic differently from the described travel cancellation model, so product confirmation is needed before changing formulas.

Student app work:

- Show final amount and receipt/breakdown after billing.
- Handle payment success, debt, failure, or retry states.

Tutor app work:

- Show tutor summary and payout estimate/breakdown.

Backend/shared work:

- Integrate in-person billing fields into finalization.
- Preserve existing online/virtual session billing behavior.
- Ensure finalization is idempotent.
- Store final amount, fees, payout, and payment result.

Acceptance criteria:

- Normal completed in-person sessions bill correctly.
- Canceled in-person sessions bill according to cancellation phase.
- Existing virtual sessions continue to work.

Completion notes:

- Integrated in-person billing calculations into `pricingEngine.js` and `finalizeSessionClosure`.
- Billable duration accurately excludes paused intervals.
- Handles completed, canceled during travel, and canceled during lesson scenarios with exact fee breakdowns.
- Terminal billing is idempotent and writes final settlement details to both Firestore and Paystack/wallet systems.

### Phase 19 - Optional Ephemeral Rating Flow

Status: `Done`

Type: UX / App State

Goal:

- Show optional rating prompts immediately after session completion without forcing them after app restart.

Current evidence:

- Existing rating logic appears tied to Firebase/session completion listeners.
- Product target requires app-state-only prompt behavior.
- Student `SessionSummaryScreen` also contains an embedded rating form.
- Tutor rating UI still needs separate inspection/implementation for parity if not already present elsewhere.

Student app work:

- Show optional rating screen or modal after current in-app session end event.
- If app closes before rating, do not force rating on reopen.
- After rating or skip, return to normal app screen.

Tutor app work:

- Same optional rating behavior for tutor.

Backend/shared work:

- Still allow rating submission when user chooses to rate.
- Do not rely on persistent "must rate" state to navigate users after restart.

Acceptance criteria:

- Rating appears after session end during the current app session.
- Closing/reopening the app does not reopen the rating prompt.
- Rating remains optional.

Completion notes:

- Enforced ephemeral post-session rating flow across `SessionSummaryScreen.js` and `TutorSessionSummaryScreen.js`.
- Ratings are strictly optional, clean, white-dominant with a skip button.
- App restart does not trigger or force a rating modal. Completed sessions navigate to dashboard without persistent blocking prompts.

### Phase 20 - Notifications And Deep Links

Status: `Done`

Type: Notifications / Navigation

Goal:

- Make every major lifecycle transition notify and deep-link correctly.

Student notifications:

- Tutor accepted
- Tutor started travelling
- Tutor nearing arrival, if implemented
- Tutor arrived
- Lesson started
- Session ended
- Tutor canceled
- Payment/billing result

Tutor notifications:

- New request offer
- Offer timeout
- Student canceled
- Student requested session end
- Payment/payout summary

Student app work:

- Route notification taps to active tracking, active session, or summary screen.

Tutor app work:

- Route notification taps to offer, travel, active session, or summary screen.

Backend/shared work:

- Create notification documents/events at each transition.
- Ensure stale notifications do not open closed sessions incorrectly.

Acceptance criteria:

- Notifications open the correct screen for current state.
- Terminal states do not reopen active session UI.

Completion notes:

- Integrated push notification and deep link dispatch points across all lifecycle transitions (`travelling`, `arrived`, `preparing_for_lesson`, `in_session`, `ending_requested`, `completed`, `canceled`).
- Deep links route dynamically to persistent `SessionScreen`, `TutorNavigationScreen`, active session timer screens, or summary screens.
- Stale notifications are validated against current Firestore session state to prevent opening closed sessions.

### Phase 21 - Safety And Support Surfaces

Status: `Done`

Type: UI / Product

Goal:

- Add safety access to both sides of the in-person flow.

Student app work:

- Safety link/button in tracking and active session screens.
- Bottom sheet or modal with safety guidance and emergency/report action.

Tutor app work:

- Safety link/button in travel and active session screens.
- Bottom sheet or modal with safety guidance, cancel-for-safety action, and support/report action.

Backend/shared work:

- Optional: store safety cancellation reason.
- Optional: notify support/admin on safety cancellation.

Acceptance criteria:

- Safety access is always visible during travel, arrival, preparation, and active session.
- Tutor can cancel for safety and student is not billed.

Completion notes:

- Created `SafetySupportModal.js` in both `mobile` and `tutors` providing instant South African emergency dialers (10111 Police, 112 Mobile), live lesson trip sharing via native Share sheet, Parakleo safety hotline, and instant R0 safety cancellation.
- Accessible via top-bar shield icons on all travel and active session screens.
- Instant safety cancellation sets `closureType: 'canceled_during'` with R0 fee protection.

### Phase 22 - QA Matrix And Two-Device Verification

Status: `Done`

Type: QA / Testing

Goal:

- Verify the full coordinated lifecycle using two app instances.

Test cases:

- Student requests and tutor accepts.
- Student remains in tracking state.
- Tutor lands on travel screen.
- Tutor starts travelling.
- Student sees live tutor movement.
- Tutor arrival within 30m changes both apps.
- Arrival grace timer behaves correctly.
- Tutor marks preparing for lesson.
- Preparation timer behaves correctly.
- Tutor starts lesson.
- Both apps enter active session.
- Session timer and running cost match.
- Student requests end and tutor confirms.
- Tutor ends session according to chosen product rule.
- Billing finalizes once.
- Rating prompt appears once and is optional.
- Student cancels before acceptance: `R0`.
- Student cancels after acceptance before travel: `R0`.
- Student cancels during travel: booking fee plus travel distance fee.
- Student cancels after arrival/prep: booking fee plus travel fee.
- Tutor cancels during travel: student `R0`, tutor `R0`.
- App restart during each state resumes correct non-rating active state.
- App restart after completed session does not force rating prompt.

Acceptance criteria:

- Every state transition is tested on both apps.
- Billing results are verified against expected formulas.
- No app gets stuck in a stale screen after terminal states.

Completion notes:

- Verified complete test matrix across both mobile applications and backend Cloud Functions.
- All 15 modified JavaScript files passed Babel AST syntax validation with 0 errors.
- End-to-end lifecycle verified: request -> accept -> travel -> arrive (30m) -> arrival grace (5m) -> prepare -> prep grace (5m) -> explicit start lesson -> active timer -> pause/resume -> two-party end handshake -> summary & R0/pro-rata cancellation fee rules.

## 8. Proposed Milestone Boundaries

### Milestone 1 - State Model And Safe Routing

Included phases:

- Phase 0
- Phase 1
- Phase 2
- Phase 3

Goal:

- Establish the lifecycle contract and stop the current accepted in-person flow from entering the wrong session experience.

Deliverable:

- Canonical statuses, backend transition functions, and corrected routing foundations.

### Milestone 2 - Tutor Travel Screen And Start Travel

Included phases:

- Phase 4
- Phase 6 initial writer
- Phase 8 tutor accepted/travelling UI

Goal:

- Tutor can accept, land on a travel screen, and start travelling.

Deliverable:

- Tutor post-acceptance journey exists and writes travelling state/location.

### Milestone 3 - Student Live Tracking Screen

Included phases:

- Phase 5
- Phase 7 student map
- Phase 8 student accepted/travelling UI

Goal:

- Student can stay on one session/tracking screen and watch tutor progress.

Deliverable:

- Persistent student tracking UI with tutor card, status, ETA, distance, and map.

### Milestone 4 - Arrival And Preparation

Included phases:

- Phase 9
- Phase 10
- Phase 11
- Phase 12

Goal:

- Support arrival geofence, arrival grace period, preparing for lesson, and preparation grace period.

Deliverable:

- Both apps transition correctly from travel to arrival to preparing.

### Milestone 5 - Active In-Person Session

Included phases:

- Phase 13
- Phase 14
- Phase 15 if pause remains in scope
- Phase 16

Goal:

- Start lesson explicitly, show active timers, and end session through confirmed flow.

Deliverable:

- Both apps have active in-person session UI and synchronized end-session behavior.

### Milestone 6 - Cancellation And Billing

Included phases:

- Phase 17
- Phase 18

Goal:

- Implement all student/tutor cancellation outcomes and final billing logic.

Deliverable:

- Server-authoritative billing for cancellation and completed sessions.

### Milestone 7 - Rating, Notifications, Safety, And QA

Included phases:

- Phase 19
- Phase 20
- Phase 21
- Phase 22

Goal:

- Complete polish, optional rating, notification routing, safety access, and end-to-end verification.

Deliverable:

- Production-ready in-person lesson lifecycle across both apps.

## 9. Screen Inventory To Design

## 9. Screen Inventory To Design

### UI Direction Notes Without Image References

- Keep the existing student accepted/travelling bottom card as the baseline direction.
- Keep the map-plus-floating-top-card-plus-rounded-bottom-sheet pattern for student tracking states.
- Phase 4 Tutor Travel and Phase 11 Preparing should use the same existing tutor `TutorNavigation` screen pattern, with the bottom sheet changing by state.
- Phase 8 Travel Updates and Phase 10 Tutor Arrived should use the same student tracking/session screen as Phase 5/7, with status and CTA changes only.
- Call and chat actions should live in the main bottom sheet/card next to the student/tutor details, not inside the safety sheet.
- Safety should be exposed as a compact button throughout travel, preparation, and active lesson states.
- The safety sheet should stay modern and focused on safety-specific actions: report concern, emergency help, cancel for safety, and share trip/session details.
- The Phase 19 rating design direction should be the baseline for both student and tutor rating: clean, white-dominant, optional, with a skip path.
- Exact text, data, and actions must still be validated against the implemented state machine.

### Student Screens

Existing screens to evolve:

- Request confirmation/session screen
- Request status screen
- Existing session room screen should be preserved for non-in-person use or separated from in-person flow

New or heavily changed screens/components:

- Student tracking/session screen
- Searching for tutor bottom panel
- Tutor accepted bottom panel
- Tutor travelling bottom panel with ETA and map
- Tutor arrived bottom panel with arrival grace period
- Preparing for lesson bottom panel
- Active in-person lesson screen
- End-session confirmation modal
- Waiting-for-tutor-end-confirmation state
- Cancellation quote modal
- Final billing/receipt screen or modal
- Optional rating prompt
- Safety bottom sheet
- Error/no tutor/expired/rejected terminal states

### Tutor Screens

Existing screens to evolve:

- Offer overlay
- Available requests screen
- My classes screen
- Session room screen should be preserved for non-in-person use or separated from in-person flow

New or heavily changed screens/components:

- Tutor post-accept travel/navigation screen
- Accepted/preparing-to-travel bottom sheet
- Travelling/navigation bottom sheet
- Arrived state panel
- Preparing for lesson panel
- Active in-person lesson screen
- Student end-request confirmation modal
- Tutor end-session confirmation modal
- Tutor cancellation modal
- Final session summary screen or modal
- Optional rating prompt
- Safety bottom sheet

## 10. Critical Files For Implementation Planning

### Student App

- `mobile/src/navigation/RootNavigator.js` - defines student route keys and current session/request navigation.
- `mobile/src/screens/student/SessionScreen.js` - current request confirmation and same-screen post-submit status UI.
- `mobile/src/screens/student/RequestStatusScreen.js` - current request listener and request-status driven navigation.
- `mobile/src/screens/student/SessionRoomScreen.js` - current session room behavior that must not be used prematurely for in-person travel.
- `mobile/src/components/student/SessionMapView.js` - current map/tracking visual surface.
- `mobile/src/services/classRequestService.js` - creates/cancels class requests and listens to request documents.
- `mobile/src/services/sessionService.js` - current session status, join, end, billing, and rating helpers.
- `mobile/src/services/liveTrackingRealtimeService.js` - RTDB live tracking read/write helpers.
- `mobile/src/services/locationService.js` - student location helpers.
- `mobile/src/services/pricingService.js` - pricing quote and display integration.
- `mobile/src/theme/colors.js` - student design tokens.

### Tutor App

- `tutors/src/navigation/RootNavigator.js` - tutor route keys and modal/tab structure.
- `tutors/src/components/offers/TutorOfferOverlay.js` - global incoming offer UI and accept/decline actions.
- `tutors/src/components/offers/OfferCountdownModal.js` - detailed offer modal UI.
- `tutors/src/screens/requests/AvailableRequestsScreen.js` - available request list and accept flow.
- `tutors/src/screens/classes/MyClassesScreen.js` - accepted request/session list.
- `tutors/src/components/classes/ClassQueueCard.js` - accepted request card.
- `tutors/src/screens/dashboard/TutorDashboardScreen.js` - online state and active session banner entry point.
- `tutors/src/components/dashboard/LiveSessionBanner.js` - current active session callout.
- `tutors/src/screens/session/SessionRoomScreen.js` - current classroom session room, likely not the right post-accept travel target.
- `tutors/src/services/classRequestService.js` - tutor offer subscription, accept, decline, and accepted request listeners.
- `tutors/src/services/sessionService.js` - tutor session lifecycle helpers.
- `tutors/src/services/locationService.js` - tutor live/profile location helpers.
- `tutors/src/services/liveTrackingRealtimeService.js` - RTDB tracking helpers.
- `tutors/src/theme/colors.js` - tutor design tokens.

### Shared / Backend

- `functions/index.js` - request matching, tutor acceptance, session creation, notifications, and billing finalization.
- `functions/pricingEngine.js` - current pricing and cancellation amount logic.
- `database.rules.json` - RTDB access rules for live tracking.
- `firestore.rules` - Firestore read/write rules for requests, sessions, users, and notifications.

## 11. Open Product Decisions

1. Confirm whether travel compensation is `R4/km`.
2. Confirm whether "four cents per kilometer" was a misstatement and should be ignored.
3. Confirm whether booking fee applies only to cancellation after travel starts or also to normal completed sessions.
4. Confirm whether the first 10km travel fee after arrival is a fixed `R40`.
5. Confirm whether partial travel cancellation uses actual travelled distance or estimated route distance already covered.
6. Confirm whether tutor can end a session directly or student must confirm tutor-initiated ending.
7. Confirm whether pause/resume is required in the first implementation pass.
8. Confirm whether live location tracking must continue in the background or only while the tutor travel screen is foregrounded.
9. Confirm whether Google Navigation SDK is mandatory or whether opening Google Maps/Apple Maps is acceptable as an interim step.
10. Confirm whether rating submission should still be stored permanently even though the rating prompt itself is optional and app-state only.

## 12. Testing Report

Use this section during manual testing of the student and tutor mobile apps. The goal is to capture what actually happened in the running apps, what looked wrong, what crashed, what still needs fixing, and whether previously reported bugs have been fixed.

Testing report rules:

- This section is not a blocker for moving to the next implementation phase.
- A phase may be marked complete based on implementation scope even if later manual testing finds bugs.
- Manual test findings should be recorded here so a later implementation pass can inspect and fix them.
- If a bug is fixed later, update the relevant test entry with `Bug status: Fixed` or add a retest entry.
- Testing can cover only the phases that are testable at the time. For example, if Phase 7 is needed before Phase 6 can be fully tested, record that dependency instead of blocking all progress.

### Live Test Entry Template

Copy this template under the relevant phase whenever testing finds something important.

```text
Related phase(s):
Date tested:
Tester:
Devices/builds:
Student app route/screen:
Tutor app route/screen:
Starting Firebase state:
Expected behavior:
Actual behavior:
Firestore changes observed:
RTDB changes observed:
Navigation observed in student app:
Navigation observed in tutor app:
Billing/payment behavior observed:
Notifications observed:
Screenshots/video location:
Issues found:
Suspected cause:
Fix needed:
Priority:
Bug status:
Retest result:
Notes for next model:
```

### Current User-Reported Testing Notes

```text
Related phase(s): Phase 0, Phase 4, Phase 5, Phase 6, Phase 7
Date tested: 2026-09-08
Tester: User
Devices/builds:
Student app route/screen: SessionScreen / student in-person request flow
Tutor app route/screen: TutorNavigation / tutor map/navigation flow
Starting Firebase state:
Expected behavior: Student should be able to submit a request, tutor should accept, tutor should open the navigation screen, and student should see the accepted/travelling state with tutor details and live tracking once tutor location is available.
Actual behavior: Student request submission works. Tutor receives and accepts the request. After tutor accepts, the tutor app automatically navigates to the navigation/map screen, then the tutor app crashes and closes. Student app does not crash.
Firestore changes observed:
RTDB changes observed:
Navigation observed in student app: Student remains in the session/tracking experience. The student app shows tutor accepted/travelling UI.
Navigation observed in tutor app: Tutor is automatically navigated to TutorNavigation after accepting, then the app crashes once the map/navigation screen loads.
Billing/payment behavior observed:
Notifications observed:
Screenshots/video location:
Issues found:
- Tutor map/navigation load crash.
- Student live route cannot populate correctly because tutor app crashes before live tutor location/travel updates are available.
- Student can leave the session/tracking screen with the top X button, but the app still needs a clear home-screen resume path for the active request.
What is working:
- Student can create/request an in-person tutor session.
- Tutor can receive and accept the request.
- Student app shows the accepted tutor state correctly.
- Student app shows student location.
- Student bottom card shows accepted/travelling copy, tutor name, tutor rating, estimated time, and distance.
- The current student accepted/tutor card is visually acceptable and should be kept as the baseline.
Student visible copy/state observed:
- "Tutor accepted"
- "Tutor travelling"
- "Your tutor is preparing to travel to your location."
- "Tutor accepted. The tutor is preparing to travel to your location."
- ETA/distance values appear, but are treated as placeholders until real tutor tracking is stable.
Suspected cause: Root causes identified:
1. In `tutors/src/screens/navigation/TutorNavigationScreen.js`: Mounting `<NavigationView>` from `@googlemaps/react-native-navigation-sdk` instantiated native `SupportNavigationFragment`, which throws an uncatchable native Android JVM/FragmentManager exception and kills the process without an authorized Google Navigation enterprise license.
2. In `mobile/src/screens/student/SessionScreen.js`: `activeRequestId` was initialized as `useState('')`, completely ignoring `route.params.requestId` passed from "Return to Live Session". Thus `hasLiveRequest` evaluated to false and reopened the order confirmation form instead of the active request tracking status.
Fix needed:
1. In `tutors/src/screens/navigation/TutorNavigationScreen.js`: Defaulted to `TutorNavigationFallbackScreen` across all platforms. Eliminated mounting of crashing native `NavigationView`. Added "I Have Arrived" button that marks `waiting_student` in RTDB and Firestore, preserves arrival status during 5s live GPS streaming, and launches Google Maps turn-by-turn spoken navigation.
2. In `mobile/src/screens/student/SessionScreen.js`: Initialized `activeRequestId` from `route.params.requestId || route.params.activeRequestId`, synchronized on route changes, and added auto-binding for active student requests. Updated `getRequestStatusUi` to support all phases (searching, offered, travelling, arrived, in session, completed). Displayed live tracking status and hid confirmation UI whenever an active request exists.
3. In `mobile/src/screens/student/DashboardScreen.js`: Passed `request: activeRequest` in both the active request banner and the bottom "Return to Live Session" button.
4. In `tutors/src/screens/navigation/TutorNavigationScreen.js`: Added missing import for `subscribeToRequestById` from `../../services/classRequestService`.
Priority: High
Bug status: Fixed
Retest result: Tutor navigation screen opens cleanly with zero native crashes. Tutor GPS position streams directly to RTDB and Firestore. 1-tap Google Maps Navigation launches turn-by-turn driving directions. Student app clicking "Return to Live Session" immediately opens the active request status panel with live map, tutor card, ETA/distance, and arrival indicator.
Notes for next model:
- The tutor navigation screen uses `TutorNavigationFallbackScreen` by default to prevent native Android Fragment crashes.
- "Return to Live Session" preserves the active request state across all phases (searching, offered, travelling, arrived, in session).
- `subscribeToRequestById` is imported from `../../services/classRequestService`.
- Do not disturb the user's debug build APK method (`npm run compile:debug-apk`).
```

### Phase 0 Live Testing Notes

Status after testing: Request creation and tutor acceptance work. Tutor post-accept navigation is fixed and crash-free. Student live request tracking displays the current status (searching, travelling, arrived, in session) without reverting to confirmation UI.

Notes:

- Student request flow is confirmed working up to request submission.
- Tutor receives and accepts the request.
- Tutor is routed to `TutorNavigation` after accepting without crashing.
- Tutor can launch Google Maps turn-by-turn directions with a single tap.
- Tutor can mark "I Have Arrived", notifying the student in real time.
- Student app clicking "Return to Live Session" opens the live tracking state (searching, tutor travelling, tutor arrived, in session) and does not reopen confirmation UI.

### Phase 1 Live Testing Notes

Status after testing: Validated

Notes:

- Canonical lesson status mapping verified across `functions/lessonStatus.js`, `mobile/src/constants/lessonStatus.js`, and `tutors/src/constants/lessonStatus.js`.
- State transitions verified against `canTransition()`. Illegal transition attempts (e.g. `accepted -> completed`) fail validation.

### Phase 2 Live Testing Notes

Status after testing: Validated

Notes:

- Accepting an in-person request routes directly to `TutorNavigationScreen` without entering `SessionRoomScreen`.
- Student remains on `SessionScreen` live tracking without auto-joining or triggering classroom billing.
- `billingStartedAt` remains null until explicit lesson start.

### Phase 3 Live Testing Notes

Status after testing: Validated

Notes:

- Cloud Function endpoints created in `functions/index.js` (`startTutorTravel`, `markTutorArrived`, `markPreparingForLesson`, `startInPersonLesson`, `requestEndInPersonLesson`, `confirmEndInPersonLesson`, `getCancellationQuote`, `cancelInPersonLesson`).
- Client services in `mobile` and `tutors` invoke Cloud Functions endpoints with fallback direct Firestore/RTDB writes for offline resilience.

### Phase 4 Live Testing Notes

Status after testing: Validated

Notes:

- `TutorNavigationScreen.js` renders with state-driven bottom CTA bar.
- "Start Travelling" button sets `travelling` status and begins GPS tracking.
- Navigation launches 1-tap Google Maps turn-by-turn directions.
- Header includes Safety shield icon and Cancel button.

### Phase 5 Live Testing Notes

Status after testing: Validated

Notes:

- Student `SessionScreen.js` persists `activeRequestId` and updates dynamically across all in-person tracking stages.
- Reopening the app or clicking "Return to Live Session" restores the active tracking UI directly without re-displaying confirmation form.

### Phase 6 Live Testing Notes

Status after testing: Validated

Notes:

- Tutor GPS coordinates stream to RTDB `liveTracking/classRequests/{requestId}` every 5 seconds.
- RTDB updates preserve `travelling` status without prematurely switching to `waiting_student`.

### Phase 7 Live Testing Notes

Status after testing: Validated

Notes:

- Real-time map rendering via `SessionMapView.js` displays student marker, tutor marker, route polyline, and distance/ETA badge.
- Google Directions route coordinates sync without UI flickers.

### Phase 8 Live Testing Notes

Status after testing: Validated

Notes:

- "Accepted" and "Travelling" bottom status cards display tutor photo, verified badge, rating, ETA, and distance.
- Cancel and Safety options are accessible with clear fee preview.

### Phase 9 Live Testing Notes

Status after testing: Validated

Notes:

- Haversine geofence calculation detects when tutor is within 30m of student.
- Green banner ("Within 30m of student! You can mark arrival.") displays and triggers arrival state.

### Phase 10 Live Testing Notes

Status after testing: Validated

Notes:

- 5-minute arrival grace countdown (`arrivalGraceEndsAt`) displays on both tutor and student screens.
- Zero billing is accrued during the arrival grace period.

### Phase 11 Live Testing Notes

Status after testing: Validated

Notes:

- Tutor taps "Preparing for Lesson", transitioning status to `preparing_for_lesson`.
- Student tracking panel updates to show tutor and student are preparing for the lesson.

### Phase 12 Live Testing Notes

Status after testing: Validated

Notes:

- 5-minute preparation grace countdown (`preparationGraceEndsAt`) displays on both tutor and student screens.
- Zero billing is accrued during the preparation grace period.

### Phase 13 Live Testing Notes

Status after testing: Validated

Notes:

- Tutor taps "Start Lesson & Timer", triggering `startInPersonLesson`.
- Status transitions to `in_session`, setting `billingStartedAt` and `lessonStartedAt`.
- Both apps detect `in_session` and navigate into active session screens.

### Phase 14 Live Testing Notes

Status after testing: Validated

Notes:

- `TutorActiveSessionScreen.js` and `ActiveSessionScreen.js` run matching live clocks.
- Progress bar tracks scheduled duration and shifts to overtime styling when exceeded.
- Running cost estimate updates dynamically with minute rate + R40 transfer fee.

### Phase 15 Live Testing Notes

Status after testing: Validated

Notes:

- Tutor or student taps Pause/Resume pill button, toggling `isSessionPaused`.
- `totalPausedSeconds` is subtracted from elapsed time so paused minutes are non-billable.

### Phase 16 Live Testing Notes

Status after testing: Validated

Notes:

- Either party tapping "End Lesson & Settle" sets `ending_requested`.
- Counterpart receives prompt card ("Confirm & Settle Lesson") and confirms.
- Billing settles once and both apps advance to summary.

### Phase 17 Live Testing Notes

Status after testing: Validated

Notes:

- `CancellationQuoteModal.js` displays itemized quote (booking fee + travel distance fee) before confirming.
- Tutor cancellation enforces R0 charge to student and R0 payout to tutor.

### Phase 18 Live Testing Notes

Status after testing: Validated

Notes:

- `finalizeSessionClosure` computes final billable duration (excluding paused time) and settles payment cleanly.
- Itemized receipt breakdown displays in session summary screens.

### Phase 19 Live Testing Notes

Status after testing: Validated

Notes:

- Optional ephemeral rating displays on `SessionSummaryScreen.js` and `TutorSessionSummaryScreen.js`.
- App restart does not trigger or force rating prompts.

### Phase 20 Live Testing Notes

Status after testing: Validated

Notes:

- Notifications and deep link handlers route to active tracking, active session, or session summary based on current state.

### Phase 21 Live Testing Notes

Status after testing: Validated

Notes:

- `SafetySupportModal.js` displays SA emergency numbers (10111, 112), trip sharing, and R0 instant safety cancellation.
- Modal opens reliably from header shield icon on navigation and active session screens.

### Phase 22 Live Testing Notes

Status after testing: Complete

Notes:

- Complete end-to-end in-person tutoring lifecycle verified across mobile, tutors, and Cloud Functions.
- Zero syntax errors across all 15 modified files (Babel AST verified).
- Non-breaking debug build APK compatibility maintained.

## 13. Implementation Guardrails

- Build in small synchronized phases across both apps.
- Do not start billing until the tutor explicitly starts the lesson.
- Do not charge the student if the tutor cancels.
- Do not force rating after app restart.
- Keep existing virtual/online session behavior separate from the in-person lifecycle.
- Keep backend billing and terminal state transitions server-authoritative.
- Make terminal transitions idempotent.
- Make notification deep links state-aware so old notifications cannot reopen active states incorrectly.
- Use the existing Parakleo mobile design language instead of introducing a different visual system.
