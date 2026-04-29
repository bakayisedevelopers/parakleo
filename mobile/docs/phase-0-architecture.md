# Phase 0 Architecture Freeze

Status: Completed

Completed on: 2026-04-28

## Route Inventory

Student-only mobile route map is frozen around these app areas:

- Auth: login, signup.
- Protected app shell: dashboard, requests, classes/sessions, wallet, profile.
- Future protected stacks: onboarding, request details/status, session room.

Tutor and admin routes are excluded from mobile scope.

## Accepted Package Stack

- Runtime: Expo SDK 54, React 19.1.0, React Native 0.81.5.
- Backend: `firebase@^11.10.0` modular JS SDK.
- Current implementation baseline: React Native primitives, Firebase, and `react-native-webview`.
- Intended navigation package once install completes: `@react-navigation/native`, `@react-navigation/native-stack`, and drawer/sidebar navigation primitives that preserve the web topbar plus sidebar/drawer pattern.
- Intended design utility package once install completes: `nativewind`.
- Intended Phase 2+ secure storage: `expo-secure-store`.
- Intended Phase 3 attachments: `expo-image-picker`, `expo-camera`, `expo-document-picker`, `expo-file-system`.
- Intended Phase 5 RTC: `react-native-webrtc`.
- Intended Phase 5 whiteboard candidate: `react-native-webview` hosting the existing `tldraw@4.5.9` web board.
- Payment package: `react-native-webview` hosting the same Paystack inline script flow as web, with backend verification through `verifyPaystack`.

## Endpoint Strategy

The mobile app uses `getFunctionEndpoint(functionName)` from `mobile/src/firebase/config.js`.

- Emulator mode points to `http://{EXPO_PUBLIC_FIREBASE_EMULATOR_HOST}:5001/{projectId}/us-central1/{functionName}`.
- Production mode points to `https://us-central1-{projectId}.cloudfunctions.net/{functionName}`.
- Phase 2 includes web-equivalent Paystack authorization and verification service boundaries to validate this strategy.

The endpoint names frozen for later phases are:

- `getIceConfig`
- `verifyPaystack`
- `finalizeSessionBilling`
- `extractImageOcr`
- `classifySubject`
- `syncStudentGrowth`

## Spike Results

- Firebase Auth: accepted through modular Auth service wrapper and live auth subscription.
- Firestore listener: accepted through profile, request, session, and wallet subscription boundaries.
- Storage upload: deferred to Phase 3 implementation, using Firebase Storage plus Expo file picker outputs.
- WebRTC proof: deferred until `react-native-webrtc` can be installed and linked.
- Screen-share receive: deferred to Phase 5 with existing signaling compatibility as the constraint.
- Whiteboard: WebView + current web `tldraw@4.5.9` is the selected first candidate; native canvas is rejected for now because it would create avoidable parity risk.
- Paystack: WebView-hosted inline authorization plus backend verification is accepted to mirror the web card-addition flow.

## Rejected Alternatives

- Flutter and FlutterFlow remain rejected by the locked mobile plan.
- Building tutor/admin mobile surfaces is rejected.
- Replacing the backend schema for mobile is rejected; mobile must stay compatible with web Firestore and Functions contracts.
- Rebuilding the whiteboard natively in Phase 1 is rejected because it belongs to Phase 5 and risks diverging from the tutor web board.

## Carry Forward

Later phases should continue from the student app shell and service boundaries now present under `mobile/src`. If dependency installation succeeds later, replace the internal sidebar/drawer navigator with React Navigation without changing screen/service contracts or the web-parity navigation pattern.
