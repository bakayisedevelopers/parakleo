# Parakleo Tutor Web-to-Mobile Conversion Master Plan (`tutors/`)

This document is the authoritative, exhaustive technical blueprint for porting the **Parakleo Tutor Web Application** (`web/src/pages/app/tutor/`, `web/src/...`) to a dedicated native **React Native / Expo Mobile Application** (`tutors/`).

> **Architectural Guarantee**: Any engineer or AI agent implementing any phase of this plan must maintain **100% exact parity** in UI design tokens, component hierarchy, Firestore data schemas, realtime listeners, state transitions, business rules, and error handling with the web reference codebase.

---

## 1. Web to Mobile Package & Dependency Translation Matrix

| Web Technology (`web/package.json`) | Mobile Native Equivalent (`tutors/package.json`) | Purpose / Feature Usage |
| :--- | :--- | :--- |
| `react-router-dom` (`v6`) | `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack` | Client-side routing $\rightarrow$ Native Tab & Stack Navigation. |
| `lucide-react` | `@expo/vector-icons` (`Ionicons`, `MaterialCommunityIcons`, `Feather`) | Iconography across all headers, cards, and action buttons. |
| Tailwind CSS classes (`index.css`) | `StyleSheet.create({})` + `theme/colors.js` + `theme/typography.js` | Zinc/Emerald color palettes, `rounded-[2rem]` card geometry, shadow tokens. |
| `firebase` (`v11.x` Firestore/Auth/Storage) | `firebase` (`v11.10.x` JS SDK) or `@react-native-firebase/*` | Identical Firestore queries, collection listeners, Auth tokens. |
| Native File Upload / `<input type="file">` | `expo-image-picker`, `expo-document-picker` | Profile avatars, degree verification PDFs, problem attachments. |
| Browser Audio / WebRTC / MediaStream | `react-native-webview` (Whiteboard & RTC Bridge) / `expo-av` | In-class voice chat, live audio cues, whiteboard canvas streaming. |
| Tldraw Web SDK (`TldrawSdkEmbed.jsx`) | `TldrawNativeEmbed` via `react-native-webview` postMessage bridge | Collaborative interactive whiteboard mirroring web classroom. |
| Browser Timers & Interval Hooks | `setInterval` with Native AppState listeners | Background-aware session timers and offer expiration countdowns. |
| Browser Notifications / Audio Chime | `expo-notifications`, `expo-haptics`, `expo-av` | Vibration and sound chimes on new incoming class offers. |
| Clipboard API (`navigator.clipboard`) | `expo-clipboard` | Copying meeting links, support IDs, and transaction references. |

---

## 2. Target File Structure (`tutors/`)

```
tutors/
├── package.json
├── app.json
├── eas.json
├── babel.config.js
├── App.js
└── src/
    ├── theme/
    │   ├── colors.js                     # Exact mirror of web zinc/emerald/amber tokens
    │   ├── spacing.js                    # Padding, margins, radii definitions
    │   └── typography.js                 # Font weights, font sizes, line heights
    ├── constants/
    │   ├── lifecycle.js                  # REQUEST_STATUS, SESSION_STATUS, OFFER_TIMEOUT
    │   ├── pricing.js                    # TUTOR_PAYOUT_RATE, PLATFORM_FEE_RATE
    │   ├── onboarding.js                 # Required onboarding verification steps
    │   └── runtimeConfig.js              # Firebase config & Cloud Function endpoints
    ├── context/
    │   ├── AuthContext.js                # Tutor Auth state, idToken, userProfile
    │   └── ActiveOfferContext.js         # Live incoming offer banner/modal state
    ├── services/
    │   ├── userService.js                # getUserProfile, updateUserProfile, setOnlineStatus
    │   ├── classRequestService.js        # acceptOffer, declineOffer, subscribeToAvailable
    │   ├── sessionService.js             # subscribeToTutorSessions, startSession, endSession
    │   ├── payoutService.js              # listTutorWeeklyPayouts, requestPayout
    │   ├── legalAgreementService.js      # signTutorAgreement, getSignedAgreement
    │   ├── storageService.js             # uploadTutorDocument, uploadAvatar
    │   └── notificationService.js        # subscribeToNotifications, markRead
    ├── hooks/
    │   ├── useAuth.js
    │   ├── useTutorRequests.js           # useAvailableOffers, useAcceptedClasses
    │   ├── useTutorSessions.js           # useLiveSession, useSessionHistory
    │   └── useOfferCountdown.js          # 45s / 20s precision countdown timer
    ├── components/
    │   ├── ui/
    │   │   ├── Button.js                 # Primary emerald, secondary zinc, danger red
    │   │   ├── Card.js                   # 2rem rounded card with zinc-200 border
    │   │   ├── Badge.js                  # Status badges (Online, Live, In Progress)
    │   │   ├── MetricTile.js             # Exact match of TutorMetricTile.jsx
    │   │   ├── Header.js                 # Mobile PageHeader with back & notification bell
    │   │   └── States.js                 # LoadingSpinner, EmptyState, ErrorBanner
    │   ├── dashboard/
    │   │   ├── OnlineStatusToggle.js     # Prominent online/offline switch
    │   │   ├── LiveSessionBanner.js      # Sticky active session join card
    │   │   └── PerformanceMetricsGrid.js # Acceptance, completion, rating metrics
    │   ├── requests/
    │   │   ├── IncomingOfferModal.js     # High-priority incoming offer HUD
    │   │   ├── OfferCountdownBar.js      # Animated expiring progress bar
    │   │   └── RequestCard.js            # Request detail card with subject & description
    │   ├── session/
    │   │   ├── TutorRtcSessionView.js    # WebRTC Audio controller
    │   │   ├── TutorWhiteboardView.js    # WebView bridge for Tldraw canvas
    │   │   ├── SessionTimerBar.js        # Billed seconds and duration indicator
    │   │   └── EndSessionModal.js        # Early closure & completion dialog
    │   └── payments/
    │       ├── SummaryCard.js            # Available balance, pending payouts
    │       ├── WeeklyPayoutAccordion.js  # Expandable weekly earnings group
    │       └── BankingDetailsModal.js    # Bank account configuration form
    ├── navigation/
    │   ├── RootNavigator.js              # Auth vs App Stack Navigator
    │   ├── TutorTabNavigator.js          # Bottom 5-Tab Bar
    │   └── AppStack.js                   # Full-screen modal navigators
    └── screens/
        ├── auth/
        │   ├── LoginScreen.js
        │   └── SignupScreen.js
        ├── onboarding/
        │   ├── TutorOnboardingScreen.js  # 4-Step onboarding wizard
        │   └── TutorAgreementScreen.js   # Digital contract signature screen
        ├── dashboard/
        │   └── TutorDashboardScreen.js   # Main command center
        ├── requests/
        │   └── AvailableRequestsScreen.js# Live offer backlog
        ├── classes/
        │   └── MyClassesScreen.js        # Accepted classes & teaching schedule
        ├── session/
        │   └── SessionRoomScreen.js      # Native virtual classroom
        ├── history/
        │   ├── TutorSessionsScreen.js    # Completed session logs
        │   └── SessionDetailScreen.js    # Per-session breakdown & rating
        ├── payments/
        │   └── TutorPaymentsScreen.js    # Financial wallet & payout records
        ├── profile/
        │   └── TutorProfileScreen.js     # Edit bio, subjects, qualifications
        └── notifications/
            └── NotificationsScreen.js    # Notifications feed & deep-link router
```

---

## 3. Core Features & Importance Hierarchy

```
+-----------------------------------------------------------------------------------------+
| [CRITICAL TIER 1] - REALTIME DISPATCH & VIRTUAL CLASSROOM                               |
| 1. Online/Offline Dispatch Switch (Firestore user.onlineStatus toggling)                |
| 2. Incoming Offer Modal with 45s Countdown & Vibration/Chime Notification               |
| 3. Virtual Classroom: WebRTC Voice, Tldraw Whiteboard Canvas, Live Billed Timer        |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| [CORE TIER 2] - TEACHING PIPELINE & FINANCIAL MANAGEMENT                                |
| 4. My Classes Queue: Accepted bookings awaiting student connection                      |
| 5. Weekly Payouts & Banking Setup: Balance cards, weekly breakdown, withdrawal requests |
| 6. Multi-Step Tutor Onboarding: Subject mastery, document uploads, KYC verification     |
| 7. Legally Binding Digital Tutor Agreement with signature capture                       |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| [SUPPORTING TIER 3] - ACCOUNT, ANALYTICS & ALERTS                                       |
| 8. Tutor Performance Metrics Dashboard (Acceptance rate, completion rate, avg rating)   |
| 9. Historical Session Archives with student reviews & duration metrics                  |
| 10. Notification Center with deep linking to offers and sessions                        |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Master Tracking Dashboard & Implementation Statuses

| Phase | Feature / Scope | Primary Target Web Reference | Status |
| :--- | :--- | :--- | :---: |
| **Phase 1** | Project Initialization, Expo Setup, Navigation & Theme System | `web/src/App.jsx`, `web/src/index.css`, `colors.js` | `[x] Completed` |
| **Phase 2** | Authentication, Profile Management & Multi-Step Onboarding | `web/src/pages/app/OnboardingPage.jsx`, `ProfilePage.jsx` | `[x] Completed` |
| **Phase 3** | Tutor Digital Agreement & Signature Contract | `web/src/pages/app/tutor/TutorAgreementPage.jsx` | `[x] Completed` |
| **Phase 4** | Tutor Command Dashboard, Online Switch & Dispatch Metrics | `web/src/pages/app/tutor/TutorDashboardPage.jsx`, `TutorMetricTile.jsx` | `[x] Completed` |
| **Phase 5** | Live Incoming Offers, Offer Modal & Countdown Timers | `web/src/pages/app/tutor/AvailableRequestsPage.jsx`, `useClassRequests.js` | `[x] Completed` |
| **Phase 6** | My Classes Queue (Accepted, Pending Student, In-Session) | `web/src/pages/app/tutor/MyClassesPage.jsx`, `sessionService.js` | `[x] Completed` |
| **Phase 7** | Native Virtual Classroom (RTC Audio, Tldraw Whiteboard, Billing Timer) | `web/src/pages/app/SessionRoomPage.jsx`, `webrtcService.js` | `[x] Completed` |
| **Phase 8** | Tutor Sessions History, Filtering & Ratings Breakdown | `web/src/pages/app/tutor/TutorSessionsPage.jsx`, `useSessions.js` | `[x] Completed` |
| **Phase 9** | Tutor Earnings, Banking Configuration & Weekly Payout Records | `web/src/pages/app/tutor/TutorPaymentsPage.jsx`, `payouts.js` | `[x] Completed` |
| **Phase 10** | Notification Center & In-App / Push Notification Handlers | `web/src/pages/app/NotificationsPage.jsx`, `notificationService.js` | `[x] Completed` |
| **Phase 11** | End-to-End Parity Verification, Cross-Device QA & EAS Build | Entire `web/src/pages/app/tutor/` suite | `[x] Completed` |

---

### Phase 5: Available Requests Feed & Offer Response (Incoming Offer Modal)
* **Status**: `[x] Completed`
* **Objective**: Handle real-time incoming student class dispatch offers with sound chimes, haptics, and countdown timers.
* **Exact Web Source References**:
  - `web/src/pages/app/tutor/AvailableRequestsPage.jsx` (Lines 1–82)
  - `web/src/hooks/useClassRequests.js` (`useTutorAvailableRequests`)
  - `web/src/services/classRequestService.js` (`acceptClassRequest`, `declineClassRequest`)
  - `web/src/constants/lifecycle.js` (`OFFER_TIMEOUT_SECONDS = 20` / `45`)
* **Target Mobile Destination Files**:
  - `tutors/src/screens/requests/AvailableRequestsScreen.js`
  - `tutors/src/components/requests/IncomingOfferModal.js`
  - `tutors/src/components/requests/OfferCountdownBar.js`
  - `tutors/src/services/classRequestService.js`
* **Implementation Details**:
  - **Realtime Listener**: Listen to `collection('classRequests')` where `status == 'offered'` and `currentOfferTutorId == auth.uid`.
  - **Global Modal / HUD**: When an offer arrives:
    - Trigger `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.
    - Play audio chime via `expo-av`.
    - Present `IncomingOfferModal` with:
      - Subject & Topic (e.g. *"Calculus • Integration by parts"*).
      - Duration & Tutor Earning Quote (e.g. *"30 Mins • R96.00 payout"*).
      - Student Problem Description & Attachment image preview.
      - Countdown progress bar ticking down to 0.
  - **Accept Action**: Invokes Cloud Function `acceptClassRequest({ requestId })`. On success, navigates to `SessionRoomScreen`.
  - **Decline Action**: Invokes Cloud Function `declineClassRequest({ requestId })` with optimistic dismissal.

---

### Phase 6: My Classes Queue & Teaching Schedule
* **Status**: `[x] Completed`
* **Objective**: Manage upcoming and accepted classes awaiting student connection.
* **Exact Web Source References**:
  - `web/src/pages/app/tutor/MyClassesPage.jsx` (Lines 1–57)
  - `web/src/hooks/useClassRequests.js` (`useTutorAcceptedRequests`)
  - `web/src/services/sessionService.js` (`findSessionIdByRequestAndTutor`)
* **Target Mobile Destination Files**:
  - `tutors/src/screens/classes/MyClassesScreen.js`
  - `tutors/src/components/classes/ClassScheduleCard.js`
* **Implementation Details**:
  - Group `classRequests` (`status === 'accepted'`) with their corresponding `sessions` document (`status === 'waiting_student' | 'in_progress'`).
  - Render status indicator: *"Waiting for student to enter classroom"* vs *"Class is live"`.
  - 1-tap "Enter Classroom" button launching `SessionRoomScreen`.

---

### Phase 7: Virtual Classroom & Session Room (Identical to Student Mobile Architecture)
* **Status**: `[x] Completed`
* **Objective**: Implement the Tutor Virtual Classroom using the **exact same architecture as the Student Mobile App** (`mobile/src/screens/student/SessionRoomScreen.js` and `mobile/src/components/student/StudentRtcSessionView.js`), which runs the web application's battle-tested session room logic (`web/src/pages/app/SessionRoomPage.jsx`) under the hood within an authenticated, low-latency native WebView bridge.
* **Exact Web & Mobile Source References**:
  - **Student Mobile Reference (Blueprint)**: [mobile/src/screens/student/SessionRoomScreen.js](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/SessionRoomScreen.js) & [mobile/src/components/student/StudentRtcSessionView.js](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/components/student/StudentRtcSessionView.js)
  - **Web Application Classroom Engine**: [web/src/pages/app/SessionRoomPage.jsx](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/SessionRoomPage.jsx) (Lines 1–1973: WebRTC voice/video, Tldraw interactive whiteboard, question attachment layouts, billing timer, ratings)
  - **Firebase Webview Auth Endpoint**: Cloud Function `mobileWebviewAuth` / `/mobile-webview-auth`
* **Target Mobile Destination Files**:
  - `tutors/src/screens/session/SessionRoomScreen.js` (Mirrors `mobile/src/screens/student/SessionRoomScreen.js`)
  - `tutors/src/components/session/TutorRtcSessionView.js` (Mirrors `mobile/src/components/student/StudentRtcSessionView.js`)
* **Under-the-Hood Architecture & Authentication Flow**:
  1. **Zero-Duplicate Flow**: Does not invent a new native WebRTC or canvas stack. Leverages the unified web application's classroom logic via `react-native-webview` with hardware acceleration.
  2. **Auth Token Handoff (`authHandoff`)**:
     - Native Tutor App acquires Firebase Auth state: `{ apiKey, user: { uid, email, stsTokenManager: { accessToken, refreshToken, expirationTime } } }`.
     - Injected directly into the WebView's `window.localStorage` under key:
       `'firebase:authUser:' + apiKey + ':[DEFAULT]'` with `'firebase:persistence:' + apiKey + ':[DEFAULT]' = 'local'`.
     - URL target:
       `${WEB_APP_BASE_URL}/mobile-webview-auth?sessionId=${sessionId}&target=${WEB_APP_BASE_URL}/app/session/${sessionId}&source=mobile_tutor&apiKey=...`
  3. **Bi-Directional Native Bridge Protocol (`postMessage`)**:
     - **Native $\rightarrow$ WebView**: Send mute/unmute commands, camera toggle, screen-share requests, and network state updates.
     - **WebView $\rightarrow$ Native**: Emit session state (`connected`, `peer_joined`, `billed_seconds_update`, `session_ended`), audio permission requests, and error diagnostics.
  4. **Native Audio & Hardware Permissions**:
     - Android: Request `PermissionsAndroid.PERMISSIONS.RECORD_AUDIO` and `PermissionsAndroid.PERMISSIONS.MODIFY_AUDIO_SETTINGS`.
     - iOS: Enable `mediaPlaybackRequiresUserAction={false}` and `allowsInlineMediaPlayback={true}`.
  5. **Live Billable Timer Synchronization**:
     - Native wrapper calculates and synchronizes billed seconds from Firestore document:
       $$\text{LiveBilledSeconds} = \text{session.billedSeconds} + \max(0, \text{now} - \text{session.billingStartedAt})$$
  6. **Completion & Rating Modal**:
     - When session concludes, triggers native `SessionRatingPrompt` and navigates back to `MyClassesScreen` / `TutorDashboardScreen`.

---

### Phase 8: Tutor Sessions History & Performance Analytics
* **Status**: `[x] Completed`
* **Objective**: Complete historical archive of all past sessions with student ratings, earnings, and duration logs.
* **Exact Web Source References**:
  - `web/src/pages/app/tutor/TutorSessionsPage.jsx` (Lines 1–180)
  - `web/src/hooks/useSessions.js` (`useTutorSessions`)
* **Target Mobile Destination Files**:
  - `tutors/src/screens/history/TutorSessionsScreen.js`
  - `tutors/src/screens/history/SessionDetailScreen.js`
* **Implementation Details**:
  - Segmented filter control: `All` | `Completed` | `Cancelled`.
  - Session Card displaying:
    - Subject badge & Date/Time formatted via `Intl.DateTimeFormat`.
    - Duration (e.g. `28m 42s billed`).
    - Payout earned (e.g. `R89.50`).
    - Student rating (1 to 5 gold stars + student written feedback).
  - Tap card $\rightarrow$ open `SessionDetailScreen` showing full timeline (booked at, started at, completed at, topic notes).

---

### Phase 9: Tutor Earnings, Banking Setup & Payout History
* **Status**: `[ ] Not Started`
* **Objective**: Financial management screen showing weekly earnings breakdown, banking details, and payout logs.
* **Exact Web Source References**:
  - `web/src/pages/app/tutor/TutorPaymentsPage.jsx` (Lines 1–276)
  - `web/src/utils/payouts.js` (`groupSessionsByWeek`, `formatCurrency`, `formatWeekRangeLabel`)
  - `web/src/services/payoutService.js` (`listTutorWeeklyPayouts`)
* **Target Mobile Destination Files**:
  - `tutors/src/screens/payments/TutorPaymentsScreen.js`
  - `tutors/src/components/payments/SummaryCard.js`
  - `tutors/src/components/payments/WeeklyPayoutAccordion.js`
  - `tutors/src/components/payments/BankingDetailsModal.js`
* **Implementation Details**:
  - **Summary Cards**:
    - "Available Balance" (Unpaid earnings ready for weekly disbursement).
    - "Total Earned All-Time" (Sum of all completed session payouts).
    - "Active Bank Account" (e.g. `FNB •••• 4829`).
  - **Weekly Accordion**:
    - Groups sessions using `groupSessionsByWeek(sessions)` matching web.
    - Expandable card showing week label (e.g. *"25 Aug – 31 Aug 2026"*), session count, gross amount, platform fee deduction, and net tutor payout.
    - Status badge: `Paid` (Emerald), `Processing` (Sky), `Pending` (Amber).

---

### Phase 10: Notification Center & Push Handlers
* **Status**: `[ ] Not Started`
* **Objective**: Notification inbox and push notification routing for offers, payments, and system updates.
* **Exact Web Source References**:
  - `web/src/pages/app/NotificationsPage.jsx` (Lines 1–120)
  - `web/src/services/notificationService.js` (`subscribeToNotifications`, `markAllNotificationsRead`)
* **Target Mobile Destination Files**:
  - `tutors/src/screens/notifications/NotificationsScreen.js`
  - `tutors/src/services/notificationService.js`
* **Implementation Details**:
  - Realtime Firestore listener on `notifications` collection filtered by `recipientId == auth.uid`.
  - Notification types: `NEW_OFFER`, `SESSION_READY`, `PAYMENT_DISBURSED`, `SYSTEM_NOTICE`.
  - Deep-link action on press:
    - Tap `NEW_OFFER` $\rightarrow$ navigates to `AvailableRequestsScreen`.
    - Tap `SESSION_READY` $\rightarrow$ navigates to `SessionRoomScreen`.
    - Tap `PAYMENT_DISBURSED` $\rightarrow$ navigates to `TutorPaymentsScreen`.

---

### Phase 11: Parity Verification, Cross-Device QA & EAS Build Setup
* **Status**: `[ ] Not Started`
* **Objective**: Comprehensive QA verifying that the mobile tutor app is an exact functional and visual replica of the web app.
* **Target Files**:
  - `tutors/eas.json`
  - `tutors/app.json`
* **Verification Checklist**:
  1. **Matching Engine**: Create request on student app $\rightarrow$ verify Tutor Mobile App displays incoming offer modal within 1 second.
  2. **Online Status**: Toggle online/offline $\rightarrow$ verify instant reflection in Firestore and exclusion from matching pool when offline.
  3. **Classroom Parity**: Start session $\rightarrow$ verify two-way audio, Tldraw strokes sync accurately, and billing seconds increment identically.
  4. **Financial Parity**: Complete session $\rightarrow$ verify exact payout calculation ($80\%$ of billable rate) in `TutorPaymentsScreen`.
  5. **EAS Build**: Run `eas build --platform android --profile development` and verify clean compile.
