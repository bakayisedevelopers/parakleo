import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { getFirebaseClients } from '../../firebase/config';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CONNECTION_TIMEOUT_MS = 12000;

function toBridgeMessage(type, payload) {
  return {
    nativeEvent: {
      data: JSON.stringify({ type, payload: payload || {} }),
    },
  };
}

export function StudentRtcSessionView({
  bridgeRef,
  iceEndpoint,
  idToken,
  onBridgeMessage,
  sessionId,
}) {
  const [remoteScreenUrl, setRemoteScreenUrl] = useState('');
  const [rtcMounted, setRtcMounted] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioStreamRef = useRef(null);
  const remoteScreenStreamRef = useRef(null);
  const unsubscribersRef = useRef([]);
  const connectTimeoutRef = useRef(null);
  const isClosedRef = useRef(false);
  const seenTutorCandidateIdsRef = useRef(new Set());
  const latestOfferRevisionRef = useRef(0);
  const queuedCandidatesRef = useRef([]);
  const peerConnectedRef = useRef(false);
  const remoteScreenSharingRef = useRef(false);
  const localMutedRef = useRef(true);

  const emitBridge = (type, payload) => {
    onBridgeMessage?.(toBridgeMessage(type, payload));
  };

  const emitState = (overrides = {}) => {
    emitBridge('rtc_state', {
      connectionMessage: '',
      networkError: '',
      isMuted: localMutedRef.current,
      isPeerConnected: peerConnectedRef.current,
      isRemoteScreenSharing: remoteScreenSharingRef.current,
      hasLiveRemoteScreenTrack: remoteScreenSharingRef.current,
      ...overrides,
    });
  };

  const closeRtc = async () => {
    if (isClosedRef.current) return;
    isClosedRef.current = true;

    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }

    unsubscribersRef.current.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch {
        // ignore
      }
    });
    unsubscribersRef.current = [];

    const pc = pcRef.current;
    if (pc) {
      try {
        pc.getSenders().forEach((sender) => sender.track && sender.track.stop && sender.track.stop());
      } catch {
        // ignore
      }
      pc.close();
      pcRef.current = null;
    }

    const local = localStreamRef.current;
    if (local) {
      local.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    const remoteAudio = remoteAudioStreamRef.current;
    if (remoteAudio) {
      remoteAudio.getTracks().forEach((track) => track.stop());
      remoteAudioStreamRef.current = null;
    }

    const remoteScreen = remoteScreenStreamRef.current;
    if (remoteScreen) {
      remoteScreen.getTracks().forEach((track) => track.stop());
      remoteScreenStreamRef.current = null;
    }

    setRemoteScreenUrl('');
    remoteScreenSharingRef.current = false;
  };

  const setConnectionTimeout = () => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
    }

    connectTimeoutRef.current = setTimeout(() => {
      if (peerConnectedRef.current) return;
      emitState({
        connectionMessage: 'Trying to reconnect...',
        networkError: 'Your network is blocking the connection. Retry from the session controls.',
      });
    }, CONNECTION_TIMEOUT_MS);
  };

  const fetchIceServers = async () => {
    const response = await fetch(iceEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false || !Array.isArray(json.iceServers)) {
      throw new Error(json.message || 'Unable to load network relay configuration right now.');
    }

    return json.iceServers.length ? json.iceServers : DEFAULT_ICE_SERVERS;
  };

  const flushQueuedCandidates = async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription || !queuedCandidatesRef.current.length) {
      return;
    }

    while (queuedCandidatesRef.current.length > 0) {
      const candidate = queuedCandidatesRef.current.shift();
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        emitBridge('log', {
          message: 'Failed to add queued remote candidate.',
          error: error.message || String(error),
        });
      }
    }
  };

  const handleOfferSnapshot = async (sessionData) => {
    const pc = pcRef.current;
    if (!pc) return;

    const webrtc = sessionData?.webrtc || {};
    const offer = webrtc.offer || null;
    const offerRevision = Number(webrtc.offerRevision || 0);

    if (!offer) return;

    const shouldApplyOffer = !pc.currentRemoteDescription || offerRevision > latestOfferRevisionRef.current;
    if (!shouldApplyOffer) return;

    latestOfferRevisionRef.current = offerRevision;
    queuedCandidatesRef.current = [];

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await flushQueuedCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const { db } = getFirebaseClients();
    await setDoc(
      doc(db, 'sessions', sessionId),
      {
        webrtc: {
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
          studentReadyAt: Date.now(),
          status: 'connecting',
        },
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    setConnectionTimeout();
    emitState({
      connectionMessage: 'Connecting to tutor...',
      networkError: '',
    });
  };

  const toggleAudio = async () => {
    const local = localStreamRef.current;
    const audioTrack = local?.getAudioTracks?.()[0] || null;
    if (!audioTrack) {
      return false;
    }

    audioTrack.enabled = !audioTrack.enabled;
    localMutedRef.current = !audioTrack.enabled;
    emitState({
      connectionMessage: remoteScreenSharingRef.current
        ? 'Tutor screen share is live.'
        : (peerConnectedRef.current ? 'Connected to tutor.' : 'Connecting to tutor...'),
      networkError: '',
    });

    return !localMutedRef.current;
  };

  useEffect(() => {
    bridgeRef.current = {
      toggleAudio,
      close: closeRtc,
    };

    return () => {
      if (bridgeRef.current?.close === closeRtc) {
        bridgeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeRef]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!sessionId || !idToken || !iceEndpoint) {
        emitState({
          connectionMessage: 'Unable to start live class.',
          networkError: 'Missing session credentials.',
          isPeerConnected: false,
          isRemoteScreenSharing: false,
          hasLiveRemoteScreenTrack: false,
          isMuted: true,
        });
        return;
      }

      emitState({
        connectionMessage: 'Loading network relay...',
        networkError: '',
        isPeerConnected: false,
        isRemoteScreenSharing: false,
        hasLiveRemoteScreenTrack: false,
        isMuted: true,
      });

      const { db } = getFirebaseClients();
      const sessionRef = doc(db, 'sessions', sessionId);
      const tutorCandidatesRef = collection(db, 'sessions', sessionId, 'webrtcTutorCandidates');
      const studentCandidatesRef = collection(db, 'sessions', sessionId, 'webrtcStudentCandidates');

      const iceServers = await fetchIceServers();

      localMutedRef.current = true;
      try {
        const local = await mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = local;
        localMutedRef.current = false;
        emitBridge('log', { message: 'Microphone stream acquired for student.' });
      } catch (error) {
        localStreamRef.current = null;
        localMutedRef.current = true;
        emitBridge('log', {
          message: 'Microphone unavailable; continuing in listen-only mode.',
          error: error.message || String(error),
        });
      }

      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 4,
      });
      pcRef.current = pc;

      const audioTrack = localStreamRef.current?.getAudioTracks?.()[0] || null;
      if (audioTrack) {
        pc.addTrack(audioTrack, localStreamRef.current);
      }

      pc.addTransceiver('video', { direction: 'recvonly' });

      pc.onicecandidate = async (event) => {
        if (!event.candidate) return;

        try {
          await addDoc(studentCandidatesRef, {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid || null,
            sdpMLineIndex: Number.isFinite(event.candidate.sdpMLineIndex)
              ? event.candidate.sdpMLineIndex
              : null,
            usernameFragment: event.candidate.usernameFragment || null,
            createdAt: Date.now(),
          });
        } catch (error) {
          emitState({
            connectionMessage: 'Trying to reconnect...',
            networkError: error.message || 'Unable to publish network path.',
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = String(pc.connectionState || '').toLowerCase();
        peerConnectedRef.current = state === 'connected';

        if (peerConnectedRef.current && connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }

        emitState({
          connectionMessage: peerConnectedRef.current
            ? (remoteScreenSharingRef.current ? 'Tutor screen share is live.' : 'Connected to tutor.')
            : (state === 'connecting' ? 'Connecting to tutor...' : 'Trying to reconnect...'),
          networkError: state === 'failed'
            ? 'Your network is blocking the connection. Retry from the session controls.'
            : '',
          isPeerConnected: peerConnectedRef.current,
          isRemoteScreenSharing: remoteScreenSharingRef.current,
          hasLiveRemoteScreenTrack: remoteScreenSharingRef.current,
          isMuted: localMutedRef.current,
        });
      };

      pc.oniceconnectionstatechange = () => {
        const state = String(pc.iceConnectionState || '').toLowerCase();

        if (state === 'connected' || state === 'completed') {
          peerConnectedRef.current = true;
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          emitState({
            connectionMessage: remoteScreenSharingRef.current ? 'Tutor screen share is live.' : 'Connected to tutor.',
            networkError: '',
            isPeerConnected: true,
            isRemoteScreenSharing: remoteScreenSharingRef.current,
            hasLiveRemoteScreenTrack: remoteScreenSharingRef.current,
            isMuted: localMutedRef.current,
          });
          return;
        }

        if (state === 'failed' || state === 'disconnected') {
          peerConnectedRef.current = false;
          emitState({
            connectionMessage: 'Trying to reconnect...',
            networkError: state === 'failed'
              ? 'Your network is blocking the connection. Retry from the session controls.'
              : '',
            isPeerConnected: false,
            isRemoteScreenSharing: remoteScreenSharingRef.current,
            hasLiveRemoteScreenTrack: remoteScreenSharingRef.current,
            isMuted: localMutedRef.current,
          });
        }
      };

      pc.ontrack = (event) => {
        const track = event.track;
        if (!track) return;

        if (track.kind === 'audio') {
          const audioStream = event.streams?.[0] || (() => {
            const next = new MediaStream();
            next.addTrack(track);
            return next;
          })();
          remoteAudioStreamRef.current = audioStream;
          return;
        }

        if (track.kind !== 'video') {
          return;
        }

        const screenStream = event.streams?.[0] || (() => {
          const next = new MediaStream();
          next.addTrack(track);
          return next;
        })();

        remoteScreenStreamRef.current = screenStream;
        setRemoteScreenUrl(screenStream.toURL());

        const publishScreenState = () => {
          const hasLiveTrack = track.readyState === 'live' && !track.muted;
          remoteScreenSharingRef.current = hasLiveTrack;
          emitState({
            connectionMessage: hasLiveTrack ? 'Tutor screen share is live.' : 'Waiting for tutor to share.',
            networkError: '',
            isPeerConnected: peerConnectedRef.current,
            isRemoteScreenSharing: hasLiveTrack,
            hasLiveRemoteScreenTrack: hasLiveTrack,
            isMuted: localMutedRef.current,
          });
        };

        track.onunmute = publishScreenState;
        track.onmute = () => {
          remoteScreenSharingRef.current = false;
          emitState({
            connectionMessage: 'Waiting for tutor to share.',
            networkError: '',
            isPeerConnected: peerConnectedRef.current,
            isRemoteScreenSharing: false,
            hasLiveRemoteScreenTrack: false,
            isMuted: localMutedRef.current,
          });
        };
        track.onended = () => {
          remoteScreenSharingRef.current = false;
          remoteScreenStreamRef.current = null;
          setRemoteScreenUrl('');
          emitState({
            connectionMessage: peerConnectedRef.current ? 'Waiting for tutor to share.' : 'Connecting to tutor...',
            networkError: '',
            isPeerConnected: peerConnectedRef.current,
            isRemoteScreenSharing: false,
            hasLiveRemoteScreenTrack: false,
            isMuted: localMutedRef.current,
          });
        };

        publishScreenState();
      };

      unsubscribersRef.current.push(
        onSnapshot(sessionRef, (snapshot) => {
          const data = snapshot.data() || {};
          handleOfferSnapshot(data).catch((error) => {
            emitState({
              connectionMessage: 'Trying to reconnect...',
              networkError: error.message || 'Unable to refresh session state.',
              isPeerConnected: peerConnectedRef.current,
              isRemoteScreenSharing: remoteScreenSharingRef.current,
              hasLiveRemoteScreenTrack: remoteScreenSharingRef.current,
              isMuted: localMutedRef.current,
            });
          });
        }, (error) => {
          emitState({
            connectionMessage: 'Trying to reconnect...',
            networkError: error.message || 'Unable to refresh session state.',
          });
        }),
      );

      unsubscribersRef.current.push(
        onSnapshot(tutorCandidatesRef, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type !== 'added') return;
            const candidateId = change.doc.id;
            if (seenTutorCandidateIdsRef.current.has(candidateId)) return;
            seenTutorCandidateIdsRef.current.add(candidateId);

            const data = change.doc.data() || {};
            const candidate = new RTCIceCandidate({
              candidate: data.candidate,
              sdpMid: data.sdpMid || null,
              sdpMLineIndex: Number.isFinite(data.sdpMLineIndex) && data.sdpMLineIndex >= 0
                ? data.sdpMLineIndex
                : null,
              usernameFragment: data.usernameFragment || undefined,
            });

            const activePc = pcRef.current;
            if (!activePc) return;

            if (!activePc.remoteDescription) {
              queuedCandidatesRef.current.push(candidate);
              return;
            }

            try {
              await activePc.addIceCandidate(candidate);
            } catch (error) {
              emitBridge('log', {
                message: 'Failed to add remote ICE candidate.',
                error: error.message || String(error),
              });
            }
          });
        }, (error) => {
          emitState({
            connectionMessage: 'Trying to reconnect...',
            networkError: error.message || 'Unable to synchronize signaling candidates.',
          });
        }),
      );

      await setDoc(
        sessionRef,
        {
          webrtc: {
            status: 'student_joining',
            studentReadyAt: Date.now(),
          },
          updatedAt: Date.now(),
        },
        { merge: true },
      );

      emitState({
        connectionMessage: 'Connecting to tutor...',
        networkError: '',
        isPeerConnected: false,
        isRemoteScreenSharing: false,
        hasLiveRemoteScreenTrack: false,
        isMuted: localMutedRef.current,
      });

      setRtcMounted(true);
    };

    bootstrap().catch((error) => {
      emitState({
        connectionMessage: 'Unable to start live class.',
        networkError: error.message || 'Unable to start live class.',
        isPeerConnected: false,
        isRemoteScreenSharing: false,
        hasLiveRemoteScreenTrack: false,
        isMuted: localMutedRef.current,
      });
    });

    return () => {
      closeRtc().catch(() => null);
      setRtcMounted(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iceEndpoint, idToken, sessionId]);

  return (
    <View style={styles.wrap}>
      {rtcMounted && remoteScreenUrl ? (
        <RTCView
          mirror={false}
          objectFit="contain"
          streamURL={remoteScreenUrl}
          style={styles.video}
          zOrder={0}
        />
      ) : (
        <View style={styles.video} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
