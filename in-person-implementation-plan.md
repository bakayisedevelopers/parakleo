# Parakleo In-Person Tutoring & Live Location Tracking Architecture & Implementation Plan

> **PREREQUISITE**: This plan focuses on **Mobile-to-Mobile** interaction between the **Student Mobile App** (`mobile/`) and the **Tutor Mobile App** (`tutors/`). It is executed **strictly AFTER** the Tutor Mobile App conversion ([tutors/web-to-mobile-tutors.md](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/tutors/web-to-mobile-tutors.md)) is complete.
> 
> **COEXISTENCE GUARANTEE**: In-Person tutoring **does not replace** the existing Online lesson flow. Both modes (`mode: 'online'` and `mode: 'in_person'`) coexist side-by-side within the platform.

---

## 1. Executive Summary & Core Architectural Principles

### 1.1 Unified Time-Elapsed Pricing Engine (Zero Duplicate Engine)
* **Exact Same Pricing Engine**: In-person sessions use the **exact same pricing engine** ([functions/pricingEngine.js](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js) and `computeFinalAmountFromSnapshot`) used for online lessons. Time elapsed (`billedSeconds` $\rightarrow$ `billedMinutes`) drives the core lesson cost with identical rate discounts, time-of-day multipliers, and subject adjustments.
* **Different Gating Condition for In-Person**:
  - **Online Lesson Gate**: Billing starts when WebRTC peer connection is established.
  - **In-Person Lesson Gate**: Billing starts when:
    1. **50-Meter Proximity Check**: Tutor's real-time GPS is within $\le 50\text{ meters}$ of the student's destination coordinates ($\Delta \le 50\text{m}$).
    2. **Physical Session Unlock**: The 4-digit Safety PIN is verified, setting `billingStartedAt = Date.now()` and status to `in_session`.
* **Travel Surcharge**: A fixed travel fee of **R35.00** (`travelFee = 35.00 ZAR`) is added to the in-person quote and final settlement, paid to the tutor.

### 1.2 Matching & Dispatch Architecture (Uncedo Reference Pattern)
* Modeled directly after the proven helper allocation and dispatch engine in the **Uncedo** project (`C:\Users\Jabu Babb\Documents\Code\Uncedo`):
  - **Geographic Proximity Query**: When an in-person request is submitted, the matching engine calculates radial distance to active online tutors using GeoPoints / Haversine distance, prioritizing qualified tutors closest to the student.
  - **Single-Offer Dispatch Queue**: Delivers 45-second timed offers to the top-ranked nearby tutor, cascading to the next closest tutor if declined or expired.

### 1.3 Firebase Realtime Database (RTDB) Telemetry & Navigation SDK
* **Sub-Second RTDB Streaming**: GPS telemetry (`latitude`, `longitude`, `heading`, `speed`, `distanceRemaining`, `etaSeconds`) streams to `/live_tracking/{requestId}` at 2–3 second intervals for low-latency synchronization on both mobile devices.
* **Turn-by-Turn Navigation SDK**: Tutor mobile app integrates an active Navigation SDK (Google Navigation SDK / Mapbox Navigation) providing turn-by-turn voice and visual guidance while continuously feeding coordinates to RTDB.

---

## 2. Tracking Dashboard & Implementation Statuses

| Phase | Milestone / Feature Area | Key Reference / Target Files | Status |
| :--- | :--- | :--- | :---: |
| **Phase 1** | RTDB Live Tracking Schema & Security Rules | `database.rules.json`, `/live_tracking/{requestId}` | `[ ] Not Started` |
| **Phase 2** | Pricing Engine Gating (50m Geofence + R35 Travel Fee) | `functions/pricingEngine.js`, `functions/index.js` | `[ ] Not Started` |
| **Phase 3** | In-Person Matching & Radial Tutor Allocation (Uncedo Model) | `functions/index.js`, Uncedo helper dispatch pattern | `[ ] Not Started` |
| **Phase 4** | Student App: Mode Selector & Location Picker Modal | `mobile/src/screens/student/DashboardScreen.js`, `LocationPickerModal.js` | `[ ] Not Started` |
| **Phase 5** | Tutor App: Navigation SDK Integration & En-Route HUD | `tutors/src/screens/navigation/TutorNavScreen.js`, `tutors/` | `[ ] Not Started` |
| **Phase 6** | Tutor App: RTDB Background GPS Telemetry Streamer | `tutors/src/services/locationStreamService.js`, `expo-task-manager` | `[ ] Not Started` |
| **Phase 7** | Student App: Live Map Tracking HUD & ETA Countdown | `mobile/src/screens/student/RequestStatusScreen.js`, `LiveTrackingMap.js` | `[ ] Not Started` |
| **Phase 8** | 50m Arrival Gate, 4-Digit PIN Unlock & Time-Elapsed Billing | `functions/index.js`, `PinVerificationModal.js` | `[ ] Not Started` |
| **Phase 9** | End-to-End Mobile-to-Mobile QA & Dual-Mode Verification | `mobile/`, `tutors/`, `functions/` | `[ ] Not Started` |

---

## 3. End-to-End Mobile-to-Mobile Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Mobile App (mobile/)
    participant Functions as Firebase Cloud Functions
    participant Firestore as Firestore (Bookings & State)
    participant RTDB as Realtime Database (/live_tracking)
    actor Tutor as Tutor Mobile App (tutors/)
    participant NavSDK as Turn-by-Turn Navigation SDK

    Student->>Student: Chooses "In-Person", selects address & room notes
    Student->>Functions: submitClassRequest(mode: "in_person", location)
    Note over Functions: Computes R35 travel fee + standard pricing quote.<br/>Generates 4-digit PIN ("8492").
    Functions->>Firestore: Create request (status: "pending", mode: "in_person")
    
    Note over Functions,Tutor: Uncedo-Style Proximity Matching
    Functions->>Functions: Query online tutors within radius (sorted by distance)
    Functions->>Tutor: Push notification & offer modal with R35 travel fee
    Tutor->>Functions: acceptClassRequest(requestId)
    Functions->>Firestore: Status -> "accepted", assign tutor
    
    Note over Tutor,NavSDK,RTDB: Travel & Live GPS Streaming
    Tutor->>Firestore: Status -> "tutor_en_route"
    Tutor->>NavSDK: Start Turn-by-Turn Navigation to Student Destination
    loop Every 2-3s (Background / Foreground)
        NavSDK->>RTDB: Write telemetry to /live_tracking/{requestId}
        RTDB-->>Student: onValue() stream updates car marker & ETA
    end

    Note over Tutor,Student,Functions: 50m Arrival Gate & Session Unlock
    NavSDK->>Tutor: Proximity check: Distance <= 50m (Arrival Detected)
    Tutor->>Firestore: Status -> "tutor_arrived"
    Student-->>Tutor: Shares 4-digit PIN verbally ("8492")
    Tutor->>Functions: verifyStartSession(requestId, pin: "8492", tutorCoords)
    Note over Functions: Validates PIN AND verifies distance <= 50m.<br/>Sets billingStartedAt = Date.now().
    Functions->>Firestore: Status -> "in_session", starts time-elapsed counter
    Tutor->>NavSDK: Stop Navigation & RTDB GPS stream
    
    Note over Tutor,Student,Functions: Lesson & Final Settlement
    Tutor->>Functions: finalizeSessionClosure(sessionId)
    Note over Functions: Calculates final cost using exact pricingEngine.js:<br/>(Time-elapsed minutes * Rate) + R35 Travel Fee
    Functions->>Firestore: Status -> "completed", disburse payout
```

---

## 4. Phase-by-Phase Technical Specifications

---

### Phase 1: Realtime Database (RTDB) Telemetry Pipeline
* **Status**: `[ ] Not Started`
* **Objective**: Configure Firebase Realtime Database instance for sub-second location updates at `/live_tracking/{requestId}`.
* **Schema**:
  ```json
  {
    "live_tracking": {
      "REQ_98234_ABC": {
        "tutorId": "tutor_uid_123",
        "latitude": -26.192945,
        "longitude": 28.030512,
        "heading": 142.5,
        "speed": 11.2,
        "accuracy": 4.5,
        "distanceRemainingMeters": 1450,
        "etaSeconds": 320,
        "updatedAt": 1725184920123
      }
    }
  }
  ```
* **RTDB Security Rules (`database.rules.json`)**:
  ```json
  {
    "rules": {
      "live_tracking": {
        "$requestId": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
  ```

---

### Phase 2: In-Person Pricing Engine Gating & R35 Travel Fee
* **Status**: `[ ] Not Started`
* **Objective**: Reuse the existing [functions/pricingEngine.js](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js) engine with in-person arrival gating and flat R35 travel fee.
* **Exact Pricing Formula**:
  $$\text{TotalInPersonAmount} = \text{computeFinalAmountFromSnapshot}(\text{billedMinutes}, \text{rate}) + \text{R35.00 TravelFee}$$
* **Implementation Details in `functions/index.js`**:
  - `submitClassRequest`: If `mode === 'in_person'`, attach `travelFee: 35.00` to `pricingSnapshot` and `totalAmount = quoteAmount + 35.00`.
  - `finalizeSessionClosure`: Apply `computeFinalAmountFromSnapshot` for time elapsed (`billedMinutes`) and append `session.travelFee || 35.00` to the final settlement.
  - Tutor payout receives $80\%$ of lesson time fee $+ 100\%$ of the R35 travel fee.

---

### Phase 3: In-Person Matching & Allocation Engine (Uncedo Model)
* **Status**: `[ ] Not Started`
* **Objective**: Port the proximity-based helper allocation logic from the Uncedo codebase (`C:\Users\Jabu Babb\Documents\Code\Uncedo`).
* **Logic**:
  1. Calculate distance between student coordinates and active online tutors using Haversine formula:
     $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$
  2. Filter tutors who teach the requested subject and are within the max dispatch radius (e.g. 15 km).
  3. Sort by proximity $\rightarrow$ send 45-second offer to the closest qualified tutor.
  4. If declined or expired, cascade immediately to the next closest tutor.

---

### Phase 4: Student App - Mode Selector & Location Picker (`mobile/`)
* **Status**: `[ ] Not Started`
* **Objective**: Allow students to pick **Online** or **In-Person** when creating a request.
* **Target Files**:
  - [mobile/src/screens/student/DashboardScreen.js](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/DashboardScreen.js)
  - `mobile/src/components/maps/LocationPickerModal.js`
* **UI Features**:
  - Mode Pill Selector: **"Online Video Class"** vs **"In-Person Lesson"** (with "+ R35 travel fee" badge).
  - Google Places search autocomplete + draggable map pin.
  - Specific meeting instructions (e.g. *"Wits Science Library, 2nd floor desk 14"*).

---

### Phase 5: Tutor App - Navigation SDK & En-Route HUD (`tutors/`)
* **Status**: `[ ] Not Started`
* **Objective**: Full turn-by-turn visual and voice driving HUD in the Tutor Mobile App.
* **Target Files**:
  - `tutors/src/screens/navigation/TutorNavScreen.js`
  - `tutors/src/components/navigation/StudentMeetingInfoCard.js`
* **Features**:
  - Turn-by-turn voice prompts, traffic alerts, and route polyline.
  - Student meeting notes overlay and 1-tap call/message button.
  - Automatic 50m proximity listener triggering the arrival state.

---

### Phase 6: Tutor App - Background RTDB Telemetry Streamer (`tutors/`)
* **Status**: `[ ] Not Started`
* **Objective**: Background location service streaming GPS coordinates to RTDB `/live_tracking/{requestId}` every 2–3 seconds while tutor is traveling.
* **Target Files**:
  - `tutors/src/services/locationStreamService.js` (`expo-task-manager` + `expo-location`).
  - Auto-terminates as soon as the session status transitions to `in_session`.

---

### Phase 7: Student App - Live Map Tracking HUD & ETA Countdown (`mobile/`)
* **Status**: `[ ] Not Started`
* **Objective**: Real-time Bolt/Uber-style tracking screen for students.
* **Target Files**:
  - [mobile/src/screens/student/RequestStatusScreen.js](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/mobile/src/screens/student/RequestStatusScreen.js)
  - `mobile/src/components/maps/LiveTrackingMap.js`
  - `mobile/src/components/student/EnRouteStatusSheet.js`
* **Features**:
  - Listens to RTDB `/live_tracking/{requestId}` with smooth bearing interpolation.
  - Floating card displaying Tutor Profile, Live ETA countdown, R35 travel fee breakdown, and 4-digit Safety PIN ("Give this PIN to tutor upon arrival").

---

### Phase 8: 50m Arrival Gate, 4-Digit PIN Unlock & Time-Elapsed Billing
* **Status**: `[ ] Not Started`
* **Objective**: Secure physical session start using the 50-meter proximity gate and 4-digit PIN.
* **Target Files**:
  - `functions/index.js` (`verifyStartSession`)
  - `tutors/src/components/PinVerificationModal.js`
* **Logic**:
  1. Tutor arrives at student location ($\Delta \le 50\text{m}$).
  2. Tutor enters the 4-digit PIN provided verbally by the student.
  3. Server validates PIN and verifies tutor coordinates $\le 50\text{m}$ from student location.
  4. Server sets `billingStartedAt = Date.now()` and status to `in_session`.
  5. Identical time-elapsed counter runs until session is completed.

---

### Phase 9: End-to-End Mobile-to-Mobile Testing & Dual-Mode Verification
* **Status**: `[ ] Not Started`
* **Objective**: Verify that Online lessons and In-Person lessons operate independently without conflicts.
* **Verification Checklist**:
  - Online lesson creates WebRTC room and gates billing on peer connection.
  - In-person lesson launches Navigation SDK, streams to RTDB, and gates billing on 50m proximity + PIN.
  - Final settlement computes time-elapsed rate identically + adds R35 travel fee for in-person.
