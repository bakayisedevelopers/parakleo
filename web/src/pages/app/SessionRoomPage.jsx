import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeDollarSign,
  Clock3,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Presentation,
  Star,
  Wifi,
  X,
} from 'lucide-react';
import TldrawSdkEmbed from '../../components/app/TldrawSdkEmbed';
import { useAuth } from '../../hooks/useAuth';
import { useStudentSessions, useTutorSessions } from '../../hooks/useSessions';
import { SESSION_STATUS } from '../../constants/lifecycle';
import {
  endSession,
  finalizeSessionClosure,
  joinSessionAsStudent,
  submitSessionRating,
  updateSession,
} from '../../services/sessionService';
import { createWebRtcSessionController } from '../../services/webrtcService';
import { fetchIceServers } from '../../services/iceServerService';
import { debugLog } from '../../utils/devLogger';

const HANDLED_KEY = 'claxi_handled_session_room_ratings';
const RATABLE_STATUSES = new Set([
  SESSION_STATUS.COMPLETED,
  SESSION_STATUS.CANCELED,
  SESSION_STATUS.CANCELED_DURING,
]);

function useLiveSeconds(startTs) {
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startTs) return 0;
  return Math.max(0, Math.floor((tick - startTs) / 1000));
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mins}:${secs}`;
  }

  return `${mins}:${secs}`;
}

function StageBadge({ icon: Icon, children, tone = 'default', className = '' }) {
  const toneClasses = {
    default: 'border-white/10 bg-[#1f2430]/96 text-zinc-100',
    info: 'border-sky-500/25 bg-sky-500/14 text-sky-200',
    success: 'border-emerald-500/25 bg-emerald-500/14 text-emerald-200',
    warning: 'border-amber-500/25 bg-amber-500/14 text-amber-200',
    danger: 'border-rose-500/25 bg-rose-500/14 text-rose-200',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-md backdrop-blur ${toneClasses[tone]} ${className}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </div>
  );
}

function RailButton({
  onClick,
  icon: Icon,
  label,
  danger = false,
  disabled = false,
  active = false,
  compact = false,
}) {
  const classes = danger
    ? 'border-rose-500/20 bg-rose-500 text-white hover:bg-rose-600'
    : active
      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20'
      : 'border-white/10 bg-[#1f2430]/95 text-zinc-100 hover:bg-[#272d3a]';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      type="button"
      className={`inline-flex items-center justify-center rounded-2xl border shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
        compact ? 'h-10 w-10 md:h-12 md:w-12' : 'h-12 w-12'
      } ${classes}`}
    >
      <Icon className={compact ? 'h-4 w-4 md:h-4.5 md:w-4.5' : 'h-4.5 w-4.5'} />
    </button>
  );
}

function HiddenMediaMounts({ localVideoRef, remoteVideoRef, remoteScreenVideoRef }) {
  return (
    <div className="pointer-events-none absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden opacity-0">
      <video ref={localVideoRef} autoPlay playsInline muted />
      <video ref={remoteVideoRef} autoPlay playsInline />
      {remoteScreenVideoRef ? <video ref={remoteScreenVideoRef} autoPlay playsInline /> : null}
    </div>
  );
}

export default function SessionRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role === 'tutor' ? 'tutor' : 'student';
  const { sessions: studentSessions } = useStudentSessions(user?.uid);
  const { sessions: tutorSessions } = useTutorSessions(user?.uid);
  const sessions = role === 'tutor' ? tutorSessions : studentSessions;
  const session = sessions.find((item) => item.id === id);

  const [ratingForm, setRatingForm] = useState({ overall: '5' });
  const [isSaving, setIsSaving] = useState(false);
  const [handledRatingIds, setHandledRatingIds] = useState([]);
  const [selectedCardId] = useState(
    user?.paymentMethods?.find((card) => card.isDefault)?.id
      || user?.paymentMethods?.[0]?.id
      || '',
  );
  const [isBusy, setIsBusy] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isLocalScreenSharing, setIsLocalScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [remoteScreenStreamObj, setRemoteScreenStreamObj] = useState(null);
  const [showStudentControls, setShowStudentControls] = useState(true);
  const [hasAcceptedExtension, setHasAcceptedExtension] = useState(false);
  const [graceEndsAtMs, setGraceEndsAtMs] = useState(null);
  const extensionPromptShownRef = useRef(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteScreenVideoRef = useRef(null);

  const rtcRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);
  const connectionStartRecordedRef = useRef(false);
  const activeInitKeyRef = useRef('');
  const rtcInitStartedRef = useRef(false);
  const hadSessionRef = useRef(false);
  const studentControlsTimeoutRef = useRef(null);
  const autoEndingRef = useRef(false);

  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const billedSeconds = useLiveSeconds(session?.billingStartedAt);
  const needsRating = Boolean(session?.id)
    && RATABLE_STATUSES.has(session?.status)
    && !handledRatingIds.includes(session.id);
  const tldrawLicenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;
  const forceRelayOnly = String(import.meta.env.VITE_WEBRTC_FORCE_RELAY_ONLY || '').toLowerCase() === 'true';
  const whiteboardRoom = session?.whiteboardRoomId || session?.requestId || session?.id;
  const graceRemaining = Math.max(0, Math.ceil(((session?.joinGraceEndsAt || 0) - Date.now()) / 1000));
  const extensionGraceRemainingSeconds = hasAcceptedExtension && graceEndsAtMs
    ? Math.max(0, Math.ceil((graceEndsAtMs - Date.now()) / 1000))
    : 0;
  const selectedDurationMinutes = Number(session?.durationMinutes || session?.pricingSnapshot?.durationMinutes || 0);
  const selectedDurationSeconds = Math.max(0, Math.round(selectedDurationMinutes * 60));

  const connectionTone = useMemo(() => {
    if (networkError) return 'danger';
    if (!connectionMessage) return 'default';
    if (
      connectionMessage.toLowerCase().includes('connected')
      || connectionMessage.toLowerCase().includes('live')
    ) {
      return 'success';
    }
    return 'info';
  }, [connectionMessage, networkError]);

  useEffect(() => {
    if (session) {
      hadSessionRef.current = true;
    }
  }, [session]);

  useEffect(() => {
    autoJoinAttemptedRef.current = false;
    connectionStartRecordedRef.current = false;
    activeInitKeyRef.current = '';
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(true);
    setHasAcceptedExtension(false);
    setGraceEndsAtMs(null);
    extensionPromptShownRef.current = false;
    autoEndingRef.current = false;
  }, [session?.id, role]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(HANDLED_KEY) || '[]');
      setHandledRatingIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHandledRatingIds([]);
    }
  }, []);

  const markRatingHandled = useCallback((sessionId) => {
    if (!sessionId) return;
    setHandledRatingIds((prev) => {
      if (prev.includes(sessionId)) return prev;
      const next = [...prev, sessionId];
      sessionStorage.setItem(HANDLED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      rtcRef.current?.close?.();
      rtcRef.current = null;
      rtcInitStartedRef.current = false;
      setRemoteScreenStreamObj(null);
      if (studentControlsTimeoutRef.current) {
        clearTimeout(studentControlsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const videoEl = remoteScreenVideoRef.current;
    debugLog('sessionRoom', '[claxi:screen:ui] remote screen srcObject effect.', {
      hasVideoElement: Boolean(videoEl),
      hasStream: Boolean(remoteScreenStreamObj),
      hadPreviousSrcObject: Boolean(videoEl?.srcObject),
    });
    if (!videoEl) return;

    videoEl.srcObject = remoteScreenStreamObj || null;

    if (remoteScreenStreamObj) {
      debugLog('sessionRoom', '[claxi:screen:ui] srcObject assigned.', {
        trackIds: remoteScreenStreamObj.getTracks().map((track) => track.id),
        videoTrackIds: remoteScreenStreamObj.getVideoTracks().map((track) => track.id),
      });

      const handleLoadedMetadata = async () => {
        debugLog('sessionRoom', '[claxi:screen:ui] remote screen loadedmetadata.', {
          videoWidth: videoEl.videoWidth,
          videoHeight: videoEl.videoHeight,
          readyState: videoEl.readyState,
        });

        try {
          await videoEl.play();
          debugLog('sessionRoom', '[claxi:screen:ui] remote screen video play succeeded.', {
            paused: videoEl.paused,
            readyState: videoEl.readyState,
            videoWidth: videoEl.videoWidth,
            videoHeight: videoEl.videoHeight,
          });
        } catch (error) {
          debugLog('sessionRoom', '[claxi:screen:ui] remote screen video play failed.', {
            message: error?.message || String(error),
          });
        }
      };

      videoEl.onloadedmetadata = handleLoadedMetadata;
    } else {
      videoEl.onloadedmetadata = null;
      debugLog('sessionRoom', '[claxi:screen:ui] srcObject cleared.');
    }

    debugLog('sessionRoom', 'Attached remote screen stream to student video element.', {
      hasStream: Boolean(remoteScreenStreamObj),
    });
  }, [remoteScreenStreamObj, isRemoteScreenSharing]);

  useEffect(() => {
    const updateViewportFlags = () => {
      const isMobile = window.innerWidth < 768;
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      setIsMobileViewport(isMobile);
      setIsPortraitMobile(isMobile && isPortrait);
    };

    updateViewportFlags();
    window.addEventListener('resize', updateViewportFlags);

    const media = window.matchMedia('(orientation: portrait)');
    const onOrientationChange = () => updateViewportFlags();

    if (media.addEventListener) {
      media.addEventListener('change', onOrientationChange);
    } else {
      media.addListener(onOrientationChange);
    }

    return () => {
      window.removeEventListener('resize', updateViewportFlags);
      if (media.removeEventListener) {
        media.removeEventListener('change', onOrientationChange);
      } else {
        media.removeListener(onOrientationChange);
      }
    };
  }, []);

  useEffect(() => {
    async function tryLockLandscape() {
      if (!isMobileViewport) return;
      try {
        if (window.screen?.orientation?.lock) {
          await window.screen.orientation.lock('landscape');
        }
      } catch {
        // Some browsers ignore or reject this.
      }
    }

    tryLockLandscape();
  }, [isMobileViewport]);

  useEffect(() => {
    if (role !== 'student') return;
    if (!showStudentControls) return;

    if (studentControlsTimeoutRef.current) {
      clearTimeout(studentControlsTimeoutRef.current);
    }

    studentControlsTimeoutRef.current = setTimeout(() => {
      setShowStudentControls(false);
    }, 5000);

    return () => {
      if (studentControlsTimeoutRef.current) {
        clearTimeout(studentControlsTimeoutRef.current);
      }
    };
  }, [role, showStudentControls]);

  const initializeCall = useCallback(async ({ shouldJoinStudent }) => {
    if (!session || !user?.uid) return;

    const initKey = `${session.id}:${role}`;

    if (rtcRef.current) {
      debugLog('sessionRoom', 'Skipping init because rtcRef already exists.', { initKey });
      return;
    }
    if (rtcInitStartedRef.current) {
      debugLog('sessionRoom', 'Skipping init because initialization already started.', { initKey });
      return;
    }
    if (activeInitKeyRef.current === initKey) {
      debugLog('sessionRoom', 'Skipping init because initKey is already active.', { initKey });
      return;
    }

    rtcInitStartedRef.current = true;
    activeInitKeyRef.current = initKey;

    setIsBusy(true);
    setNetworkError('');

    try {
      debugLog('sessionRoom', 'Initializing call.', {
        sessionId: session.id,
        role,
        shouldJoinStudent,
        forceRelayOnly,
      });

      if (shouldJoinStudent) {
        const selected =
          (user?.paymentMethods || []).find((card) => card.id === selectedCardId)
          || (user?.paymentMethods || []).find((card) => card.isDefault)
          || user?.paymentMethods?.[0];

        await joinSessionAsStudent(session, selected?.id || null, selected?.last4 || null);
      }

      const iceServers = await fetchIceServers();

      const controller = await createWebRtcSessionController({
        sessionId: session.id,
        role,
        currentUserId: user.uid,
        iceServers,
        forceRelayOnly,

        onLocalStream: (stream) => {
          if (!localVideoRef.current) return;
          localVideoRef.current.srcObject = stream;
        },

        onRemoteStream: (stream) => {
          if (!remoteVideoRef.current) return;
          remoteVideoRef.current.srcObject = stream;
        },

        onRemoteScreenStream: (stream) => {
          debugLog('sessionRoom', '[claxi:screen:ui] onRemoteScreenStream callback.', {
            hasStream: Boolean(stream),
            streamId: stream?.id || null,
            trackIds: stream?.getTracks?.().map((track) => track.id) || [],
          });
          setRemoteScreenStreamObj(stream || null);
        },

        onScreenShareStateChange: ({ local, remote }) => {
          debugLog('sessionRoom', '[claxi:screen:ui] onScreenShareStateChange callback.', {
            local: Boolean(local),
            remote: Boolean(remote),
          });
          setIsLocalScreenSharing(Boolean(local));
          setIsRemoteScreenSharing(Boolean(remote));

          if (!remote) {
            setRemoteScreenStreamObj(null);
            if (remoteScreenVideoRef.current) {
              remoteScreenVideoRef.current.srcObject = null;
            }
          }
        },

        onConnectionMessage: (message) => setConnectionMessage(message),
        onNetworkFailure: (message) => setNetworkError(message),

        onSessionState: async (state) => {
          if (state !== 'connected') return;
          if (connectionStartRecordedRef.current) return;
          connectionStartRecordedRef.current = true;

          const updates = {};
          if (!session.callStartedAt) {
            updates.callStartedAt = Date.now();
          }
          if (!session.billingStartedAt) {
            updates.billingStartedAt = Date.now();
          }

          if (Object.keys(updates).length > 0) {
            await updateSession(session.id, updates);
          }
        },
      });

      rtcRef.current = controller;
      setConnectionMessage(role === 'tutor' ? 'Waiting for student to join…' : 'Connecting…');

      debugLog('sessionRoom', 'WebRTC controller created successfully.', {
        sessionId: session.id,
        role,
      });
    } catch (error) {
      rtcInitStartedRef.current = false;
      debugLog('sessionRoom', 'Failed to initialize call.', {
        sessionId: session?.id || null,
        role,
        message: error.message,
      });
      setNetworkError(error.message || 'Unable to start call. Please retry.');
    } finally {
      activeInitKeyRef.current = '';
      setIsBusy(false);
    }
  }, [forceRelayOnly, role, selectedCardId, session, user]);

  useEffect(() => {
    if (!session) return;
    if (role !== 'tutor') return;
    if (![SESSION_STATUS.WAITING_STUDENT, SESSION_STATUS.IN_PROGRESS].includes(session.status)) return;
    initializeCall({ shouldJoinStudent: false });
  }, [initializeCall, role, session]);

  useEffect(() => {
    if (!session) return;
    if (role !== 'student') return;
    if (![SESSION_STATUS.WAITING_STUDENT, SESSION_STATUS.IN_PROGRESS].includes(session.status)) return;
    if (rtcRef.current || isBusy || autoJoinAttemptedRef.current || rtcInitStartedRef.current) return;

    autoJoinAttemptedRef.current = true;
    initializeCall({ shouldJoinStudent: session.status === SESSION_STATUS.WAITING_STUDENT });
  }, [initializeCall, isBusy, role, session]);

  useEffect(() => {
    if (!session?.status) return;
    if (![SESSION_STATUS.CANCELED, SESSION_STATUS.CANCELED_DURING].includes(session.status)) return;

    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(false);

    if (role === 'student') {
      navigate(`/app/student/request/${session.requestId}`, {
        replace: true,
        state: { requestId: session.requestId },
      });
      return;
    }

    navigate('/app/tutor/sessions', { replace: true });
  }, [navigate, role, session?.requestId, session?.status]);

  useEffect(() => {
    if (!session?.status) return;
    if (session.status !== SESSION_STATUS.COMPLETED) return;
    if (role !== 'student') return;

    navigate(`/app/student/request/${session.requestId}`, {
      replace: true,
      state: { requestId: session.requestId },
    });
  }, [navigate, role, session?.requestId, session?.status]);

  useEffect(() => {
    if (session) return;
    if (!hadSessionRef.current) return;

    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(false);

    if (role === 'student') {
      navigate('/app/student/request', { replace: true });
      return;
    }

    navigate('/app/tutor/sessions', { replace: true });
  }, [navigate, role, session]);

  const askCancellationReason = () => {
    const reason = window.prompt('Please tell us why you want to cancel this class.');

    if (reason === null) return null;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setNetworkError('Please enter a cancellation reason before canceling the class.');
      return null;
    }

    return trimmedReason;
  };

  const cancelCurrentClass = async () => {
    if (!session) return;

    const cancellationReason = askCancellationReason();
    if (!cancellationReason) return;

    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(false);

    await finalizeSessionClosure(session, {
      closureType: SESSION_STATUS.CANCELED_DURING,
      canceledBy: role,
      canceledReason: cancellationReason,
    });

    if (role === 'student') {
      navigate(`/app/student/request/${session.requestId}`, {
        replace: true,
        state: { requestId: session.requestId },
      });
      return;
    }

    navigate('/app/tutor/sessions', { replace: true });
  };

  const endCurrentSession = async () => {
    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    await endSession(session);

    if (role === 'student') {
      navigate(`/app/student/request/${session.requestId}`, {
        replace: true,
        state: { requestId: session.requestId },
      });
      return;
    }

    navigate('/app/tutor', { replace: true });
  };

  useEffect(() => {
    if (role !== 'student') return;
    if (!session || session.status !== SESSION_STATUS.IN_PROGRESS) return;
    if (!selectedDurationSeconds || !session.billingStartedAt) return;

    const elapsedSeconds = billedSeconds;
    const warningThreshold = Math.max(0, selectedDurationSeconds - 60);

    if (!extensionPromptShownRef.current && elapsedSeconds >= warningThreshold) {
      extensionPromptShownRef.current = true;
      const shouldExtend = window.confirm('Your selected lesson time is almost up. Continue and get a 2-minute grace period?');
      if (shouldExtend) {
        setHasAcceptedExtension(true);
        setGraceEndsAtMs(Number(session.billingStartedAt) + ((selectedDurationSeconds + 120) * 1000));
      }
    }

    if (!hasAcceptedExtension && elapsedSeconds >= selectedDurationSeconds && !autoEndingRef.current) {
      autoEndingRef.current = true;
      endCurrentSession().catch((error) => {
        autoEndingRef.current = false;
        setNetworkError(error.message || 'Unable to end session at selected time.');
      });
    }
  }, [
    billedSeconds,
    hasAcceptedExtension,
    role,
    selectedDurationSeconds,
    session,
  ]);

  const submitRating = async (overall) => {
    if (!session || isSaving) return;
    setIsSaving(true);
    try {
      await submitSessionRating(session, role, {
        overall: Number(overall),
      });
      markRatingHandled(session.id);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMute = () => {
    const enabled = rtcRef.current?.toggleAudio?.();
    if (typeof enabled === 'boolean') {
      setIsMuted(!enabled);
    }
  };

  const shareScreen = async () => {
    try {
      if (isLocalScreenSharing) {
        await rtcRef.current?.stopScreenShare?.();
        setIsLocalScreenSharing(false);
        return;
      }

      await rtcRef.current?.startScreenShare?.();
      setIsLocalScreenSharing(true);
    } catch (error) {
      setNetworkError(error.message || 'Unable to share screen.');
    }
  };

  const toggleStudentControls = () => {
    setShowStudentControls((prev) => !prev);
  };

  const controlsCompact = isMobileViewport;
  const showStudentOverlay = role !== 'student' || !isMobileViewport || showStudentControls;
  const closeHref = role === 'tutor' ? '/app/tutor/sessions' : '/app';

  const renderTutorStageHeader = () => (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 max-w-[calc(100vw-7rem)]">
      <div className="rounded-[24px] border border-white/12 bg-black p-3 shadow-2xl backdrop-blur-md ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StageBadge icon={Clock3} className="bg-[#1b2230]/98">
            Call {formatDuration(callSeconds)}
          </StageBadge>
          <StageBadge icon={BadgeDollarSign} className="bg-[#1b2230]/98">
            Billable {formatDuration(billedSeconds)}
          </StageBadge>
        </div>
      </div>
    </div>
  );

  const renderStudentStageHeader = () => (
    <div
      className={`absolute left-20 right-4 top-4 z-20 transition-opacity duration-200 ${
        showStudentOverlay ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="rounded-[22px] border border-white/10 bg-[#161b25]/88 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge icon={Clock3}>Call length {formatDuration(callSeconds)}</StageBadge>

          <StageBadge icon={Wifi} tone={connectionTone}>
            {connectionMessage || 'Connecting…'}
          </StageBadge>

          <StageBadge tone={networkError ? 'danger' : isRemoteScreenSharing ? 'success' : 'warning'}>
            {networkError
              ? 'Connection issue'
              : isRemoteScreenSharing
                ? 'Screen live'
                : 'Waiting for tutor to share'}
          </StageBadge>

          {session.status === SESSION_STATUS.WAITING_STUDENT ? (
            <StageBadge icon={Clock3} tone="warning">
              Join window {graceRemaining}s
            </StageBadge>
          ) : null}

          {hasAcceptedExtension ? (
            <StageBadge icon={Clock3} tone={extensionGraceRemainingSeconds > 0 ? 'success' : 'info'}>
              {extensionGraceRemainingSeconds > 0
                ? `Grace period ${extensionGraceRemainingSeconds}s`
                : 'Overtime billed at locked rate'}
            </StageBadge>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderTutorStage = () => (
    <div className="relative h-full w-full overflow-hidden bg-[#0f141d]">
      {renderTutorStageHeader()}
      <div className="absolute inset-0">
        <TldrawSdkEmbed roomId={whiteboardRoom} licenseKey={tldrawLicenseKey} />
      </div>
    </div>
  );

  const renderStudentStage = () => (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      onClick={toggleStudentControls}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleStudentControls();
        }
      }}
    >
      {debugLog('sessionRoom', '[claxi:screen:ui] renderStudentStage visibility.', {
        isRemoteScreenSharing,
        hasRemoteScreenStreamObj: Boolean(remoteScreenStreamObj),
      })}
      {renderStudentStageHeader()}

      {isRemoteScreenSharing ? (
        <video
          ref={remoteScreenVideoRef}
          autoPlay
          playsInline
          muted={false}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-md rounded-[28px] border border-white/10 bg-[#161b25]/88 p-6 text-center shadow-2xl backdrop-blur-md">
            <Presentation className="mx-auto h-8 w-8 text-zinc-500" />
            <p className="mt-4 text-base font-semibold text-zinc-100">
              No screen sharing has started yet.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              The tutor’s shared screen will appear here once sharing starts.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl">
          <p className="text-sm text-zinc-400">Session not found or no access.</p>
          <Link
            to="/app"
            className="mt-4 inline-flex rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-[#0B0F19] text-white">
      {isPortraitMobile ? (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-6 md:hidden">
          <div className="max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center shadow-2xl">
            <p className="text-lg font-semibold text-zinc-100">Rotate your device</p>
            <p className="mt-2 text-sm text-zinc-400">
              This tutoring room is best viewed in landscape so the board or shared screen can fill the page clearly.
            </p>
          </div>
        </div>
      ) : null}

      <HiddenMediaMounts
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        remoteScreenVideoRef={role === 'student' ? null : remoteScreenVideoRef}
      />

      <div className="relative h-full w-full">
        {role === 'tutor' ? renderTutorStage() : renderStudentStage()}

        <div
          className={`absolute z-30 ${
            role === 'student' ? 'bottom-4 left-4' : 'bottom-4 left-4 top-4 flex items-center'
          } ${
            role === 'student'
              ? showStudentOverlay
                ? 'opacity-100'
                : 'pointer-events-none opacity-0'
              : 'opacity-100'
          } transition-opacity duration-200`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-2 rounded-[24px] border border-white/10 bg-[#161b25]/88 p-2 shadow-2xl backdrop-blur-md">
            <RailButton
              onClick={toggleMute}
              icon={isMuted ? MicOff : Mic}
              label={isMuted ? 'Unmute' : 'Mute'}
              disabled={!rtcRef.current}
              active={!isMuted}
              compact={controlsCompact}
            />

            {role === 'tutor' ? (
              <RailButton
                onClick={shareScreen}
                icon={MonitorUp}
                label={isLocalScreenSharing ? 'Stop share' : 'Share screen'}
                disabled={!rtcRef.current}
                active={isLocalScreenSharing}
                compact={controlsCompact}
              />
            ) : null}

            <RailButton
              onClick={cancelCurrentClass}
              icon={X}
              label="Cancel"
              compact={controlsCompact}
            />

            {role === 'tutor' || role === 'student' ? (
              <RailButton
                onClick={endCurrentSession}
                icon={PhoneOff}
                label={role === 'student' ? 'End session' : 'End class'}
                danger
                compact={controlsCompact}
              />
            ) : null}
          </div>
        </div>

        {role === 'student' && !rtcRef.current && session.status === SESSION_STATUS.WAITING_STUDENT ? (
          <div
            className={`absolute bottom-4 right-4 z-30 transition-opacity duration-200 ${
              showStudentOverlay ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <button
              onClick={() => initializeCall({ shouldJoinStudent: true })}
              disabled={isBusy || rtcInitStartedRef.current}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-2xl transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              {isBusy ? 'Joining...' : 'Join now'}
            </button>
          </div>
        ) : null}
      </div>

      {needsRating ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[32px] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-300" />
              <p className="text-lg font-semibold text-zinc-100">Rate this session</p>
            </div>

            <div className="mt-5 grid gap-4">
              <p className="text-sm text-zinc-300">Overall rating</p>
              <div className="flex items-center gap-2" role="radiogroup" aria-label="Overall rating">
                {[1, 2, 3, 4, 5].map((starValue) => (
                  <button
                    key={starValue}
                    type="button"
                    role="radio"
                    aria-checked={Number(ratingForm.overall) === starValue}
                    aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
                    disabled={isSaving}
                    onClick={() => {
                      setRatingForm({ overall: String(starValue) });
                      submitRating(starValue);
                    }}
                    className="text-4xl leading-none transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className={starValue <= Number(ratingForm.overall) ? 'text-amber-300' : 'text-zinc-600'}>★</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => markRatingHandled(session.id)}
                  disabled={isSaving}
                  className="rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-50"
                >
                  Close
                </button>
                <p className="text-xs font-semibold text-zinc-400">
                  {isSaving ? 'Saving rating...' : 'Tap a star to submit automatically.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
