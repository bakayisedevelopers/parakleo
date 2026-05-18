# Phase 4 - Request Tracking + Notifications + Sessions List

Status: Completed

Checklist:
- [x] Added a request status tracker screen with live lifecycle mapping and cancel flow.
- [x] Added a full request details screen with pricing, session linkage, and attachment access.
- [x] Upgraded the "My Classes" list and sessions list with join/re-open entry actions.
- [x] Added an in-app notification center with unread indicator and request/session routing.
- [x] Added session rating prompt handling for completed/canceled sessions.
- [x] Added mobile deep-link routing for request status/details and session room entry.

Implementation notes:
- Replaced the placeholder mobile request/session lists with richer parity surfaces in `mobile/src/screens/student/RequestsScreen.js` and `mobile/src/screens/student/SessionsScreen.js`.
- Added `mobile/src/screens/student/RequestStatusScreen.js` to mirror the web request status flow: live lifecycle copy, request overview, tutor-offer state, cancel action, and session join handoff.
- Added `mobile/src/screens/student/RequestDetailsScreen.js` so students can review full request fields, pricing snapshot, linked session state, and uploaded attachments.
- Added `mobile/src/screens/student/SessionRoomScreen.js` as the Phase 4 session-room entry shell. It preserves deep-link/session access and request context while deferring live RTC + whiteboard controls to Phase 5.
- Reworked `mobile/src/navigation/RootNavigator.js` into a lightweight route/deep-link shell with request/session detail routing, topbar notification access, live-session shortcut, and rating prompt mounting.
- Added Firestore-backed notification and rating plumbing in `mobile/src/services/notificationService.js`, `mobile/src/services/sessionService.js`, `mobile/src/services/classRequestService.js`, and `mobile/src/services/userService.js`.
- Added `claxi://request/:id`, `claxi://request-details/:id`, and `claxi://session/:id` deep-link parsing via `mobile/app.json` and the internal navigator.

QA outcomes:
- Parsed all changed Phase 4 mobile files successfully through local Babel using `babel-preset-expo`.
- `expo export --platform web` could not complete in this sandbox because the Expo CLI hit a network `fetch failed` error before bundling.
- Did not run Expo/device QA in this sandbox, so gesture polish, actual deep-link launch behavior, and Firestore-driven notifications/rating prompts still need manual phone verification.

Pending decisions:
- `expo-notifications` is still not installed in the current mobile baseline, so Phase 4 implements the in-app Firestore notification feed and unread indicator only. Native push registration can be added later without changing the request/session routing built here.
- Phase 5 should replace the current `SessionRoomScreen` shell with the full RTC/screen-share/whiteboard experience while keeping the same route and deep-link entry points.
