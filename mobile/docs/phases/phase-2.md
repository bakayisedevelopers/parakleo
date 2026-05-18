# Phase 2 - Student Onboarding/Profile + Payment Methods

Status: Completed

## Results

- Added `OnboardingScreen` under the protected student app shell.
- Implemented student academic profile editing for grade, curriculum, discovery source, and selected subjects.
- Added native subject chip selection using the same South African subject list shape as the web app.
- Added mobile onboarding status logic matching the web student requirements: academic profile plus at least one payment method.
- Added `updateUserProfile` to the mobile user service so profile edits preserve the existing Firestore `users/{uid}` contract.
- Added `syncStudentGrowth` service boundary through the Phase 0 Functions endpoint strategy.
- Added payment method management UI for saved card display, default-card selection, card removal, and empty states.
- Replaced the temporary manual-reference card path with the web-equivalent Paystack authorization flow: open Paystack inline authorization in `react-native-webview`, charge R1, receive callback reference, call `verifyPaystack` with Firebase ID token, save the returned card, and show success/cancel/error messaging.
- Surfaced setup completion status on dashboard and profile screens.
- Added payment method management to the wallet surface while leaving wallet top-up/debt behavior for Phase 6.

## QA Outcomes

- Phase 2 stays student-only and does not add tutor/admin mobile UI.
- Profile writes use the existing web-compatible fields: `studentProfile.grade`, `studentProfile.curriculum`, `studentProfile.discoverySource`, `subjects`, and `paymentMethods`.
- Payment verification sends a Firebase ID token and `userId`, matching the backend `verifyPaystack` contract used by the web app.

## Pending Decisions

- `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` must be set in the mobile environment for the in-app Paystack authorization modal to open.
- Explicit React Native Firebase auth persistence still depends on completing the AsyncStorage/SecureStore package installation.
