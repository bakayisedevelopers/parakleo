# User Test Reports & Human Review Feedback

> This log is reserved exclusively for the human project owner to record manual testing results on physical Android devices, emulators, and browsers.  
> **Notice**: A blank template or missing entry does **not** constitute an approval. Automated workers must not advance gated milestones without an explicit `"approved"` decision in this document.

---

## 1. How to Record Feedback

When completing a manual verification run:
1. Copy the blank template below.
2. Fill out each section with test observations and artifact references.
3. Paste the completed report under **2. Human Test Reports**.
4. Set the **Decision** field to `"approved"` (if ready to advance) or `"changes requested"` (if defects were found).

---

## 2. Blank Report Template

```markdown
### [UTR-YYYYMMDD-XX] User Manual Test Report
- **Date**: YYYY-MM-DD
- **Tester**: Human Project Owner
- **Target App(s)**: `Student Mobile` | `Tutor Mobile` | `Admin Web` | `Cross-App Dual Device`
- **Build / Commit Reference**: e.g. APK build date / Git commit hash
- **Milestone Tested**: `M0` | `M1` | `M2` | `M3` | `M4` | `M5` | `M6` | `M7`
- **Test Environment**: Physical Android device model / OS version / Browser
- **Steps Executed**:
  1. Step one
  2. Step two
  3. Step three
- **Observed Result**: Detailed notes on what occurred during the test.
- **Screenshot / Video Reference**: Path or link to recorded evidence
- **Defects Logged (Bug IDs)**: e.g. `BUG-004` (or `None`)
- **Decision**: `approved` | `changes requested` | `not tested`
- **Comments & Next Actions**: Instructions for the autonomous agent.
```

---

## 3. Human Test Reports & Release Readiness Checklist

### [ACT-004] Dual-Device Physical In-Person Flow Verification Checklist
This checklist guides the physical testing of the end-to-end in-person tutoring lifecycle across two Android devices prior to production release.

#### Pre-requisites:
- **Device A (Student)**: Install debug APK from `https://parakleo-student-download.bakayisedevelopers.co.za` (or local build).
- **Device B (Tutor)**: Install debug APK from `https://parakleo-tutors-download.bakayisedevelopers.co.za` (or local build).
- **Accounts**: 1 verified tutor account with approved subjects; 1 student account.

| Step | Phase | Action / Verification | Expected Outcome | Pass / Fail |
|:---|:---|:---|:---|:---|
| **1** | Tutor Readiness | Tutor opens app, toggles Online Status dial on Dashboard. | Dial turns green ("You're Online"), live location written to Firestore/RTDB. | [ ] |
| **2** | Student Request | Student enters topic/description, confirms map location, views price breakdown. | Dynamic quote shows Tuition + Travel Fee (R40+ base) + Booking Fee (1%, R1-R2). | [ ] |
| **3** | Dispatch Offer | Student taps "Request Tutor"; Tutor receives incoming offer popup. | Tutor hears chime, 45s countdown timer displays student distance and subject. | [ ] |
| **4** | Acceptance | Tutor taps "Accept Lesson". | Request status $\rightarrow$ `accepted`; Student HUD shows "Tutor Found" with tutor details. | [ ] |
| **5** | Travel & Telemetry | Tutor taps "Start Travel". Tutor moves/drives towards student. | Status $\rightarrow$ `travelling`; Student map shows car moving with $\sim$3s RTDB updates and live ETA/remaining km. | [ ] |
| **6** | Arrival & PIN | Tutor approaches within 50m of student location. | Auto-arrival triggers (or tutor taps "I've Arrived"); 4-digit PIN displays on Tutor screen; 5m arrival grace countdown starts on both screens. | [ ] |
| **7** | PIN Entry | Tutor shows 4-digit code; Student inputs PIN in modal. | Cloud Function validates PIN; transition to `preparing_for_lesson` with 5m preparation grace window countdown. | [ ] |
| **8** | Lesson Start | Either party taps "Start Lesson" (or 5m prep grace elapses). | Status $\rightarrow$ `in_session`; billing clock begins; running timer and cost ticker (73% tutor / 27% platform) start ticking. | [ ] |
| **9** | End Lesson | Tutor taps "End Lesson"; Student confirms completion. | Status $\rightarrow$ `ending_requested` $\rightarrow$ `completed`; billing clock stops; final minutes locked. | [ ] |
| **10** | Settlement | Server executes `finalizeSessionBilling`. | Total debit attempted; if card unconfigured or declined, balance recorded to student wallet debt (`wallet_debt_recorded`). | [ ] |
| **11** | Receipts | Both devices navigate to Summary screen. | Tutor sees 73% tuition share + 100% travel fee; Student sees itemized tuition, travel fee, booking fee, and debt pill if unpaid. | [ ] |
| **12** | Mutual Rating | Both parties submit 1-5 star ratings with optional compliment tags. | Reviews saved to Firestore; `users/{uid}.ratings` updated with new average and review count. | [ ] |

---

### [UTR-20260914-01] User Manual Test Report
- **Date**: 2026-09-14
- **Tester**: Human Project Owner
- **Target App(s)**: `Student Mobile`
- **Build / Commit Reference**: Latest deployed/debug build available to tester on 2026-09-14 after Firebase Functions deployment.
- **Milestone Tested**: `M7`
- **Test Environment**: Physical Android testing environment; exact device model/OS not recorded.
- **Steps Executed**:
  1. Created a new student account.
  2. Completed student profile/onboarding.
  3. Added and verified card details through Paystack.
  4. Attempted student request intake using typed text: "I need help with algebra and trig functions".
  5. Confirmed AI classification returned Mathematics and proceeded into the session/order screen.
  6. Retested with an older account that already had an active/rehydrated request showing "Tutor found".
  7. Attempted PDF/document upload in the request intake flow.
- **Observed Result**: Account creation, profile completion, card entry, and Paystack card verification worked. The tester could not complete the full in-person flow because the Student Mobile session/request screen became unresponsive after proceeding. On a new request, the price/quote remained loading and did not finalize. On an older active request, the screen showed "Tutor found" but controls such as cancel/status actions did not respond. PDF/document upload still did not work.
- **Screenshot / Video Reference**: [`automation/evidence/BUG-005-session-confirm-order-screen.jpg`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/evidence/BUG-005-session-confirm-order-screen.jpg), [`automation/evidence/BUG-005-tutor-found-frozen-state.jpg`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/evidence/BUG-005-tutor-found-frozen-state.jpg)
- **Defects Logged (Bug IDs)**: `BUG-005`, `BUG-006`, `BUG-007`
- **Decision**: `changes requested`
- **Comments & Next Actions**: Fix the Student Mobile session-screen unresponsiveness and pricing quote loading/confirm-button guard before retrying dual-device in-person verification. Google Maps Navigation SDK testing could not be reached yet.

---

### [UTR-20260914-02] User Manual Test Report
- **Date**: 2026-09-14
- **Tester**: Human Project Owner
- **Target App(s)**: `Admin Web`
- **Build / Commit Reference**: Production Admin Web build loaded from deployed hosting on 2026-09-14.
- **Milestone Tested**: `M7`
- **Test Environment**: Browser DevTools console during Admin Web navigation; exact browser/version not recorded.
- **Steps Executed**:
  1. Opened Admin Web.
  2. Navigated through admin areas including Agreements and Payouts/Payments.
  3. Watched browser console errors during navigation.
  4. Created the missing Firestore composite index suggested by Firebase Console.
- **Observed Result**: Agreements area produced `Cannot read properties of undefined (reading 'startTime')`. Payouts/Payments area produced repeated `FirebaseError: Missing or insufficient permissions`. A sessions query required a composite Firestore index; the tester created the suggested index and reports that index issue is now sorted. Console also included repeated `content-script.js` background-worker disconnect messages, which may be extension/runtime noise and should be verified in a clean browser context.
- **Screenshot / Video Reference**: Console output pasted into intake chat on 2026-09-14.
- **Defects Logged (Bug IDs)**: `BUG-008`, `BUG-009`, `BUG-010`
- **Decision**: `changes requested`
- **Comments & Next Actions**: Verify Agreements runtime error in incognito/no-extension context, fix Admin Payouts Firestore permission failure for authorized admins, and ensure the sessions composite index is captured in deployable Firestore index configuration if required.

---

*(Physical dual-device verification remains pending. `UTR-20260914-01` records a blocked partial manual test and does not approve release readiness.)*
