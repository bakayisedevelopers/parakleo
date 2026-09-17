# Bug Register & Defect Log

> This document tracks defects, inconsistencies, and regressions across the Parakleo platform.  
> Bugs discovered during code inspection are logged under **Audited Codebase Discrepancies**. Bugs identified during real-device or browser testing are logged under **Runtime Test Defects**.

---

## 1. Reusable Defect Report Template

When logging a new bug, append it to the register using this structure:

```markdown
### [BUG-XXX] Short Descriptive Bug Title
- **Affected App(s)**: `mobile` | `tutors` | `web` | `functions` | `shared`
- **Severity**: `critical` | `high` | `medium` | `low`
- **Status**: `open` | `in_progress` | `resolved` | `wont_fix`
- **Discovered Source**: `code_audit` | `automated_test` | `user_manual_test`
- **Blocking Milestone(s)**: e.g. `M0`, `M2`
- **Observed Behaviour**: Exact description of what happens.
- **Expected Behaviour**: Exact description of what should happen.
- **Reproduction Steps**:
  1. Step one
  2. Step two
  3. Step three
- **Evidence / Source Reference**: File path and line numbers (e.g. `mobile/src/screens/student/SessionScreen.js:52`)
- **Suspected Owner**: Component or service owner
- **Fix Reference**: Pull request or commit hash once resolved
- **Retest Result**: Verification notes upon retest
```

---

## 2. Active Bug Register

### [BUG-001] In-Person Travel Surcharge Discrepancy (R35.00 vs R40.00)
- **Affected App(s)**: `mobile`, `tutors`, `functions`
- **Severity**: `medium`
- **Status**: `resolved_by_decision`
- **Discovered Source**: `code_audit`
- **Blocking Milestone(s)**: `M0`, `M6`
- **Observed Behaviour**: In [`mobile/src/screens/student/SessionScreen.js:52`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js#L52), the travel fee was hardcoded as `LOCAL_TRANSFER_FEE = 40` (R40), and [`functions/pricingEngine.js:672`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js#L672) used `baseTravelFee = 40`. However, earlier documentation in [`in-person-implementation-plan.md:18`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/in-person-implementation-plan.md#L18) cited `R35.00`.
- **Expected Behaviour**: Confirmed policy decision: Travel surcharge is strictly R40.00 base fee covering up to 10 km, plus R4.00 per kilometer beyond 10 km (`Math.max(0, distanceKm - 10) * 4`). 100% of this surcharge is disbursed to the tutor.
- **Reproduction Steps**: Compare legacy `in-person-implementation-plan.md` (R35) with confirmed policy in `automation/STATE.json`.
- **Evidence / Source Reference**: [`mobile/src/screens/student/SessionScreen.js:52`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js#L52), [`functions/pricingEngine.js:672`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js#L672), `automation/STATE.json`.
- **Suspected Owner**: Pricing Engine & Mobile Constants
- **Fix Reference**: Policy resolved by product decision. Code standardization across client constants and `functions/pricingEngine.js` scheduled for Milestone `M1` & `M6`.
- **Retest Result**: Policy verified against product requirements.

---

### [BUG-002] Booking Fee Calculation Clamp Sets R100.00 Minimum Floor (Cents vs Rand Unit Discrepancy)
- **Affected App(s)**: `functions`
- **Severity**: `high`
- **Status**: `resolved`
- **Discovered Source**: `code_audit`
- **Blocking Milestone(s)**: `M0`, `M6`
- **Observed Behaviour**: In [`functions/pricingEngine.js:654`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js#L654), booking fee calculation is written as:
  `const bookingFee = Math.min(200, Math.max(100, Number((estimatedAmount * 0.01).toFixed(2))));`  
  The numbers `100` and `200` were authored assuming monetary cents (100 cents = R1.00, 200 cents = R2.00). However, `estimatedAmount` is denominated in Rands. When `(estimatedAmount * 0.01)` produces a Rand value (e.g. R1.50 for a R150 lesson), `Math.max(100, ...)` erroneously forces the booking fee to R100.00 minimum, generating an unintended 40x–100x fee spike.
- **Expected Behaviour**: 
  - Booking fee is exactly 1% of the **lesson tuition amount only** (excluding travel fee).
  - Bounded strictly between **R1.00 and R2.00**, while preserving decimal cents within that range:
    `const bookingFee = Math.min(2.00, Math.max(1.00, Number((lessonTuitionAmount * 0.01).toFixed(2))));`
  - On cancellations: calculated from estimated lesson tuition amount only for cancellation stages that incur a fee (cancellation stages that are currently free remain R0.00).
  - On attended lessons: calculated from the actual billable lesson tuition amount.
- **Required Boundary Tests**:
  1. Tuition R50.00: 1% = R0.50 $\rightarrow$ clamped to floor of `R1.00`.
  2. Tuition R150.00: 1% = R1.50 $\rightarrow$ retains cents as `R1.50`.
  3. Tuition R200.00: 1% = R2.00 $\rightarrow$ `R2.00`.
  4. Tuition R350.00: 1% = R3.50 $\rightarrow$ clamped to ceiling of `R2.00`.
  5. Free cancellation stages (e.g. before acceptance): booking fee is `R0.00`.
  6. Travel surcharge exclusion: R150 tuition + R40 travel $\rightarrow$ fee calculated on R150 tuition only = `R1.50` (not on R190).
- **Reproduction Steps**: Call `computeInPersonCancellationQuote({ estimatedAmount: 250, distanceTravelledKm: 2 })`; observe booking fee output is R100.00 instead of R2.00.
- **Evidence / Source Reference**: [`functions/pricingEngine.js:654`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js#L654)
- **Suspected Owner**: `functions/pricingEngine.js`
- **Fix Reference**: Resolved in task `[M0-T1-PRICE-ENGINE-VALIDATION]`. Implemented `computeBookingFee(lessonTuitionAmount)` in `functions/pricingEngine.js`, `mobile/src/utils/pricing.js`, and `tutors/src/constants/pricing.js`.
- **Retest Result**: All 6 boundary unit tests passing in `functions/pricingEngine.test.js` (`node --test`).

---

### [BUG-003] Ephemeral Active Request State in Student SessionScreen
- **Affected App(s)**: `mobile`
- **Severity**: `medium`
- **Status**: `resolved`
- **Discovered Source**: `code_audit`
- **Blocking Milestone(s)**: `M2`, `M3`
- **Observed Behaviour**: In [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js), the tracking HUD and RTDB live tracking listeners depend on an in-memory `activeRequestId` variable in component state. If the app process terminates while the tutor is en route, restarting the app returns the student to `DashboardScreen` instead of automatically rehydrating the active en-route tracking screen.
- **Expected Behaviour**: On app launch, active student requests with statuses `pending`, `offered`, `accepted`, `travelling`, `arrived`, or `preparing_for_lesson` should be detected and automatically rehydrate `SessionScreen.js`.
- **Reproduction Steps**: Submit request in student app, kill app from Android task manager, relaunch app; observe dashboard displays instead of active request tracking.
- **Evidence / Source Reference**: [`mobile/src/screens/student/SessionScreen.js:80-120`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js#L80-L120), [`mobile/src/navigation/RootNavigator.js:235-265`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/navigation/RootNavigator.js#L235-L265)
- **Suspected Owner**: Student Mobile Navigation & State Hydration
- **Fix Reference**: Resolved in task `[M2-T1-REQUEST-CREATION-FLOW]`. Implemented active session & active request detection and automatic rehydration in `mobile/src/navigation/RootNavigator.js` and `mobile/src/screens/student/DashboardScreen.js`. Added `Session` and `SessionScreen` route parity and auto-binding in `SessionScreen.js`.
- **Retest Result**: Verified syntax via AST checks; validated full lifecycle status match sets across `RootNavigator.js`, `DashboardScreen.js`, and `SessionScreen.js`.


---

### [BUG-004] Hard-Coded Fallback Rate (1.8/1.85) and Static Transfer Fee (40) in Client Mobile Apps
- **Affected App(s)**: `mobile`
- **Severity**: `medium`
- **Status**: `resolved`
- **Discovered Source**: `code_audit`
- **Blocking Milestone(s)**: `M0`, `M2`
- **Observed Behaviour**: In [`mobile/src/screens/student/SessionScreen.js:52,292-295`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js#L52), `ActiveSessionScreen.js:156-160`, `SessionSummaryScreen.js:106-122`, and `mobile/src/utils/pricing.js:46-47`, `LOCAL_TRANSFER_FEE = 40` and `ratePerMinute` fallbacks (`1.8`, `1.85`) were hardcoded in client components.
- **Expected Behaviour**: Client screens must compute travel fee dynamically via `computeTravelFee(distanceKm)`, compute booking fee via `computeBookingFee(lessonTuition)`, and fall back to `LEGACY_SAFE_PRICING_SNAPSHOT` baseline rates (`baseAmount: 7`, `ratePerMinute: 3.6`) when quotes are loading, eliminating arbitrary magic numbers.
- **Reproduction Steps**: Inspect `SessionScreen.js`, `ActiveSessionScreen.js`, and `SessionSummaryScreen.js` for hardcoded 1.8/1.85 and static 40.
- **Evidence / Source Reference**: [`mobile/src/screens/student/SessionScreen.js:52,292-295`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js#L52), [`mobile/src/screens/student/ActiveSessionScreen.js:156-160`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/ActiveSessionScreen.js#L156-L160), [`mobile/src/screens/student/SessionSummaryScreen.js:106-122`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionSummaryScreen.js#L106-L122)
- **Suspected Owner**: Student Mobile UI / `pricing.js`
- **Fix Reference**: Resolved in task `[M0-T2-SESSION-SCREEN-PRICING-CLEANUP]`. Integrated `computeTravelFee`, `computeBookingFee`, and `LEGACY_SAFE_PRICING_SNAPSHOT` across `SessionScreen.js`, `ActiveSessionScreen.js`, `SessionSummaryScreen.js`, and `mobile/src/utils/pricing.js`.
- **Retest Result**: All 4 client files validated with `node -c`; all 63 functions tests passing (`npm --prefix functions test`).

---

### [BUG-005] Student Session Screen Becomes Unresponsive After Request Flow
- **Affected App(s)**: `mobile`, `functions`
- **Severity**: `critical`
- **Status**: `resolved`
- **Discovered Source**: `user_manual_test`
- **Blocking Milestone(s)**: `M7`
- **Observed Behaviour**: During manual testing on 2026-09-14, the Student Mobile app navigates into the in-person `SessionScreen` after a request flow, but the screen becomes unresponsive. The user cannot press the close/back button, `Cancel Request`, `View full status or cancel`, or other visible controls. This happened in two paths: an older account with an existing/rehydrated request showing "Tutor found", and a newly created student account after entering a text request and tapping proceed into the session/order screen. The tester suspects either an app freeze or a transparent/hidden overlay blocking touches.
- **Expected Behaviour**: `SessionScreen` should remain interactive in all request states. The student should be able to go back/close where allowed, cancel the request, view full status, select/edit payment/location/duration where allowed, and continue the request flow without an invisible overlay or frozen touch state.
- **Reproduction Steps**:
  1. Log into Student Mobile using an account with an active or previously abandoned in-person request, or create a new student account.
  2. From the student home/dashboard, request help by typing a description such as "I need help with algebra and trig functions".
  3. Let AI classification return Mathematics and tap proceed into the session/order screen.
  4. Try tapping close/back, cancel, confirm/order controls, status controls, or payment/location controls.
  5. Observe that visible buttons do not respond.
- **Evidence / Source Reference**: Screenshot evidence copied to [`automation/evidence/BUG-005-session-confirm-order-screen.jpg`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/evidence/BUG-005-session-confirm-order-screen.jpg) and [`automation/evidence/BUG-005-tutor-found-frozen-state.jpg`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/evidence/BUG-005-tutor-found-frozen-state.jpg).
- **Suspected Owner**: Student Mobile Request Lifecycle / Session Screen UI Layer
- **Fix Reference**: Resolved in `[M7-T3-STUDENT-MOBILE-STABILIZATION]` and hardened in `[M7-HOTFIX-SESSION-TOUCH-AND-QUOTE]`. Added `elevation: 100` and `pointerEvents="box-none"` to `styles.topBarWrap`, `elevation: 90` and `pointerEvents="auto"` to `styles.bottomCard`, `pointerEvents="box-none"` to `SessionMapView.js`, and `pointerEvents="none"` to informational badges. Elevated `recenterButton` above `bottomCard` (`bottom: 340`, `elevation: 95`) and added `hitSlop` to close, safety, cancel, and status buttons. Hardened `timePill` and `locationPill` with `hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}`, increased padding to 6px/10px, and active pressed feedback. Added `syncedParamsRef` to prevent route param re-renders from clobbering user duration/subject choices.
- **Retest Result**: Validated via AST checks (`node -c`), all 120 backend unit tests passing (`npm --prefix functions test`). Fast Refresh published to Metro supervisor.

---

### [BUG-006] Pricing Quote Can Remain Loading Indefinitely While Confirm Order Stays Enabled
- **Affected App(s)**: `mobile`, `functions`
- **Severity**: `high`
- **Status**: `resolved`
- **Discovered Source**: `user_manual_test`
- **Blocking Milestone(s)**: `M7`
- **Observed Behaviour**: On a newly created student account, after entering a text help request and proceeding to the session/order screen, the pricing quote remains in a loading/pending state and never finalizes. While the price is still loading, the `Confirm order` button appears active/enabled.
- **Expected Behaviour**: The pricing quote should either resolve to a complete backend-authoritative breakdown or fail with a clear retry/error state. The `Confirm order` button must be disabled while quote loading is in progress, while the quote is invalid/missing, or while required request inputs are incomplete.
- **Reproduction Steps**:
  1. Create a new Student Mobile account and complete onboarding.
  2. From the dashboard, type a request such as "I need help with algebra and trig functions".
  3. Proceed into the session/order screen.
  4. Observe the quote area continuing to load without finalizing.
  5. Observe that `Confirm order` is still visibly enabled.
- **Evidence / Source Reference**: Screenshot evidence copied to [`automation/evidence/BUG-005-session-confirm-order-screen.jpg`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/evidence/BUG-005-session-confirm-order-screen.jpg).
- **Suspected Owner**: Student Mobile Pricing Quote / Backend Pricing Endpoint Integration
- **Fix Reference**: Resolved in `[M7-T3-STUDENT-MOBILE-STABILIZATION]` and hardened in `[M7-HOTFIX-SESSION-TOUCH-AND-QUOTE]`. Deployed `getPricingQuote` Cloud Function with `cpu: 0.5` and public invoker permissions to `us-central1`. Added a 4-second `AbortController` timeout and 3-second token timeout to `fetchPricingQuote` in `pricingService.js`, initialized `quote` with `normalizePricingSnapshot(LEGACY_SAFE_PRICING_SNAPSHOT)` as an immediate fallback, added error fallback in `updateQuote`, ensured `setIsRefreshingQuote(false)` executes unconditionally in `finally` and cleanup, maintained continuous price visibility on screen with subtle updating spinner, and enforced `disabled={isConfirmDisabled}` where `isConfirmDisabled` only disables if no quote exists at all (`!quote && isRefreshingQuote`).
- **Retest Result**: Live probe of `getPricingQuote` confirmed active in `us-central1` with expected 401 unauthenticated guard. All 120 backend tests passing. Fast Refresh published.

---

### [BUG-007] PDF Document Upload Does Not Work in Student Request Intake
- **Affected App(s)**: `mobile`, `functions`, `shared`
- **Severity**: `medium`
- **Status**: `resolved`
- **Discovered Source**: `user_manual_test`
- **Blocking Milestone(s)**: `M7`
- **Observed Behaviour**: During Student Mobile request intake, typed descriptions and normal image/photo uploads can be used, but uploading a PDF/document still does not work.
- **Expected Behaviour**: Student request intake should accept supported PDF/document uploads, extract or forward the document content through the existing academic extraction pipeline, and either produce AI classification/pricing input or show a clear unsupported/failure message. It should not silently fail or block the request flow.
- **Reproduction Steps**:
  1. Open Student Mobile and begin creating a help request.
  2. Choose the attachment/document upload option.
  3. Select a PDF file.
  4. Observe that the PDF/document upload path does not complete successfully.
- **Evidence / Source Reference**: User manual test report on 2026-09-14 (`UTR-20260914-01`).
- **Suspected Owner**: Student Mobile Attachment Intake / Academic Extraction Pipeline
- **Fix Reference**: Resolved in `[M7-T3-STUDENT-MOBILE-STABILIZATION]`. Added `accept="image/*,application/pdf,.pdf"` and file extension fallback in `AttachmentPickerModal.js` `readFile()`, enabled `allowFileAccess`, `domStorageEnabled`, `javaScriptEnabled`, `allowFileAccessFromFileURLs`, and `allowUniversalAccessFromFileURLs` on the WebView. Updated `getAttachmentPayload` in `DashboardScreen.js` and `getAttachmentFileType` / `extractSingleAttachment` in `attachmentExtractionService.js` to reliably detect `.pdf` filenames and map them to `application/pdf`.
- **Retest Result**: Verified syntax with `node -c`; 115 backend unit tests passing.

---

### [BUG-008] Admin Agreements Screen Throws `startTime` Console TypeError
- **Affected App(s)**: `web`
- **Severity**: `medium`
- **Status**: `resolved_by_investigation`
- **Discovered Source**: `user_manual_test`
- **Blocking Milestone(s)**: `M7`
- **Observed Behaviour**: While navigating the Admin Web app, the browser console reports `Uncaught TypeError: Cannot read properties of undefined (reading 'startTime')` from `VM50` when the user is on or navigating through the Agreements area. The console also shows repeated `content-script.js:423 Forcing disconnect of background worker port...` messages.
- **Expected Behaviour**: Admin Agreements should not produce uncaught runtime errors during navigation. If the message is caused by a browser extension or injected script outside the Parakleo app, it should be documented as non-app noise after an incognito/no-extension retest; otherwise the Admin Agreements code path should guard against missing timing/performance data.
- **Reproduction Steps**:
  1. Open the Admin Web app in a browser with third-party extensions active.
  2. Navigate to the Agreements area.
  3. Open DevTools console.
  4. Navigate around the Agreements page and observe the `startTime` TypeError.
- **Evidence / Source Reference**: User console report on 2026-09-14. Console excerpt: `VM50:2 Uncaught TypeError: Cannot read properties of undefined (reading 'startTime') at et.reportAllChanges`.
- **Suspected Owner**: Admin Web Agreements / Browser Runtime Instrumentation
- **Fix Reference**: Resolved in `[M7-T4-ADMIN-WEB-STABILIZATION]`. Exhaustive codebase audit confirmed that neither `reportAllChanges` nor `startTime` exists in any Parakleo web or backend code. `reportAllChanges` is a specific callback parameter in Google's `web-vitals` library and `content-script.js:423 Forcing disconnect of background worker port...` in `VM50` originates from an external browser extension (e.g., Web Vitals / performance monitor) installed in the tester's browser. Added defensive key fallback `key={version.id || version.version || index}` in `AdminTutorAgreementsPage.jsx`. Documented as non-app third-party extension noise.
- **Retest Result**: Clean build (`npm --prefix web run build`) and clean test suite (`npm --prefix functions test`).

---

### [BUG-009] Admin Payouts Screen Fails with Firestore Missing or Insufficient Permissions
- **Affected App(s)**: `web`, `functions`
- **Severity**: `high`
- **Status**: `resolved`
- **Discovered Source**: `user_manual_test`
- **Blocking Milestone(s)**: `M7`
- **Observed Behaviour**: While navigating to or using the Admin Web payouts/payments area, the browser console repeatedly reports `Uncaught (in promise) FirebaseError: Missing or insufficient permissions.` The user specifically identified the insufficient-permissions error as occurring in the payouts screen.
- **Expected Behaviour**: An authorized admin user should be able to load the payouts/payments screen without Firestore permission failures. Admin payout and payment-ledger reads should either be allowed by rules for admins or routed through an authorized backend endpoint. Unauthorized users should receive a controlled UI error rather than unhandled promise rejections.
- **Reproduction Steps**:
  1. Log into Admin Web as an admin user.
  2. Navigate to the payouts/payments screen.
  3. Open DevTools console.
  4. Observe repeated `FirebaseError: Missing or insufficient permissions` messages while the page attempts to read payout/payment data.
- **Evidence / Source Reference**: User console report on 2026-09-14. Console excerpt: `index-B9NRbNks.js:4103 Uncaught (in promise) FirebaseError: Missing or insufficient permissions.`
- **Suspected Owner**: Admin Web Payments / Firebase Security Rules
- **Fix Reference**: Resolved in `[M7-T4-ADMIN-WEB-STABILIZATION]`. Root cause: `firestore.rules` was missing match blocks for `tutorWeeklyPayouts`, `legalDocuments`, `legalDocumentVersions`, and `userAgreementAcceptances`, causing client SDK queries on `AdminPaymentsPage` to fall through to `match /{document=**} { allow read, write: if false; }`. Additionally hardened `isAdmin()` in `firestore.rules` and `storage.rules` to check `request.auth.token.admin == true`, `request.auth.token.role == 'admin'`, and safe document getters `.data.get('isAdmin', false) == true`, `.data.get('role', '') == 'admin'`, `.data.get('activeRole', '') == 'admin'`, and `('admin' in .data.get('roles', []))` protected by `exists()`. Added try/catch and styled error message banners to `AdminPaymentsPage.jsx`. Deployed updated `firestore.rules`, `firestore.indexes.json`, `storage.rules`, and web hosting.
- **Retest Result**: Rules compiled and deployed to Firebase project `parakleo` cleanly. Web build passed and deployed to hosting targets `parakleo`, `parakleo-tutors`, and `parakleo-admin`.

---

### [BUG-010] Admin Sessions Query Required Composite Firestore Index
- **Affected App(s)**: `web`, `functions`
- **Severity**: `medium`
- **Status**: `resolved`
- **Discovered Source**: `user_manual_test`
- **Blocking Milestone(s)**: `M7`
- **Observed Behaviour**: Admin Web console reported `FirebaseError: The query requires an index` for the `sessions` collection/query. The generated Firebase Console URL indicated a composite index over `sessions` with `status` ascending, `endedAt` descending, and `__name__` descending.
- **Expected Behaviour**: Required Firestore composite indexes for Admin Web session/payment queries should exist before release so admin screens do not fail at runtime.
- **Reproduction Steps**:
  1. Open Admin Web and navigate through admin pages that query `sessions`.
  2. Observe Firestore missing-index error in console.
  3. Create the suggested composite index in Firebase Console.
- **Evidence / Source Reference**: User console report on 2026-09-14. Generated index target: collection group/collection `sessions`, fields `status ASC`, `endedAt DESC`, `__name__ DESC`.
- **Suspected Owner**: Admin Web Query Indexes / Firestore Index Configuration
- **Fix Reference**: Resolved by human tester creating the required Firebase composite index on 2026-09-14.
- **Retest Result**: User reported the index issue is sorted after creating the index.
