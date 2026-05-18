import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

function sanitizeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildRtcHtml(payload) {
  const serializedPayload = sanitizeJson(payload);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }

      body {
        position: relative;
      }

      #stage {
        position: absolute;
        inset: 0;
        background: #000;
      }

      #remoteScreen {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
      }

      #placeholder {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(16, 185, 129, 0.22), transparent 30%),
          linear-gradient(180deg, #111827 0%, #000000 100%);
        color: #fff;
        text-align: center;
      }

      #placeholderCard {
        max-width: 420px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 28px;
        padding: 24px;
        background: rgba(17, 24, 39, 0.8);
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(18px);
      }

      #placeholderKicker {
        margin: 0 0 12px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.7);
      }

      #placeholderTitle {
        margin: 0;
        font-size: 28px;
        font-weight: 800;
      }

      #placeholderCopy {
        margin: 14px 0 0;
        font-size: 15px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.78);
      }

      #remoteAudio {
        position: absolute;
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div id="stage">
      <video id="remoteScreen" autoplay playsinline></video>
      <audio id="remoteAudio" autoplay playsinline></audio>
      <div id="placeholder">
        <div id="placeholderCard">
          <p id="placeholderKicker">Live classroom</p>
          <h1 id="placeholderTitle">Preparing session...</h1>
          <p id="placeholderCopy">Connecting to the tutor's live classroom now.</p>
        </div>
      </div>
    </div>

    <script>
      const payload = ${serializedPayload};
      const remoteScreenEl = document.getElementById('remoteScreen');
      const remoteAudioEl = document.getElementById('remoteAudio');
      const placeholderEl = document.getElementById('placeholder');
      const placeholderTitleEl = document.getElementById('placeholderTitle');
      const placeholderCopyEl = document.getElementById('placeholderCopy');

      const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
      const CONNECTION_TIMEOUT_MS = 12000;
      const SESSION_POLL_MS = 1500;
      const CANDIDATE_POLL_MS = 1200;

      let localStream = null;
      let peerConnection = null;
      let sessionPollHandle = null;
      let candidatePollHandle = null;
      let connectTimeoutHandle = null;
      let isClosed = false;
      let queuedCandidates = [];
      let remoteAudioStream = null;
      let remoteScreenStream = null;
      let seenTutorCandidateIds = new Set();
      let latestOfferRevision = 0;
      let localMuted = false;
      let peerConnected = false;
      let remoteScreenSharing = false;

      function postMessage(type, nextPayload) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload: nextPayload || {} }));
      }

      function setPlaceholder(title, copy) {
        placeholderTitleEl.textContent = title;
        placeholderCopyEl.textContent = copy;
      }

      function setPlaceholderVisible(visible) {
        placeholderEl.style.display = visible ? 'flex' : 'none';
      }

      function emitState(overrides) {
        const state = {
          connectionMessage: '',
          networkError: '',
          isMuted: localMuted,
          isPeerConnected: peerConnected,
          isRemoteScreenSharing: remoteScreenSharing,
          hasLiveRemoteScreenTrack: Boolean(
            remoteScreenStream
            && remoteScreenStream.getVideoTracks().some((track) => track.readyState === 'live' && !track.muted)
          ),
          ...(overrides || {}),
        };

        if (state.connectionMessage) {
          setPlaceholder('Live class in progress', state.connectionMessage);
        }

        if (state.networkError) {
          setPlaceholder('Connection issue', state.networkError);
          setPlaceholderVisible(true);
        }

        if (state.isRemoteScreenSharing) {
          setPlaceholderVisible(false);
        } else if (!state.networkError) {
          setPlaceholderVisible(true);
        }

        postMessage('rtc_state', state);
      }

      function fromFirestoreValue(value) {
        if (!value) return null;
        if ('nullValue' in value) return null;
        if ('stringValue' in value) return value.stringValue;
        if ('booleanValue' in value) return Boolean(value.booleanValue);
        if ('integerValue' in value) return Number(value.integerValue || 0);
        if ('doubleValue' in value) return Number(value.doubleValue || 0);
        if ('timestampValue' in value) return Date.parse(value.timestampValue);
        if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
        if ('arrayValue' in value) {
          return Array.isArray(value.arrayValue.values)
            ? value.arrayValue.values.map(fromFirestoreValue)
            : [];
        }
        return null;
      }

      function fromFirestoreFields(fields) {
        return Object.entries(fields || {}).reduce((accumulator, [key, value]) => {
          accumulator[key] = fromFirestoreValue(value);
          return accumulator;
        }, {});
      }

      function toFirestoreValue(value) {
        if (value === null || value === undefined) {
          return { nullValue: null };
        }

        if (Array.isArray(value)) {
          return {
            arrayValue: {
              values: value.map((entry) => toFirestoreValue(entry)),
            },
          };
        }

        if (typeof value === 'string') {
          return { stringValue: value };
        }

        if (typeof value === 'boolean') {
          return { booleanValue: value };
        }

        if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            return { integerValue: String(value) };
          }
          return { doubleValue: value };
        }

        if (typeof value === 'object') {
          return {
            mapValue: {
              fields: toFirestoreFields(value),
            },
          };
        }

        return { stringValue: String(value) };
      }

      function toFirestoreFields(value) {
        return Object.entries(value || {}).reduce((accumulator, [key, entry]) => {
          accumulator[key] = toFirestoreValue(entry);
          return accumulator;
        }, {});
      }

      function buildDocumentUrl(path) {
        return 'https://firestore.googleapis.com/v1/projects/' + payload.projectId + '/databases/(default)/documents/' + path;
      }

      function buildPatchUrl(path, fieldPaths) {
        const url = new URL(buildDocumentUrl(path));
        (fieldPaths || []).forEach((fieldPath) => url.searchParams.append('updateMask.fieldPaths', fieldPath));
        url.searchParams.append('currentDocument.exists', 'true');
        return url.toString();
      }

      async function authedFetch(url, options) {
        const headers = {
          Authorization: 'Bearer ' + payload.idToken,
          ...(options && options.headers ? options.headers : {}),
        };

        return fetch(url, {
          ...(options || {}),
          headers,
        });
      }

      async function getSessionDocument() {
        const response = await authedFetch(buildDocumentUrl('sessions/' + payload.sessionId));
        const json = await response.json().catch(() => ({}));

        if (!response.ok || !json.fields) {
          throw new Error(json.error && json.error.message ? json.error.message : 'Unable to load this session.');
        }

        return {
          id: payload.sessionId,
          ...fromFirestoreFields(json.fields || {}),
        };
      }

      async function patchSession(fields, fieldPaths) {
        const response = await authedFetch(buildPatchUrl('sessions/' + payload.sessionId, fieldPaths), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: toFirestoreFields(fields),
          }),
        });

        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error && json.error.message ? json.error.message : 'Unable to update session signaling.');
        }

        return json;
      }

      async function createCollectionDocument(path, fields) {
        const response = await authedFetch(buildDocumentUrl(path), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: toFirestoreFields(fields),
          }),
        });

        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error && json.error.message ? json.error.message : 'Unable to write WebRTC candidate.');
        }

        return json;
      }

      async function listCollectionDocuments(path) {
        const response = await authedFetch(buildDocumentUrl(path));
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json.error && json.error.message ? json.error.message : 'Unable to load signaling candidates.');
        }

        return Array.isArray(json.documents)
          ? json.documents.map((document) => ({
              id: String(document.name || '').split('/').pop(),
              ...fromFirestoreFields(document.fields || {}),
            }))
          : [];
      }

      function serializeDescription(description) {
        if (!description) return null;
        return {
          type: description.type,
          sdp: description.sdp,
        };
      }

      function hydrateCandidate(candidate) {
        return new RTCIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid || null,
          sdpMLineIndex: typeof candidate.sdpMLineIndex === 'number' ? candidate.sdpMLineIndex : null,
          usernameFragment: candidate.usernameFragment || undefined,
        });
      }

      async function fetchIceServers() {
        const response = await fetch(payload.iceEndpoint, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + payload.idToken,
            'Content-Type': 'application/json',
          },
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json.success === false || !Array.isArray(json.iceServers)) {
          throw new Error(json.message || 'Unable to load network relay configuration right now.');
        }
        return json.iceServers.length ? json.iceServers : DEFAULT_ICE_SERVERS;
      }

      async function flushQueuedCandidates() {
        if (!peerConnection || !peerConnection.remoteDescription || !queuedCandidates.length) {
          return;
        }

        while (queuedCandidates.length) {
          const candidate = queuedCandidates.shift();
          try {
            await peerConnection.addIceCandidate(candidate);
          } catch (error) {
            postMessage('log', { message: 'Failed to add queued remote candidate.', error: error.message || String(error) });
          }
        }
      }

      function mountRemoteAudioTrack(track) {
        if (!remoteAudioStream) {
          remoteAudioStream = new MediaStream();
        }

        remoteAudioStream.getTracks().forEach((existingTrack) => {
          if (existingTrack.id !== track.id) {
            remoteAudioStream.removeTrack(existingTrack);
          }
        });

        if (!remoteAudioStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
          remoteAudioStream.addTrack(track);
        }

        remoteAudioEl.srcObject = remoteAudioStream;
        remoteAudioEl.play().catch(() => null);
      }

      function publishRemoteScreen(track) {
        if (!remoteScreenStream) {
          remoteScreenStream = new MediaStream();
        }

        remoteScreenStream.getTracks().forEach((existingTrack) => {
          if (existingTrack.id !== track.id) {
            remoteScreenStream.removeTrack(existingTrack);
          }
        });

        if (!remoteScreenStream.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
          remoteScreenStream.addTrack(track);
        }

        remoteScreenEl.srcObject = remoteScreenStream;
        remoteScreenEl.play().catch(() => null);
        remoteScreenSharing = true;
        emitState({
          connectionMessage: 'Tutor screen share is live.',
          isPeerConnected: peerConnected,
          isRemoteScreenSharing: true,
          hasLiveRemoteScreenTrack: true,
          isMuted: localMuted,
        });

        track.onmute = () => {
          remoteScreenSharing = false;
          emitState({
            connectionMessage: 'Waiting for tutor to share.',
            isPeerConnected: peerConnected,
            isRemoteScreenSharing: false,
            hasLiveRemoteScreenTrack: false,
            isMuted: localMuted,
          });
        };

        track.onended = () => {
          clearRemoteScreen();
        };
      }

      function clearRemoteScreen() {
        if (remoteScreenStream) {
          remoteScreenStream.getTracks().forEach((track) => remoteScreenStream.removeTrack(track));
        }

        remoteScreenEl.srcObject = null;
        remoteScreenSharing = false;
        emitState({
          connectionMessage: peerConnected ? 'Waiting for tutor to share.' : 'Connecting to tutor...',
          isPeerConnected: peerConnected,
          isRemoteScreenSharing: false,
          hasLiveRemoteScreenTrack: false,
          isMuted: localMuted,
        });
      }

      function setConnectionTimeout() {
        if (connectTimeoutHandle) {
          clearTimeout(connectTimeoutHandle);
        }

        connectTimeoutHandle = setTimeout(() => {
          emitState({
            connectionMessage: 'Trying to reconnect...',
            networkError: peerConnected ? '' : 'Your network is blocking the connection. Retry from the session controls.',
            isPeerConnected: peerConnected,
            isRemoteScreenSharing: remoteScreenSharing,
            hasLiveRemoteScreenTrack: remoteScreenSharing,
            isMuted: localMuted,
          });
        }, CONNECTION_TIMEOUT_MS);
      }

      async function handleSessionSnapshot(session) {
        if (!peerConnection) {
          return;
        }

        const webrtc = session.webrtc || {};
        const offer = webrtc.offer || null;
        const offerRevision = Number(webrtc.offerRevision || 0);

        if (webrtc.screenShare && webrtc.screenShare.active === false) {
          clearRemoteScreen();
        }

        if (!offer) {
          return;
        }

        const shouldApplyOffer = !peerConnection.currentRemoteDescription || offerRevision > latestOfferRevision;
        if (!shouldApplyOffer) {
          return;
        }

        latestOfferRevision = offerRevision;
        seenTutorCandidateIds = new Set();
        queuedCandidates = [];

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        await flushQueuedCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await patchSession(
          {
            webrtc: {
              answer: serializeDescription(answer),
              studentReadyAt: Date.now(),
              status: 'connecting',
            },
            updatedAt: Date.now(),
          },
          ['webrtc.answer', 'webrtc.studentReadyAt', 'webrtc.status', 'updatedAt'],
        );

        setConnectionTimeout();
        emitState({
          connectionMessage: 'Connecting to tutor...',
          networkError: '',
          isPeerConnected: peerConnected,
          isRemoteScreenSharing: remoteScreenSharing,
          hasLiveRemoteScreenTrack: remoteScreenSharing,
          isMuted: localMuted,
        });
      }

      async function pollTutorCandidates() {
        if (!peerConnection || isClosed) {
          return;
        }

        try {
          const candidates = await listCollectionDocuments('sessions/' + payload.sessionId + '/webrtcTutorCandidates');

          for (const candidateData of candidates) {
            if (!candidateData.id || seenTutorCandidateIds.has(candidateData.id)) {
              continue;
            }

            seenTutorCandidateIds.add(candidateData.id);
            const candidate = hydrateCandidate(candidateData);

            if (!peerConnection.remoteDescription) {
              queuedCandidates.push(candidate);
              continue;
            }

            await peerConnection.addIceCandidate(candidate);
          }
        } catch (error) {
          emitState({
            connectionMessage: 'Trying to reconnect...',
            networkError: error.message || 'Unable to synchronize signaling candidates.',
            isPeerConnected: peerConnected,
            isRemoteScreenSharing: remoteScreenSharing,
            hasLiveRemoteScreenTrack: remoteScreenSharing,
            isMuted: localMuted,
          });
        }
      }

      async function bootstrapRtc() {
        emitState({
          connectionMessage: 'Loading network relay...',
          networkError: '',
          isPeerConnected: false,
          isRemoteScreenSharing: false,
          hasLiveRemoteScreenTrack: false,
          isMuted: false,
        });

        const iceServers = await fetchIceServers();
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localMuted = false;

        peerConnection = new RTCPeerConnection({
          iceServers,
          iceCandidatePoolSize: 4,
        });

        const audioTrack = localStream.getAudioTracks()[0] || null;
        if (audioTrack) {
          peerConnection.addTrack(audioTrack, localStream);
        }

        peerConnection.addTransceiver('video', { direction: 'recvonly' });

        peerConnection.onicecandidate = async (event) => {
          if (!event.candidate) {
            return;
          }

          try {
            await createCollectionDocument('sessions/' + payload.sessionId + '/webrtcStudentCandidates', {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid || '',
              sdpMLineIndex: typeof event.candidate.sdpMLineIndex === 'number' ? event.candidate.sdpMLineIndex : -1,
              usernameFragment: event.candidate.usernameFragment || '',
              createdAt: Date.now(),
            });
          } catch (error) {
            emitState({
              connectionMessage: 'Trying to reconnect...',
              networkError: error.message || 'Unable to publish network path.',
              isPeerConnected: peerConnected,
              isRemoteScreenSharing: remoteScreenSharing,
              hasLiveRemoteScreenTrack: remoteScreenSharing,
              isMuted: localMuted,
            });
          }
        };

        peerConnection.onconnectionstatechange = () => {
          const state = String(peerConnection.connectionState || '').toLowerCase();
          peerConnected = state === 'connected';

          if (peerConnected && connectTimeoutHandle) {
            clearTimeout(connectTimeoutHandle);
          }

          emitState({
            connectionMessage: peerConnected ? 'Connected to tutor.' : (state === 'connecting' ? 'Connecting to tutor...' : 'Trying to reconnect...'),
            networkError: state === 'failed' ? 'Your network is blocking the connection. Retry from the session controls.' : '',
            isPeerConnected: peerConnected,
            isRemoteScreenSharing: remoteScreenSharing,
            hasLiveRemoteScreenTrack: remoteScreenSharing,
            isMuted: localMuted,
          });
        };

        peerConnection.oniceconnectionstatechange = () => {
          const state = String(peerConnection.iceConnectionState || '').toLowerCase();
          if (state === 'connected' || state === 'completed') {
            peerConnected = true;
            if (connectTimeoutHandle) {
              clearTimeout(connectTimeoutHandle);
            }
            emitState({
              connectionMessage: remoteScreenSharing ? 'Tutor screen share is live.' : 'Connected to tutor.',
              networkError: '',
              isPeerConnected: true,
              isRemoteScreenSharing: remoteScreenSharing,
              hasLiveRemoteScreenTrack: remoteScreenSharing,
              isMuted: localMuted,
            });
            return;
          }

          if (state === 'failed' || state === 'disconnected') {
            peerConnected = false;
            emitState({
              connectionMessage: 'Trying to reconnect...',
              networkError: 'Your network is blocking the connection. Retry from the session controls.',
              isPeerConnected: false,
              isRemoteScreenSharing: remoteScreenSharing,
              hasLiveRemoteScreenTrack: remoteScreenSharing,
              isMuted: localMuted,
            });
          }
        };

        peerConnection.ontrack = (event) => {
          if (!event.track) {
            return;
          }

          if (event.track.kind === 'audio') {
            mountRemoteAudioTrack(event.track);
            return;
          }

          if (event.track.kind === 'video') {
            publishRemoteScreen(event.track);
          }
        };

        const initialSession = await getSessionDocument();
        await handleSessionSnapshot(initialSession);

        sessionPollHandle = setInterval(async () => {
          if (isClosed) {
            return;
          }

          try {
            const session = await getSessionDocument();
            await handleSessionSnapshot(session);
          } catch (error) {
            emitState({
              connectionMessage: 'Trying to reconnect...',
              networkError: error.message || 'Unable to refresh session state.',
              isPeerConnected: peerConnected,
              isRemoteScreenSharing: remoteScreenSharing,
              hasLiveRemoteScreenTrack: remoteScreenSharing,
              isMuted: localMuted,
            });
          }
        }, SESSION_POLL_MS);

        candidatePollHandle = setInterval(() => {
          pollTutorCandidates().catch(() => null);
        }, CANDIDATE_POLL_MS);

        emitState({
          connectionMessage: 'Connecting to tutor...',
          networkError: '',
          isPeerConnected: false,
          isRemoteScreenSharing: false,
          hasLiveRemoteScreenTrack: false,
          isMuted: false,
        });
      }

      async function toggleAudio() {
        const audioTrack = localStream && localStream.getAudioTracks ? localStream.getAudioTracks()[0] : null;
        if (!audioTrack) {
          return false;
        }

        audioTrack.enabled = !audioTrack.enabled;
        localMuted = !audioTrack.enabled;
        emitState({
          connectionMessage: remoteScreenSharing ? 'Tutor screen share is live.' : (peerConnected ? 'Connected to tutor.' : 'Connecting to tutor...'),
          networkError: '',
          isPeerConnected: peerConnected,
          isRemoteScreenSharing: remoteScreenSharing,
          hasLiveRemoteScreenTrack: remoteScreenSharing,
          isMuted: localMuted,
        });
        return !localMuted;
      }

      async function destroyRtc() {
        if (isClosed) {
          return;
        }

        isClosed = true;

        if (sessionPollHandle) {
          clearInterval(sessionPollHandle);
        }

        if (candidatePollHandle) {
          clearInterval(candidatePollHandle);
        }

        if (connectTimeoutHandle) {
          clearTimeout(connectTimeoutHandle);
        }

        if (peerConnection) {
          peerConnection.getSenders().forEach((sender) => sender.track && sender.track.stop && sender.track.stop());
          peerConnection.close();
        }

        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
        }

        if (remoteAudioStream) {
          remoteAudioStream.getTracks().forEach((track) => track.stop());
        }

        if (remoteScreenStream) {
          remoteScreenStream.getTracks().forEach((track) => track.stop());
        }
      }

      window.ClaxiSessionBridge = {
        toggleAudio,
        close: destroyRtc,
      };

      bootstrapRtc().catch((error) => {
        emitState({
          connectionMessage: 'Unable to start live class.',
          networkError: error.message || 'Unable to start live class.',
          isPeerConnected: false,
          isRemoteScreenSharing: false,
          hasLiveRemoteScreenTrack: false,
          isMuted: false,
        });
      });

      window.addEventListener('beforeunload', () => {
        destroyRtc().catch(() => null);
      });
    </script>
  </body>
</html>`;
}

export function StudentRtcSessionView({
  bridgeRef,
  iceEndpoint,
  idToken,
  onBridgeMessage,
  projectId,
  sessionId,
}) {
  const html = useMemo(() => buildRtcHtml({
    iceEndpoint,
    idToken,
    projectId,
    sessionId,
  }), [iceEndpoint, idToken, projectId, sessionId]);

  return (
    <View style={styles.wrap}>
      <WebView
        allowsInlineMediaPlayback
        domStorageEnabled
        javaScriptEnabled
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        onMessage={onBridgeMessage}
        originWhitelist={['*']}
        ref={bridgeRef}
        source={{ html }}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
