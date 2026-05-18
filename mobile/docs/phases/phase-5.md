# Phase 5 - Session Room (WebRTC + Whiteboard)

Status: Completed

Checklist:
- [x] Replaced the placeholder session-room entry screen with a full-screen live classroom route.
- [x] Added student join, end-session, and cancel-with-reason actions wired to the live production session backend.
- [x] Added a WebView-hosted RTC receiver using live Firebase auth, Firestore signaling, tutor ICE config, remote audio, and tutor screen-share rendering.
- [x] Added billing-clock sync, selected-duration auto-end, and 2-minute grace-period prompt logic on mobile.
- [x] Preserved the existing mobile rating prompt flow for completed/canceled sessions.
- [x] Enabled landscape session use by switching Expo orientation from `portrait` to `default`.

Implementation notes:
- Replaced `mobile/src/screens/student/SessionRoomScreen.js` with a student-only live classroom surface that keeps the web session-room control flow: auto-join, floating connection/billing badges, mute, cancel, end session, landscape guidance, and linked request access.
- Added `mobile/src/components/student/StudentRtcSessionView.js` as an isolated WebView RTC bridge so the app can keep using the live production Firebase project without modifying the web application. The bridge uses the signed-in Firebase ID token, calls `getIceConfig`, polls the session signaling document plus tutor candidate collection, publishes student ICE candidates, and renders the tutor's shared screen/audio in the WebView stage.
- Expanded `mobile/src/services/sessionService.js` with `updateSession`, `joinSessionAsStudent`, `finalizeSessionClosure`, and `endSession`, all aligned to the existing session/request contract and `finalizeSessionBilling` backend endpoint.
- Added `mobile/src/services/iceServerService.js` as the mobile equivalent of the web ICE fetch boundary.
- Updated `mobile/src/navigation/RootNavigator.js` so `SessionRoom` renders outside the standard topbar/scroll shell and can behave like a full-screen room.
- Updated `mobile/app.json` orientation to `default` so the session room can actually be used in landscape on device.
- Whiteboard parity note: student mobile does not host a separate editable board surface because the student flow in the web app primarily receives the tutor's shared screen/board. The uploaded-work preparation path remains preserved on the linked request/session data that seeds the tutor board.
- Migration rule for this phase: use a WebView-hosted browser WebRTC receiver plus Firestore REST signaling because `react-native-webview` is already present in the mobile baseline, while native `react-native-webrtc` installation could not be completed inside this restricted environment.

QA outcomes:
- Parsed all changed Phase 5 mobile files successfully through local Babel using `babel-preset-expo`.
- Did not run Expo/device QA in this sandbox, so microphone permission prompts, Android/iOS WebView media autoplay behavior, actual tutor screen-share playback, and end-to-end live-session billing still need on-device verification against production Firebase.
- Did not install additional packages in this run; the implementation stays within the current mobile dependency baseline.

Pending decisions:
- If device QA shows WebView WebRTC limitations on the target phones, replace the RTC bridge with `react-native-webrtc` once dependency installation is available, but keep the same session route and backend contract.
- Phase 6 should build on this room by finishing wallet/debt follow-up parity and broader production hardening after live-session device verification is complete.
