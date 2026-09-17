# Feature Requests & Specification Intake

> This document is the intake log for proposed feature modifications, scope changes, and new capability requests.  
> It allows a separate feature-editing chat or developer session to submit or refine feature specifications without interfering with an active coding run.
>
> **Important Distinction**:
> - **Human-Requested Features**: Confirmed product requirements directly requested by the project owner.
> - **Agent Suggestions**: Proposed enhancements or refactors submitted by AI agents. **Agent suggestions are not automatically approved** and must remain in `proposed` status until explicitly approved by the human owner.

---

## 1. Feature Intake Template

```markdown
### [REQ-XXX] Short Feature Title
- **Origin**: `human_requested` | `agent_suggestion`
- **Assigned Feature ID**: e.g. `STU-XXX`, `TUT-XXX`, `ADM-XXX`, `SH-XXX`
- **Target App(s)**: `mobile` | `tutors` | `web` | `functions` | `shared`
- **Launch Scope Classification**: `required_initial_launch` | `planned_post_launch` | `inactive_preserved`
- **Status**: `proposed` | `approved` | `rejected` | `implemented`
- **Description & Plain-English Behaviour**:
  Clear description of what happens, who sees it, and failure states.
- **Dependencies**:
  Pre-requisite services, endpoints, or UI states.
- **Plan Modifications Required**:
  Which master milestones or app plans need updates.
- **Approval Date**: YYYY-MM-DD (or `pending`)
```

---

## 2. Active Feature Requests & Intake Log

### [REQ-001] Physical Lesson Start: One-Time PIN Verification
- **Origin**: `human_requested`
- **Assigned Feature ID**: `SH-PIN-VERIFICATION`, `STU-PIN-INPUT`, `TUT-PIN-DISPLAY`
- **Target App(s)**: `functions`, `tutors`, `mobile`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  Upon tutor arrival, a cryptographically secure 4-digit one-time PIN is generated server-side for the session. The tutor sees this PIN in their Tutor Mobile App en route / on arrival. When the tutor and student meet physically, the student enters this PIN in their Student Mobile App. The Cloud Function validates the PIN with rate-limiting (max 3–5 attempts). On success, the server emits an authoritative `startInPersonLesson` event, setting `billingStartedAt = now`, status `in_session`, and synchronizing both mobile screens. QR codes are explicitly excluded.
- **Dependencies**: `functions/index.js`, `tutors/src/screens/navigation/TutorNavigationScreen.js`, `mobile/src/screens/student/SessionScreen.js`
- **Plan Modifications Required**: Integrated into Milestone `M4` & `M5`.
- **Approval Date**: 2026-09-13

---

### [REQ-002] Public Informational Websites with Download Links Only
- **Origin**: `human_requested`
- **Assigned Feature ID**: `SH-PUBLIC-WEBSITES`
- **Target App(s)**: `web`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  For initial launch, the public websites at `/` and `/tutor` function strictly as informational marketing landing pages directing visitors to download the respective mobile applications. All student/tutor web login, registration, booking, and session room links are unlinked from active public navigation and call-to-action buttons, replaced with "Download Student App" and "Download Tutor App" buttons pointing to the staged APK download services. Existing web app code (`/app/student/*`, `/app/tutor/*`) remains preserved in the repository for post-launch/legacy use. Admin Web (`/app/admin/*`) remains fully active.
- **Dependencies**: `web/src/pages/portal/PortalLandingPage.jsx`, `web/src/components/common/Header.jsx`
- **Plan Modifications Required**: Integrated into Milestone `M1` (Web Surface Realignment).
- **Approval Date**: 2026-09-13

---

### [REQ-003] Revenue Split: 73% Tutor / 27% Platform
- **Origin**: `human_requested`
- **Assigned Feature ID**: `SH-PRICING-ENGINE`
- **Target App(s)**: `functions`, `web`, `tutors`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  Applicable lesson revenue is split 73% to the tutor and 27% to the platform. 100% of the travel fee is paid to the tutor. The platform retains the booking fee. Replace all outdated 80/20 specifications in documentation and audit code calculations.
- **Dependencies**: `functions/index.js` (`BILLING_RULES`), `functions/pricingEngine.js`, `web/src/pages/app/admin/AdminPaymentsPage.jsx`
- **Plan Modifications Required**: Milestone `M0` & `M6`.
- **Approval Date**: 2026-09-13

---

### [REQ-004] Dynamic Backend Pricing Engine & Fair Multi-Stage Cancellation Framework
- **Origin**: `human_requested`
- **Assigned Feature ID**: `SH-PRICING-ENGINE`, `SH-STAGE-PRICING-AND-CANCELLATIONS`, `STU-REQ-CONFIRM`, `STU-CANCEL-FEE`, `TUT-CANCEL-HANDLING`
- **Target App(s)**: `functions`, `mobile`, `tutors`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  Client applications must never use hard-coded rates, base amounts, or transfer fees (e.g. eliminating fallback `1.8`, fixed `LOCAL_TRANSFER_FEE = 40`, and static `3.0`). All rates, travel fees, base prices, and booking fees must be dynamically computed by Cloud Functions (`getPricingQuote`, `getCancellationQuote`, `finalizeSessionBilling`). These 4 core variables ($B$: Base Price, $R$: Rate per minute, $T$: Route Travel Fee, $F_B$: Booking Fee) determine the exact value charged at every stage of the request:
  1. **Stages 1–3 (`pending`, `matching`, `offered`, `accepted` pre-travel)**: Free cancellation (R0.00 charged to student, R0.00 payout to tutor).
  2. **Stage 4 (`travelling`)**: Student charged $F_B + T_{\text{en\_route}}$ (where $T_{\text{en\_route}} = \min(T, \max(20.00, D_{\text{travelled}} \times \text{R}4.00))$). 100% of $T_{\text{en\_route}}$ is paid to tutor.
  3. **Stages 5–6 (`arrived`, `preparing_for_lesson`)**: Student charged $F_B + T + B$. Tutor receives $T + (B \times 0.73)$.
  4. **Stage 7 (`in_session` early cancel)**: Student charged Attended Tuition ($B + M_{\text{attended}} \times R$) + Travel Fee ($T$) + Booking Fee ($F_B$). Tutor receives $T + (\text{Tuition} \times 0.73)$.
  5. **Stage 8 (`completed`)**: Normal completion charged at Net Tuition + Travel Fee ($T$) + Booking Fee ($F_B$).
  6. **Tutor Cancellation**: If tutor cancels at any stage, student pays R0.00, tutor receives R0.00, and tutor reliability rating is flagged.
- **Dependencies**: [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js), [`functions/index.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/index.js), [`mobile/src/services/pricingService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/services/pricingService.js), [`mobile/src/screens/student/SessionScreen.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionScreen.js)
- **Plan Modifications Required**: Milestones `M0`, `M2`, and `M6`.
- **Approval Date**: 2026-09-13

---

### [REQ-005] Student Onboarding Revamp: Selfie Required, Card Optional, Cash Default
- **Origin**: `human_requested`
- **Assigned Feature ID**: `STU-ONBOARD-REVAMP`, `STU-PAY-WALLET`, `SH-IDENTITY-VERIFICATION`
- **Target App(s)**: `mobile`, `functions`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  Revamp the Student Mobile onboarding flow so a new student can complete their profile without being forced to add a card. Required steps should include account creation/login details, personal details, subject/learning profile selection, required selfie/photo capture, phone number verification, and email verification. The final payment step should be optional: the UI should explain that adding a card makes future booking easier, but skipping it must still mark the profile as complete. If the user skips card setup, the app should assign/use the existing cash payment method as the default payment option. If the user adds a card, Paystack card verification should remain available and the card can become the preferred payment method.
- **Dependencies**:
  Coordinate with `REQ-006`: referral rewards must no longer be granted solely when a referred student completes their profile. Student profile completion now depends on verified email, verified phone number, selfie/profile data, and subject/learning profile completion, while card setup remains optional. Relevant areas likely include `mobile/src/screens/student/OnboardingScreen.js`, `mobile/src/context/AuthContext.js`, `mobile/src/services/userService.js`, `mobile/src/screens/student/WalletScreen.js`, Paystack card setup components, and any backend/user-profile completion logic in `functions/`.
- **Plan Modifications Required**:
  Add a bounded M7 stabilization task or pre-launch mobile polish task for student onboarding completion criteria, selfie capture, verified phone/email, optional card setup, cash fallback, and referral reward regression tests.
- **Approval Date**: 2026-09-14

---

### [REQ-006] Student Launch Promo & Referral Rewards: First-Lesson Discount, Qualified 15-Minute Reward
- **Origin**: `human_requested`
- **Assigned Feature ID**: `SH-LAUNCH-PROMOS`, `SH-REFERRAL-REWARDS`, `STU-REFERRAL-UI`
- **Target App(s)**: `mobile`, `web`, `functions`, `shared`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  Replace the current new-student free-minute/default-free-lesson launch incentive with a safer paid-first-lesson promotion. New students should receive **25% off their first completed paid lesson**, capped at **R50 maximum discount**, calculated against the full student-facing order total for that first lesson so the discount feels transparent to the student. The student should not receive an automatic 30 free minutes simply for creating an account.

  Tutor promotional payout handling must be transparent in the Tutor Agreement and admin agreement/versioning workflow. For a first-time-user promotional lesson, the tutor receives **75% of the discounted total amount paid/settled for that lesson**, and that 75% is understood to include the tutor's travel compensation and lesson compensation for the promotional booking. The platform receives no separate promotional upside beyond the remaining amount after tutor payout and operational fees, and the agreement must clearly disclose this promotional payout rule before tutors accept work.

  Referral rewards should remain as **15 free minutes** for the referring student, but only after the referred student completes their first paid/discounted lesson and the lesson is not cancelled, refunded, or disputed. Referral rewards must not trigger merely because the referred student created an account or completed their profile. Referral free minutes may apply against the full student-facing amount where the product says "free minutes", but the implementation must keep tutor payout, cancellation, and settlement rules explicit and auditable.
- **Dependencies**:
  Requires `REQ-005` phone/email/selfie onboarding verification to reduce referral abuse. Requires backend checks for unique referred accounts, no self-referrals, one reward per referred student, and settlement completion before reward grant. Current constants and UI references to review include `DEFAULT_STUDENT_FREE_MINUTES = 30`, `REFERRAL_REWARD_MINUTES = 15`, `freeMinutesRemaining`, referral dashboard/profile copy, pricing quote discount previews, settlement, and cancellation flows.
- **Plan Modifications Required**:
  Add to M7 Student Mobile stabilization/pre-launch pricing polish. Update Tutor Agreement content and Admin Agreement publishing so the promotional payout rule is visible, highlighted, and versioned. Add regression tests for first-lesson discount cap, referral qualification, anti-abuse gates, tutor payout, and cancellation/refund exclusion.
- **Approval Date**: 2026-09-14

---

### [REQ-007] Tutor Onboarding Right-to-Work Verification: ID or Passport with Valid Work Visa
- **Origin**: `human_requested`
- **Assigned Feature ID**: `TUT-ONBOARD-IDV`, `ADM-TUTOR-VERIFY`, `SH-IDENTITY-VERIFICATION`
- **Target App(s)**: `tutors`, `web`, `functions`, `shared`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  Tutor onboarding must require both safety/background documentation and right-to-work identity documentation before a tutor can be approved. In the police-clearance/document phase, tutors must upload a police clearance plus either a South African ID document or a passport with a valid South African work visa/right-to-work evidence. This requirement is for age/identity verification, safety, and legal work eligibility.

  The uploaded identity/right-to-work documents must not be verified by AI. They must enter the Admin Web manual review queue. The tutor should not be marked verified, should not be able to go online, and should not receive student requests until an admin manually approves the required documents. After bank account verification/onboarding step completion, tutors should land on a waiting-for-review state while admin review is pending. On every login, unverified tutors should be routed to a pending/rejected/approved status experience instead of the normal online dashboard.

  If pending, the tutor sees a waiting-for-admin-review message. If rejected, the tutor sees the rejection reason and a clear notice that uploaded private documents will be deleted within 24 hours. If approved, the tutor is automatically allowed into the normal home/dashboard experience and can go online.
- **Dependencies**:
  Tutor onboarding status logic, document upload services, Admin Tutor Details review UI, Firestore/Storage document records, rejection reason persistence, and any scheduled/manual private-document deletion workflow.
- **Plan Modifications Required**:
  Add to M7 launch stabilization or pre-launch tutor onboarding hardening. Update `TUT-ONBOARD-DOC`, `ADM-TUTOR-VERIFY`, and release prerequisites so right-to-work approval gates tutor availability.
- **Approval Date**: 2026-09-14

---

### [REQ-008] Student Mobile Visual Polish: Figma-Like Icons/UI While Preserving Brand Colours
- **Origin**: `human_requested`
- **Assigned Feature ID**: `STU-UI-POLISH`
- **Target App(s)**: `mobile`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  Improve Student Mobile visual polish with a cleaner Figma-like UI/UX treatment and better use of iconography while preserving the existing Parakleo brand colours and recognizable product identity. This is a polish requirement, not permission to redesign business logic or alter previously completed milestones. Use familiar icons and tidy layout improvements where they make student flows clearer, especially onboarding, payments, referrals, request confirmation, and session status screens.
- **Dependencies**:
  Must preserve existing brand palette, core navigation, status flows, pricing logic, and launch feature behaviour. Should be implemented as focused UI polish alongside the affected launch screens, not as a broad unrelated redesign.
- **Plan Modifications Required**:
  Add as a bounded M7 Student Mobile polish subtask after critical blockers are resolved.
- **Approval Date**: 2026-09-14

---

### [REQ-009] Scheduled & Recurring Lessons Roadmap
- **Origin**: `human_requested`
- **Assigned Feature ID**: `SH-SCHEDULED-LESSONS`, `SH-RECURRING-LESSONS`, `STU-SCHEDULED-BOOKING`, `TUT-SCHEDULED-AVAILABILITY`
- **Target App(s)**: `mobile`, `tutors`, `functions`, `shared`
- **Launch Scope Classification**: `planned_post_launch`
- **Status**: `proposed`
- **Description & Plain-English Behaviour**:
  Post-launch roadmap item for scheduled lessons and recurring bookings. Scheduled lessons should allow a student to find/assign a tutor now for a future lesson time. If the assigned tutor later becomes unavailable when the lesson time arrives, the student should be guided to find another tutor. Recurring lessons should eventually support the same tutor or different tutors at each occurrence, paid in advance where appropriate, with a discounted recurring price.
- **Dependencies**:
  Requires more planning before implementation: naming, booking lifecycle states, tutor availability calendar, advance payment/refund rules, cancellation windows, tutor replacement rules, recurring discount model, notification strategy, and how this interacts with in-person travel/arrival/PIN status flows.
- **Plan Modifications Required**:
  Keep under post-launch roadmap. Do not schedule for initial launch implementation until the owner approves a complete specification.
- **Approval Date**: pending

---

### [REQ-010] Post-Launch Tutor/Student Reward System Roadmap
- **Origin**: `human_requested`
- **Assigned Feature ID**: `SH-REWARD-SYSTEM`, `STU-LOYALTY`, `TUT-LOYALTY`
- **Target App(s)**: `mobile`, `tutors`, `functions`, `shared`
- **Launch Scope Classification**: `planned_post_launch`
- **Status**: `proposed`
- **Description & Plain-English Behaviour**:
  Post-launch roadmap item for a broader reward system that can notify and reward students and tutors based on approved behaviours. The handwritten intake described a reward system that notifies the user/tutor and rewards the tutor/student. This is separate from the approved launch referral-minutes logic in `REQ-006`.
- **Dependencies**:
  Requires more planning before implementation: reward names, eligible events, anti-abuse protections, monthly caps, expiry, budget controls, user-facing progress UI, tutor fairness, accounting treatment, notification copy, and admin controls.
- **Plan Modifications Required**:
  Keep under post-launch roadmap. Do not schedule for initial launch implementation until the owner approves a complete specification.
- **Approval Date**: pending

---

### [REQ-011] Student Safety Profile, Guardian Mode & Tutor Preference Matching
- **Origin**: `human_requested`
- **Assigned Feature ID**: `STU-SAFETY-PROFILE`, `STU-GUARDIAN-MODE`, `STU-TUTOR-PREFERENCES`, `TUT-SAFETY-BADGES`, `SH-SAFETY-MATCHING`
- **Target App(s)**: `mobile`, `tutors`, `functions`, `shared`
- **Launch Scope Classification**: `required_initial_launch`
- **Status**: `approved`
- **Description & Plain-English Behaviour**:
  Add a safety-first profile and request flow for in-person tutoring without hard-blocking marketplace supply by gender. Student Mobile should collect a student safety profile during onboarding or profile completion. The flow should identify whether the learner is an adult or under 18. If the learner is under 18, guardian mode is required: collect guardian name, relationship, phone number, optional email, and require guardian consent/presence for in-person lessons.

  Same-gender tutor matching should be a soft student/guardian preference, not a blanket platform rule. The system may prioritize same-gender tutors where available, but should not silently block all other verified tutors by default. If no same-gender tutor is available, the student/guardian should be able to choose whether to keep waiting for that preference or continue with any verified tutor.

  For minor learners, every in-person request should carry a safety snapshot that tells the tutor before acceptance that guardian presence is required. The tutor must see this before accepting and should be reminded again in navigation/session screens not to begin the lesson unless the guardian is present or the required safe-location condition is satisfied.

  The existing Student and Tutor Safety Center flows should be extended rather than replaced. Guardian mode should connect to the current live tracking, safety cancel, emergency contacts, share-location/session-link, arrival PIN, ratings, and incident/reporting expectations.
- **Implementation Suggestion**:
  1. Extend student profile defaults and onboarding status logic with a `studentProfile.safety` or `studentProfile.guardian` object:
     - `learnerType`: `adult` | `minor`
     - `dateOfBirth` or age confirmation
     - `guardian.name`, `guardian.relationship`, `guardian.phoneNumber`, `guardian.email`
     - `guardian.consentAcceptedAt`
     - `safetyPreferences.guardianPresenceRequired`
     - `safetyPreferences.preferSameGenderTutor`
     - `safetyPreferences.preferPublicMeetingPlace`
  2. Add a Student Mobile onboarding/profile step after identity/contact verification and before request eligibility. Adults can continue with normal safety preferences. Minors must complete guardian details and consent/presence confirmation.
  3. When creating `classRequests`, copy a bounded `safetySnapshot` from the student profile:
     - learner type
     - guardian presence requirement
     - guardian contact summary where appropriate
     - same-gender preference
     - public meeting preference
     Avoid storing excessive private data in request documents beyond what the tutor needs for safety and session handling.
  4. Update backend matching to treat same-gender preference as a ranking boost where tutor/student gender fields are present and consented, not as a hard exclusion. Add a clear fallback path if no preferred tutor is available.
  5. Update tutor offer, navigation, and active session screens to show safety badges such as `Minor learner`, `Guardian present required`, and `Public place preferred` before acceptance and during arrival/preparation.
  6. Extend `SafetySupportModal` and session share text so a trusted contact/guardian can receive session details, meeting location, and live tracking context.
  7. Add tests for onboarding completion, request safety snapshot creation, matching preference fallback, tutor offer badge rendering, and minor guardian-presence gating.
- **Dependencies**:
  Builds on `REQ-005` student onboarding revamp, `REQ-007` tutor identity/right-to-work review, existing Student/Tutor Safety Center modals, `classRequests` request snapshots, `functions/index.js` tutor matching, `TutorOfferOverlay`, Tutor Navigation, and Student Session screens.
- **Plan Modifications Required**:
  Add to M7 pre-launch safety hardening. This may be implemented as its own bounded task `[M7-T6-SAFETY-GUARDIAN-MODE]` after Student Mobile stabilization and tutor verification work, or as a focused subtask of `M7-T3` if the worker can keep it bounded. Same-gender matching remains a preference/ranking feature, not a mandatory launch exclusion rule.
- **Approval Date**: 2026-09-14
