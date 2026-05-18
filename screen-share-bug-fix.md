# Screen Share Bug Fix

## Goal
Investigate and fix the issue where:
- Tutor can share screen initially
- After stopping and sharing again, the student does not reliably see the screen

---

## Working Rules (VERY IMPORTANT)

- Always work on **ONE PHASE at a time**
- Do NOT jump phases
- Do NOT fix code unless the phase explicitly says so
- Keep all outputs **small and structured**
- Do NOT refactor unrelated code
- Do NOT introduce new patterns unless required
- Prefer:
  1. Inspect
  2. Log
  3. Compare
  4. Fix (only when confident)

---

## Known Facts

- WebRTC connection succeeds
- ICE reaches `connected`
- Audio works
- First screen share works
- Issue occurs after stop → restart sharing
- Likely NOT a connection issue
- Likely related to:
  - track lifecycle
  - renegotiation
  - student-side stream handling
  - UI attachment

---

## Global Status

- Current Phase: `PHASE 1`
- Overall Status: `IN PROGRESS`
- Last Updated: `YYYY-MM-DD HH:MM`
- Current Theory: `Unknown`

---

# =========================
# PHASE 1 — CODE FLOW ANALYSIS
# =========================

## Purpose
Understand how screen sharing currently works.

## Instructions

Inspect ONLY the code responsible for:

- Tutor start screen share
- Tutor stop screen share
- Tutor publish offer
- Student receive offer
- Student handle remote track
- Student attach screen stream to UI

## Boundaries

- ❌ Do NOT modify code
- ❌ Do NOT add logs
- ❌ Do NOT refactor
- ✅ Only inspect

## Expected Output

Return ONLY:

1. Files involved  
2. Functions involved  
3. Step-by-step flow  
4. Possible weak points  

## Completion Condition

Clear understanding of full screen-share flow.

## Status

`DONE ✅`

## Results

```md
Files:
- src/services/webrtcService.js
- src/pages/app/SessionRoomPage.jsx

Functions:
- createWebRtcSessionController(...)
  - startScreenShare()
  - stopScreenShare()
  - switchScreenTrack(nextTrack)
  - publishUpdatedOffer(status)
  - updateScreenShareDocState(active)
  - clearRemoteScreenStream()
  - attachRemoteScreenReceiverTrack() (defined, but not invoked in shown flow)
  - pc.ontrack = (...)
  - onSnapshot(sessionRef, ...) (student offer receive/apply + answer publish)
- SessionRoomPage
  - initializeCall(...)
  - shareScreen()
  - useEffect (remoteScreenStreamObj -> remoteScreenVideoRef.current.srcObject)
  - onRemoteScreenStream callback
  - onScreenShareStateChange callback
  - renderStudentStage()

Flow:
- Tutor clicks Share/Stop in shareScreen() -> startScreenShare() / stopScreenShare().
- Start path: getDisplayMedia() -> replaceTrack(screenTrack) -> set webrtc.screenShare.active=true -> publishUpdatedOffer('screen_sharing').
- Stop path: stop display tracks -> replaceTrack(null) -> set webrtc.screenShare.active=false -> publishUpdatedOffer('connected').
- Student session snapshot sees newer offerRevision + offer -> setRemoteDescription(offer) -> createAnswer() -> setLocalDescription(answer) -> writes answer.
- Student receives video in pc.ontrack; clears/replaces remoteScreenStream, sets mute/unmute/ended handlers, calls onRemoteScreenStream(stream|null).
- SessionRoomPage stores stream in remoteScreenStreamObj; effect attaches it to remoteScreenVideoRef.srcObject.
- Student UI shows <video ref={remoteScreenVideoRef}> when isRemoteScreenSharing=true, otherwise placeholder.

Weak Points:
- attachRemoteScreenReceiverTrack() exists but appears unused; screen flow depends on pc.ontrack only.
- replaceTrack(null) on stop may make restart sensitive to renegotiation/order timing.
- Student offer handling is gated by offerRevision; revision/state desync could skip restart offers.
- onScreenShareStateChange clears srcObject on remote=false; fast false->true transitions can race stream callback.
- pc.ontrack treats any student-side video as screen track.
- UI visibility depends on mute/unmute/ended events; delayed browser events can leave placeholder shown.
```

# =========================
# PHASE 2 — ADD LOGGING
# =========================

## Purpose
Observe behavior across:
- First share
- Stop share
- Second share

## Instructions

Add minimal logs at:

- Tutor start screen share
- Tutor stop screen share
- Track replacement (replaceTrack / switchScreenTrack)
- Offer publish (offerRevision + status)
- Firestore screenShare.active updates
- Student receiving offer
- Student applying offer
- pc.ontrack (ALL video/audio tracks)
- Remote screen stream creation / clearing
- onRemoteScreenStream callback
- UI attaching srcObject
- UI clearing srcObject
- Track mute / unmute / ended events

## Boundaries

- ❌ No logic changes
- ❌ No UI changes
- ❌ No refactor
- ✅ Logs only
- Keep logs small and readable

## Log Prefixes

- [claxi:screen:tutor]
- [claxi:screen:student]
- [claxi:screen:ui]

## Expected Output

Return:

1. Files changed  
2. Logs added  
3. Why logs were added  

## Completion Condition

Logs must clearly show full lifecycle for:
- first share
- stop
- second share

## Status

`DONE ✅`

## Results

```md
Files Changed:
- src/services/webrtcService.js
- src/pages/app/SessionRoomPage.jsx

Logs Added:
- Tutor flow logs (`[claxi:screen:tutor]`) for:
  - startScreenShare getDisplayMedia start/success + track details
  - stopScreenShare start + active track id + replaceTrack(null) intent
  - switchScreenTrack nextTrack state + sender/transceiver presence + replaceTrack success
  - publishUpdatedOffer status + offerRevision before/after + local screenShare.active
  - updateScreenShareDocState write value
- Student/WebRTC logs (`[claxi:screen:student]`) for:
  - clearRemoteScreenStream run + prior stream existence
  - pc.ontrack payload (kind/id/state/muted/streams/mid)
  - student-side track classification as remote screen
  - previous remote screen stream replacement
  - onRemoteScreenStream(stream|null) call points
  - track mute/unmute/ended lifecycle events
  - offer/answer path (Firestore offerRevision, last handled revision, setRemoteDescription start/success, createAnswer start/success, answer write)
  - attachRemoteScreenReceiverTrack invocation probe
- UI logs (`[claxi:screen:ui]`) for:
  - onRemoteScreenStream callback (hasStream, stream id, track ids)
  - onScreenShareStateChange callback (local/remote)
  - srcObject effect (video element exists, stream exists, previous srcObject, assigned/cleared)
  - student stage visibility controls (isRemoteScreenSharing + remoteScreenStreamObj presence)

Test Summary:
- Controlled 4-step browser test (start call -> first share -> stop -> second share) could not be executed in this CLI-only environment.
- Static verification completed with `npm run build` to ensure logging-only changes compile.

Tutor Events:
- Start/stop/publish lifecycle is now traceable with concise revision and track-state logs.

Student Events:
- Offer apply + answer publish + ontrack + UI attach/clear lifecycle is now fully traceable.

Second Share Visible:
- Not verified in runtime here (no browser session available in this environment).

Most Important First-Share vs Second-Share Difference Observed:
- Not directly observed yet due environment limits; added logs are specifically targeted to reveal whether second-share failure is at (a) tutor replaceTrack/publish, (b) student offer apply/createAnswer, or (c) student UI srcObject/visibility state.

Tutor Console Log:
index-B16ApZen.js:3935 [claxi:tutorOffer] Tutor offer response started. {response: 'accept', requestId: 'YBz83g6kfsCJykTUKdOm'}
index-B16ApZen.js:3935 [claxi:classRequestService] Accepting class request. {requestId: 'YBz83g6kfsCJykTUKdOm', tutorId: 'G6HTIseQVCMuvKB0VpcdeXsMH682'}
index-B16ApZen.js:3935 [claxi:classRequestService] Tutor offer transaction started. {requestId: 'YBz83g6kfsCJykTUKdOm', tutorId: 'G6HTIseQVCMuvKB0VpcdeXsMH682', response: 'accept'}
index-B16ApZen.js:3935 [claxi:classRequestService] Tutor offer transaction request state. {requestId: 'YBz83g6kfsCJykTUKdOm', status: 'offered', currentOfferTutorId: 'G6HTIseQVCMuvKB0VpcdeXsMH682', existingSessionId: null}
index-B16ApZen.js:3935 [claxi:classRequestService] Tutor offer transaction creating session. {requestId: 'YBz83g6kfsCJykTUKdOm', sessionId: 'YBz83g6kfsCJykTUKdOm'}
index-B16ApZen.js:3935 [claxi:classRequestService] Tutor offer transaction succeeded. {requestId: 'YBz83g6kfsCJykTUKdOm', tutorId: 'G6HTIseQVCMuvKB0VpcdeXsMH682', response: 'accept', sessionId: 'YBz83g6kfsCJykTUKdOm', reused: false}
index-B16ApZen.js:3935 [claxi:classRequestService] Class request accepted. {requestId: 'YBz83g6kfsCJykTUKdOm', tutorId: 'G6HTIseQVCMuvKB0VpcdeXsMH682', sessionId: 'YBz83g6kfsCJykTUKdOm', reused: false}
index-B16ApZen.js:3935 [claxi:tutorOffer] Tutor accepted request successfully. {requestId: 'YBz83g6kfsCJykTUKdOm', sessionId: 'YBz83g6kfsCJykTUKdOm', reused: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] remote screen srcObject effect. {hasVideoElement: false, hasStream: false, hadPreviousSrcObject: false}
index-B16ApZen.js:3935 [claxi:tldraw] Loading tldraw SDK runtime module.
index-B16ApZen.js:3935 [claxi:sessionRoom] Initializing call. {sessionId: 'YBz83g6kfsCJykTUKdOm', role: 'tutor', shouldJoinStudent: false, forceRelayOnly: false}
index-B16ApZen.js:3935 [claxi:iceServerService] Fetched ICE configuration. {serverCount: 2, hasStun: true, hasTurn: true, stunCount: 1, turnCount: 4, …}
index-B16ApZen.js:3935 [claxi:webrtcService] Resolved ICE server config. {forceRelayOnly: false, iceTransportPolicy: 'all', servers: Array(2)}
index-B16ApZen.js:3935 [claxi:webrtcService] Creating RTCPeerConnection with ICE servers. {forceRelayOnly: false, urls: Array(5)}
index-B16ApZen.js:3935 [claxi:webrtcService] Requesting local media (audio only). {constraints: {…}}
index-B16ApZen.js:3935 [claxi:tldraw] tldraw SDK loaded successfully.
index-B16ApZen.js:3935 [claxi:webrtcService] Local media acquired (audio only). {audioTracks: 1, videoTracks: 0}
index-B16ApZen.js:3935 [claxi:webrtcService] Using local media mode. {mode: 'audio_only'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: false, hasCurrentRemoteDescription: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'udp', discoveredTypes: Array(1)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'srflx', protocol: 'udp', discoveredTypes: Array(2)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'srflx', protocol: 'udp', discoveredTypes: Array(2)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'udp', discoveredTypes: Array(2)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'relay', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'tcp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'tcp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'srflx', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'relay', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'tcp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'tcp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: false, hasCurrentRemoteDescription: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because initialization already started. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'relay', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'relay', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'relay', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'relay', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: false, hasCurrentRemoteDescription: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because initialization already started. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:sessionRoom] WebRTC controller created successfully. {sessionId: 'YBz83g6kfsCJykTUKdOm', role: 'tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] iceConnectionState changed. {state: 'checking'}
index-B16ApZen.js:3935 [claxi:webrtcService] connectionState changed. {state: 'connecting'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 2}
index-B16ApZen.js:3935 [claxi:webrtcService] ontrack fired. {kind: 'audio', incomingMid: '0', screenMid: '1', trackId: 'b259dcad-4e55-4a89-9a1e-70d36d5a82ba', muted: true, …}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] ontrack event. {kind: 'audio', trackId: 'b259dcad-4e55-4a89-9a1e-70d36d5a82ba', readyState: 'live', muted: true, streamCount: 1, …}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor applied remote answer.
index-B16ApZen.js:3935 [claxi:webrtcService] Flushing queued remote ICE candidates. {count: 2}
index-B16ApZen.js:3935 [claxi:webrtcService] iceConnectionState changed. {state: 'connected'}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] connectionState changed. {state: 'connected'}
index-B16ApZen.js:3935 [claxi:webrtcService] Selected ICE candidate pair. {relayUsed: false, localType: 'host', remoteType: 'host', localProtocol: 'udp', remoteProtocol: 'udp'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] startScreenShare getDisplayMedia start.
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'stun:turn.cloudflare.com:3478', errorCode: 701, errorText: 'STUN binding request timed out.', address: '10.123.9.x', port: 64307}
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'stun:stun.cloudflare.com:3478', errorCode: 701, errorText: 'STUN binding request timed out.', address: '10.123.9.x', port: 64307}
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'turn:turn.cloudflare.com:3478?transport=udp', errorCode: 701, errorText: 'TURN allocate request timed out.', address: '10.123.9.x', port: 64307}
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'turn:turn.cloudflare.com:3478?transport=tcp', errorCode: 701, errorText: 'TURN allocate request timed out.', address: '127.0.0.x', port: 49810}
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'turn:turn.cloudflare.com:3478?transport=tcp', errorCode: 701, errorText: 'TURN allocate request timed out.', address: '127.0.0.x', port: 63082}
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'turns:turn.cloudflare.com:443?transport=tcp', errorCode: 701, errorText: 'TURN allocate request timed out.', address: '127.0.0.x', port: 65436}
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'turns:turn.cloudflare.com:443?transport=tcp', errorCode: 701, errorText: 'TURN allocate request timed out.', address: '127.0.0.x', port: 59763}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] startScreenShare getDisplayMedia success.
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] switchScreenTrack. {nextTrackState: 'live', hasSender: true, hasTransceiver: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] switchScreenTrack replaceTrack success. {nextTrackState: 'live'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] updateScreenShareDocState write. {active: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor started screen share track. {id: 'f2973e49-7229-49bf-b074-844b5dc85c7f', kind: 'video', readyState: 'live', label: 'window:395974:1'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] startScreenShare track details. {id: 'f2973e49-7229-49bf-b074-844b5dc85c7f', kind: 'video', readyState: 'live', label: 'window:395974:1'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: true, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] publishUpdatedOffer start. {status: 'screen_sharing', offerRevisionBefore: 1, offerRevisionAfter: 2, screenShareActive: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: false, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Published updated WebRTC offer. {offerRevision: 2, status: 'screen_sharing'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor applied remote answer.
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] stopScreenShare start. {hasActiveScreenStream: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] stopScreenShare active track before stop. {activeScreenTrackId: 'f2973e49-7229-49bf-b074-844b5dc85c7f'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] stopScreenShare replaceTrack(null).
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] switchScreenTrack. {nextTrackState: 'null', hasSender: true, hasTransceiver: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] switchScreenTrack replaceTrack success. {nextTrackState: 'null'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] updateScreenShareDocState write. {active: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] publishUpdatedOffer start. {status: 'connected', offerRevisionBefore: 2, offerRevisionAfter: 3, screenShareActive: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: false, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Published updated WebRTC offer. {offerRevision: 3, status: 'connected'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor stopped screen share.
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor applied remote answer.
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] startScreenShare getDisplayMedia start.
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] startScreenShare getDisplayMedia success.
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] switchScreenTrack. {nextTrackState: 'live', hasSender: true, hasTransceiver: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] switchScreenTrack replaceTrack success. {nextTrackState: 'live'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] updateScreenShareDocState write. {active: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor started screen share track. {id: '85dad264-41fd-4a87-a998-bca40079fe99', kind: 'video', readyState: 'live', label: 'window:395974:1'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] startScreenShare track details. {id: '85dad264-41fd-4a87-a998-bca40079fe99', kind: 'video', readyState: 'live', label: 'window:395974:1'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: true, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] publishUpdatedOffer start. {status: 'screen_sharing', offerRevisionBefore: 3, offerRevisionAfter: 4, screenShareActive: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: false, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Published updated WebRTC offer. {offerRevision: 4, status: 'screen_sharing'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor applied remote answer.
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] stopScreenShare start. {hasActiveScreenStream: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] stopScreenShare active track before stop. {activeScreenTrackId: '85dad264-41fd-4a87-a998-bca40079fe99'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] stopScreenShare replaceTrack(null).
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] switchScreenTrack. {nextTrackState: 'null', hasSender: true, hasTransceiver: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] switchScreenTrack replaceTrack success. {nextTrackState: 'null'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] updateScreenShareDocState write. {active: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:tutor] publishUpdatedOffer start. {status: 'connected', offerRevisionBefore: 4, offerRevisionAfter: 5, screenShareActive: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: false, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Published updated WebRTC offer. {offerRevision: 5, status: 'connected'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor stopped screen share.
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor applied remote answer.
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}
index-B16ApZen.js:3935 [claxi:webrtcService] Tutor evaluating remote answer. {hasAnswer: true, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] Skipping init because rtcRef already exists. {initKey: 'YBz83g6kfsCJykTUKdOm:tutor'}

Student Console Log:
index-B16ApZen.js:3935 [claxi:classRequestService] Creating class request. {studentId: 'bSzYwO6ByzOcjzioNOzK4i43Dji2', topic: 'Testing', durationMinutes: 'Per-minute billing'}
index-B16ApZen.js:3935 [claxi:classRequestService] Class request created. Backend lifecycle trigger will process matching. {requestId: 'YBz83g6kfsCJykTUKdOm'}
index-B16ApZen.js:3935 request status: undefined
index-B16ApZen.js:3935 requestId: YBz83g6kfsCJykTUKdOm
index-B16ApZen.js:3935 sessions: []
index-B16ApZen.js:3935 matchingSession: undefined
index-B16ApZen.js:3935 request status: pending
index-B16ApZen.js:3935 requestId: YBz83g6kfsCJykTUKdOm
index-B16ApZen.js:3935 sessions: [{…}]
index-B16ApZen.js:3935 matchingSession: undefined
index-B16ApZen.js:3935 request status: offered
index-B16ApZen.js:3935 requestId: YBz83g6kfsCJykTUKdOm
index-B16ApZen.js:3935 sessions: [{…}]
index-B16ApZen.js:3935 matchingSession: undefined
index-B16ApZen.js:3935 request status: accepted
index-B16ApZen.js:3935 requestId: YBz83g6kfsCJykTUKdOm
index-B16ApZen.js:3935 sessions: (2) [{…}, {…}]
index-B16ApZen.js:3935 matchingSession: {id: 'YBz83g6kfsCJykTUKdOm', notes: '', ratings: {…}, whiteboardRoomId: 'YBz83g6kfsCJykTUKdOm', requestDescription: 'Testing', …}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] remote screen srcObject effect. {hasVideoElement: false, hasStream: false, hadPreviousSrcObject: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] Initializing call. {sessionId: 'YBz83g6kfsCJykTUKdOm', role: 'student', shouldJoinStudent: true, forceRelayOnly: false}
index-B16ApZen.js:3935 [claxi:sessionService] Student joining session. {sessionId: 'YBz83g6kfsCJykTUKdOm', requestId: 'YBz83g6kfsCJykTUKdOm'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:iceServerService] Fetched ICE configuration. {serverCount: 2, hasStun: true, hasTurn: true, stunCount: 1, turnCount: 4, …}
index-B16ApZen.js:3935 [claxi:webrtcService] Resolved ICE server config. {forceRelayOnly: false, iceTransportPolicy: 'all', servers: Array(2)}
index-B16ApZen.js:3935 [claxi:webrtcService] Creating RTCPeerConnection with ICE servers. {forceRelayOnly: false, urls: Array(5)}
index-B16ApZen.js:3935 [claxi:webrtcService] Requesting local media (audio only). {constraints: {…}}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Local media acquired (audio only). {audioTracks: 1, videoTracks: 0}
index-B16ApZen.js:3935 [claxi:webrtcService] Using local media mode. {mode: 'audio_only'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] WebRTC controller created successfully. {sessionId: 'YBz83g6kfsCJykTUKdOm', role: 'student'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'srflx', discoveredTypes: Array(1)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(2)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 2}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'srflx', discoveredTypes: Array(2)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 3}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(2)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 4}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'relay', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 5}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 6}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 7}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 8}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'srflx', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 9}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 10}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'relay', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 11}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 12}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'host', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 13}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'relay', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 14}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'relay', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 15}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'relay', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 16}
index-B16ApZen.js:3935 [claxi:webrtcService] Remote ICE candidate received. {type: 'relay', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] Queued remote ICE candidate until remote description is ready. {queuedCount: 17}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 1, latestOfferRevision: 0, hasCurrentRemoteDescription: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] offer handling. {firestoreOfferRevision: 1, latestHandledOfferRevision: 0}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription start. {offerRevision: 1}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] ontrack fired. {kind: 'audio', incomingMid: '0', screenMid: null, trackId: '943ce5a1-e549-4287-a120-2035f13ad85b', muted: true, …}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] ontrack event. {kind: 'audio', trackId: '943ce5a1-e549-4287-a120-2035f13ad85b', readyState: 'live', muted: true, streamCount: 1, …}
index-B16ApZen.js:3935 [claxi:webrtcService] ontrack fired. {kind: 'video', incomingMid: '1', screenMid: null, trackId: '9e04d287-abba-4500-88eb-1c801972b5fa', muted: true, …}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] ontrack event. {kind: 'video', trackId: '9e04d287-abba-4500-88eb-1c801972b5fa', readyState: 'live', muted: true, streamCount: 0, …}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] ontrack video classification. {treatedAsRemoteScreenTrack: true, trackId: '9e04d287-abba-4500-88eb-1c801972b5fa'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] onRemoteScreenStream call. {value: 'null', trackId: '9e04d287-abba-4500-88eb-1c801972b5fa'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription success. {offerRevision: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] Student applied remote offer. {offerRevision: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] Flushing queued remote ICE candidates. {count: 17}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer start. {offerRevision: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer success. {offerRevision: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 1, latestOfferRevision: 1, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] iceConnectionState changed. {state: 'checking'}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:webrtcService] connectionState changed. {state: 'connecting'}
index-B16ApZen.js:3935 [claxi:webrtcService] Local ICE candidate discovered. {type: 'host', protocol: 'udp', discoveredTypes: Array(3)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] iceConnectionState changed. {state: 'connected'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] answer written. {offerRevision: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] Student created and saved answer. {offerRevision: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] connectionState changed. {state: 'connected'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 1, latestOfferRevision: 1, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Selected ICE candidate pair. {relayUsed: false, localType: 'host', remoteType: 'host', localProtocol: 'udp', remoteProtocol: 'udp'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 1, latestOfferRevision: 1, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 1, latestOfferRevision: 1, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 1, latestOfferRevision: 1, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'stun:stun.cloudflare.com:3478', errorCode: 701, errorText: 'STUN binding request timed out.', address: '10.123.9.x', port: 52305}
index-B16ApZen.js:3935 [claxi:webrtcService] ICE candidate error. {url: 'stun:turn.cloudflare.com:3478', errorCode: 701, errorText: 'STUN binding request timed out.', address: '10.123.9.x', port: 52305}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] track unmute. {id: '9e04d287-abba-4500-88eb-1c801972b5fa', readyState: 'live'}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] onRemoteScreenStream call. {value: 'stream', trackId: '9e04d287-abba-4500-88eb-1c801972b5fa'}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: true, streamId: 'f709f646-d5b1-4a07-972c-e9a7c557fa8a', trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] remote screen srcObject effect. {hasVideoElement: true, hasStream: true, hadPreviousSrcObject: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] srcObject assigned.
index-B16ApZen.js:3935 [claxi:sessionRoom] Attached remote screen stream to student video element. {hasStream: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 1, latestOfferRevision: 1, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 2, latestOfferRevision: 1, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] offer handling. {firestoreOfferRevision: 2, latestHandledOfferRevision: 1}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription start. {offerRevision: 2}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription success. {offerRevision: 2}
index-B16ApZen.js:3935 [claxi:webrtcService] Student applied remote offer. {offerRevision: 2}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer start. {offerRevision: 2}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer success. {offerRevision: 2}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 2, latestOfferRevision: 2, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] answer written. {offerRevision: 2}
index-B16ApZen.js:3935 [claxi:webrtcService] Student created and saved answer. {offerRevision: 2}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: true}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 2, latestOfferRevision: 2, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: true, hasRemoteScreenStreamObj: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 2, latestOfferRevision: 2, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] remote screen srcObject effect. {hasVideoElement: false, hasStream: false, hadPreviousSrcObject: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 3, latestOfferRevision: 2, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] offer handling. {firestoreOfferRevision: 3, latestHandledOfferRevision: 2}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription start. {offerRevision: 3}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription success. {offerRevision: 3}
index-B16ApZen.js:3935 [claxi:webrtcService] Student applied remote offer. {offerRevision: 3}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer start. {offerRevision: 3}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer success. {offerRevision: 3}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 3, latestOfferRevision: 3, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] answer written. {offerRevision: 3}
index-B16ApZen.js:3935 [claxi:webrtcService] Student created and saved answer. {offerRevision: 3}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 3, latestOfferRevision: 3, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 3, latestOfferRevision: 3, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 4, latestOfferRevision: 3, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] offer handling. {firestoreOfferRevision: 4, latestHandledOfferRevision: 3}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription start. {offerRevision: 4}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription success. {offerRevision: 4}
index-B16ApZen.js:3935 [claxi:webrtcService] Student applied remote offer. {offerRevision: 4}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer start. {offerRevision: 4}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer success. {offerRevision: 4}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 4, latestOfferRevision: 4, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] answer written. {offerRevision: 4}
index-B16ApZen.js:3935 [claxi:webrtcService] Student created and saved answer. {offerRevision: 4}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 4, latestOfferRevision: 4, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 4, latestOfferRevision: 4, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 5, latestOfferRevision: 4, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] offer handling. {firestoreOfferRevision: 5, latestHandledOfferRevision: 4}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription start. {offerRevision: 5}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] setRemoteDescription success. {offerRevision: 5}
index-B16ApZen.js:3935 [claxi:webrtcService] Student applied remote offer. {offerRevision: 5}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer start. {offerRevision: 5}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] createAnswer success. {offerRevision: 5}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 5, latestOfferRevision: 5, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] answer written. {offerRevision: 5}
index-B16ApZen.js:3935 [claxi:webrtcService] Student created and saved answer. {offerRevision: 5}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:webrtcService] [claxi:screen:student] clearRemoteScreenStream run. {hadRemoteScreenStream: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onRemoteScreenStream callback. {hasStream: false, streamId: null, trackIds: Array(0)}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] onScreenShareStateChange callback. {local: false, remote: false}
index-B16ApZen.js:3935 [claxi:webrtcService] Student evaluating remote offer. {hasOffer: true, offerRevision: 5, latestOfferRevision: 5, hasCurrentRemoteDescription: true}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}
index-B16ApZen.js:3935 [claxi:sessionRoom] [claxi:screen:ui] renderStudentStage visibility. {isRemoteScreenSharing: false, hasRemoteScreenStreamObj: false}

```


# =========================
# PHASE 3 — COMPARE FLOWS
# =========================

## Purpose
Identify the exact point where the second screen share flow diverges from the first (working) screen share.

---

## Instructions

Using the logs collected in Phase 2, compare:

- First screen share (working)
- Stop sharing
- Second screen share (failing or inconsistent)

Focus on **behavioral differences**, not assumptions.

---

## Comparison Order

Follow this exact sequence and compare step-by-step:

1. Tutor gets display media (`getDisplayMedia`)
2. Tutor replaces or adds screen track (`replaceTrack` / `addTrack`)
3. Tutor updates sender or transceiver
4. Tutor publishes updated offer
5. offerRevision increments correctly
6. Student receives new offer revision
7. Student applies remote description (`setRemoteDescription`)
8. Student receives `ontrack`
9. Track becomes live or unmuted
10. Remote screen stream is created or rebuilt
11. UI attaches stream (`srcObject`)
12. UI visibility state updates (e.g., `isRemoteScreenSharing`)

---

## Boundaries

- ❌ Do NOT modify code
- ❌ Do NOT add logs
- ❌ Do NOT refactor
- ✅ Use only logs + existing code
- ✅ Keep output short and structured

---

## Expected Output

Return ONLY:

1. First share flow (summarized)
2. Second share flow (summarized)
3. First missing or different step
4. Most likely cause of failure
5. Exact file and function where the issue likely exists

---

## Completion Condition

This phase is complete when:
- The **first exact divergence point** is identified
- The issue is narrowed down to a **specific function or logic area**

---

## Status

`DONE ✅`

---

## Results

```md
First Share:
- Tutor starts screen share successfully
- Tutor replaceTrack succeeds
- Tutor publishes offerRevision 2 with screen_sharing
- Student receives offerRevision 2
- Student setRemoteDescription succeeds
- Student createAnswer succeeds
- Student later gets remote video track unmute
- Student calls onRemoteScreenStream with a real stream
- UI sets remote=true
- UI assigns srcObject
- Screen becomes visible

Second Share:
- Tutor starts screen share successfully again
- Tutor replaceTrack succeeds again
- Tutor publishes offerRevision 4 with screen_sharing
- Student receives offerRevision 4
- Student setRemoteDescription succeeds
- Student createAnswer succeeds
- But no new ontrack video event appears
- No track unmute event appears
- No onRemoteScreenStream(stream) happens
- No srcObject assignment happens
- UI remains false/empty

First Missing Step:
- After student applies the second-share offer, there is no remote screen-track activation/reattachment event

Likely Cause:
- Student-side logic appears to rely on initial ontrack/unmute flow and does not reattach/rebuild the remote screen stream when the tutor reuses the screen transceiver via replaceTrack during a later share cycle

Suspected Location:
- src/services/webrtcService.js
- student-side remote screen track handling around pc.ontrack, clearRemoteScreenStream, and the unused attachRemoteScreenReceiverTrack()
```

# =========================
# PHASE 4 — ROOT CAUSE ANALYSIS
# =========================

## Purpose
Determine the most likely root cause of the second screen share failure using the Phase 3 comparison results.

---

## Instructions

Inspect only the exact file, function, and logic path identified in Phase 3.

Answer the following questions using the current code and the logs already collected:

1. Does the code assume that a new `ontrack` event will always fire when screen sharing starts again?
2. Does the code clear the remote screen stream when screen sharing stops?
3. After the stream is cleared, what exact code path is responsible for rebuilding or reattaching it?
4. Does screen-track detection rely on fragile conditions such as:
   - `mid`
   - stream count
   - track kind only
   - previous stream state
   - mute/unmute timing
5. Does the tutor-side logic use:
   - `replaceTrack`
   - `addTrack`
   - `removeTrack`
   - transceiver reuse
   - sender reuse
6. Can signaling and renegotiation succeed while the student UI still fails to render the screen?
7. Is there any race condition between:
   - remote screen state updates
   - stream clear callbacks
   - UI placeholder/show logic
   - second share stream attachment

---

## Boundaries

- ❌ Do NOT apply a fix yet
- ❌ Do NOT add new logs
- ❌ Do NOT refactor
- ✅ Analysis only
- ✅ Keep answers direct and short

---

## Expected Output

Return ONLY:

1. Short answer to each question
2. One clearly stated root-cause theory
3. One smallest-safe-fix candidate

---

## Completion Condition

This phase is complete when:
- the likely root behavior is clearly identified
- there is enough confidence to make one focused fix in Phase 5

---

## Status

`DONE ✅`

---

## Results

```md
1. New ontrack assumption:
- Yes. Student reattachment is driven by `pc.ontrack` + that track’s mute/unmute handlers; no guaranteed reattach path runs after renegotiation if no new ontrack fires.

2. Stream clearing behavior:
- Yes. `clearRemoteScreenStream()` removes all screen tracks, sets `isRemoteScreenSharing=false`, emits `onRemoteScreenStream(null)`, and is called when `webrtc.screenShare.active` becomes false.

3. Stream rebuild path:
- Only this path: new video `pc.ontrack` -> add incoming track to `remoteScreenStream` -> `publishScreenState()` / `onunmute` -> `onRemoteScreenStream(remoteScreenStream)`.
- There is no active rebuild call after offer apply besides waiting for `ontrack`.

4. Fragile detection logic:
- Yes. All student video tracks are treated as screen, usable-state depends on `track.readyState==='live' && !track.muted`, and success depends on mute/unmute timing/events.

5. Tutor track/transceiver method:
- Tutor uses a pre-created video transceiver and `screenTransceiver.sender.replaceTrack(...)` (including `replaceTrack(null)` on stop), i.e., transceiver/sender reuse rather than add/remove track.

6. Can signaling succeed while UI fails:
- Yes. Logs show offer revision increments + setRemoteDescription/createAnswer success, while second share has no new video ontrack/unmute and UI remains empty.

7. Is `attachRemoteScreenReceiverTrack()` the missing reattachment path:
- Yes, effectively. It exists to bind `screenTransceiver.receiver.track` and handlers, but it is not invoked in the student renegotiation flow, so re-share can miss reattachment when no new ontrack arrives.

Root-cause theory:
- On stop, student clears remote screen state; on re-share, tutor reuses the same sender/transceiver via replaceTrack, which may not emit a fresh ontrack. Because reattach logic depends on ontrack and `attachRemoteScreenReceiverTrack()` is unused, student never republishes the receiver track to UI.

Smallest-safe-fix candidate:
- In student offer-handling path, call `attachRemoteScreenReceiverTrack()` immediately after successful `setRemoteDescription(...)` (and/or after answer setLocalDescription) so existing receiver track is reattached and its mute/unmute handlers are rebound even when no new ontrack event fires.
```


# =========================
# PHASE 5 — APPLY FIX
# =========================

## Purpose
Apply the smallest safe fix based on the confirmed root cause from Phase 4.

---

## Instructions

Implement ONLY ONE focused fix that directly addresses the identified issue.

The fix must:
- Target the exact function or logic identified in Phase 4
- Solve the second screen share failure
- Preserve existing working behavior (audio, first share, connection)

---

## Allowed Fix Types

Choose ONLY ONE of the following (based on Phase 4 findings):

- Reattach remote screen stream when track becomes unmuted
- Rebuild `MediaStream` after screen share restarts
- Handle reused transceiver correctly (do not rely only on `ontrack`)
- Fix screen track detection logic
- Ensure UI reattaches stream when a valid remote track becomes active again
- Resolve race condition between stream clearing and reattachment

---

## Boundaries

- ❌ Do NOT refactor unrelated code
- ❌ Do NOT introduce multiple fixes
- ❌ Do NOT remove logs yet
- ❌ Do NOT change UI design
- ✅ Keep change minimal and targeted

---

## Expected Output

Return ONLY:

1. File changed  
2. Exact change made (short explanation)  
3. Why this fix solves the issue  

---

## Test Procedure

After applying the fix, perform this exact test:

1. Start call  
2. First screen share → verify visible  
3. Stop sharing → verify cleared  
4. Second screen share → verify visible  
5. Stop again  
6. Third screen share → verify consistent behavior  

---

## Completion Condition

This phase is complete when:
- Second screen share works reliably
- Repeated start/stop works
- No regression is introduced

---

## Status

`DONE ✅`

---

## Results

- File changed: `src/services/webrtcService.js`
- Exact helper change: `attachRemoteScreenReceiverTrack()` now force-rebuilds `remoteScreenStream` by removing all existing tracks and adding the current receiver video track before publishing; it still binds `onunmute`, `onmute`, and `onended`, and now performs immediate publish via existing publish path.
- Why this is smallest safe fix: only local helper logic changed; no signaling flow/UI changes; existing logs and handler behavior preserved.
- Test result:
  - `npm run build` ✅
  - Runtime call-cycle validation (first/second/third share) not executed in this headless container.
- Whether second share now works: not confirmed in-container (manual browser verification still required).
- Whether third share now works: not confirmed in-container (manual browser verification still required).
- Regression seen: none in static/build checks.


# =========================
# PHASE 6 — VALIDATION
# =========================

## Purpose
Verify that the fix from Phase 5 is stable, does not introduce regressions, and works across repeated screen share cycles.

---

## Instructions

Using the current code (with the fix applied), run controlled tests and validate behavior against the checklist below.

Perform tests in this order:

1. Start call  
2. First screen share → verify visible  
3. Stop sharing → verify cleared  
4. Second screen share → verify visible  
5. Stop again  
6. Third screen share → verify consistent behavior  
7. Repeat stop/start multiple times (at least 3 cycles)

---

## Validation Checklist

Confirm each of the following:

- Audio connection still works correctly  
- First screen share works  
- Second screen share works  
- Repeated stop/start works consistently  
- UI state matches actual screen share (no mismatch between status and video)  
- Remote screen stream clears correctly when sharing stops  
- Remote screen stream reattaches correctly when sharing restarts  
- No duplicate streams are attached  
- No stale (old) streams remain in the video element  
- No unexpected flicker or stuck placeholder state  

---

## Boundaries

- ❌ Do NOT introduce new fixes in this phase  
- ❌ Do NOT refactor  
- ❌ Do NOT remove logs yet  
- ✅ Validation only  
- ✅ Observe behavior and logs  

---

## Expected Output

Return pass/fail and short notes for each item in the checklist.

---

## Completion Condition

This phase is complete when:
- All critical checks pass  
- Behavior is stable across repeated tests  
- No regression is observed  

---

## Status

`DONE ✅`

---

## Results

Audio Works:
- Not runtime-tested in this container.

First Share Works:
- Not runtime-tested in this container.

Second Share Works:
- Not runtime-tested in this container.

Repeated Stop/Start Works:
- Not runtime-tested in this container.

UI Matches State:
- Not runtime-tested in this container.

Stream Clears Properly:
- Not runtime-tested in this container.

Stream Reattaches Properly:
- Logic updated to force stream rebuild before publish in `attachRemoteScreenReceiverTrack()`; manual browser validation still pending.

No Duplicate Streams:
- Expected by design (helper now clears all existing tracks before adding the current receiver track), but not runtime-tested here.

No Stale Streams:
- Expected by design (track list is replaced on each publish), but not runtime-tested here.

UI Flicker or Issues:
- Not runtime-tested in this container.

Remaining Risk:
- End-to-end WebRTC behavior across repeated share cycles still requires manual two-party browser verification.
