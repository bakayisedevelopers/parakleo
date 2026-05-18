import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { useClassRequest } from '../../hooks/useClassRequests';
import { useStudentSessions, useTutorSessions } from '../../hooks/useSessions';
import { SESSION_STATUS } from '../../constants/lifecycle';
import {
  dismissSessionRating,
  endSession,
  finalizeSessionClosure,
  joinSessionAsStudent,
  submitSessionRating,
  updateSession,
} from '../../services/sessionService';
import { createWebRtcSessionController } from '../../services/webrtcService';
import { fetchIceServers } from '../../services/iceServerService';
import { debugLog } from '../../utils/devLogger';
import { parseQuestionsFromExtraction, parseQuestionsFromGptExtraction } from '../../services/questionParsingService';
import { prepareWhiteboardLayout } from '../../services/whiteboardPreparationService';

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

function useBillableSeconds(session, isActive) {
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const accumulatedSeconds = Math.max(0, Number(session?.billedSeconds || 0));
  const activeStartedAt = Number(session?.billingStartedAt || 0);
  if (!isActive || !activeStartedAt) return accumulatedSeconds;

  return accumulatedSeconds + Math.max(0, Math.floor((tick - activeStartedAt) / 1000));
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
    default: 'border-zinc-200 bg-white text-zinc-800',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
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
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100';

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
  const role = String(user?.activeRole || user?.role || 'student').toLowerCase() === 'tutor' ? 'tutor' : 'student';
  const { sessions: studentSessions } = useStudentSessions(user?.uid);
  const { sessions: tutorSessions } = useTutorSessions(user?.uid);
  const sessions = role === 'tutor' ? tutorSessions : studentSessions;
  const session = sessions.find((item) => item.id === id);
  const { request } = useClassRequest(session?.requestId || '');

  const [ratingForm, setRatingForm] = useState({ overall: '5' });
  const [isSaving, setIsSaving] = useState(false);
  const [isRatingPromptOpen, setIsRatingPromptOpen] = useState(false);
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
  const [isPeerConnected, setIsPeerConnected] = useState(false);
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
  const autoScreenShareAttemptedRef = useRef(false);
  const connectionStartRecordedRef = useRef(false);
  const activeInitKeyRef = useRef('');
  const rtcInitStartedRef = useRef(false);
  const hadSessionRef = useRef(false);
  const studentControlsTimeoutRef = useRef(null);
  const autoEndingRef = useRef(false);
  const boardContentLoadedRef = useRef(false);
  const boardEditorRef = useRef(null);
  const previousStatusRef = useRef(null);

  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const hasLiveRemoteScreenTrack = Boolean(
    remoteScreenStreamObj
      ?.getVideoTracks?.()
      ?.some((track) => track.readyState === 'live'),
  );
  const isStudentBillableActive = role === 'student'
    && session?.status === SESSION_STATUS.IN_PROGRESS
    && isPeerConnected
    && isRemoteScreenSharing
    && hasLiveRemoteScreenTrack;
  const billedSeconds = useBillableSeconds(session, isStudentBillableActive);
  const ratingStatus = session?.ratingStatus?.[role] || 'pending';
  const needsRating = Boolean(session?.id)
    && isRatingPromptOpen
    && RATABLE_STATUSES.has(session?.status)
    && ratingStatus === 'pending';
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

  const navigateAfterRatingFlow = useCallback(() => {
    if (role === 'student') {
      navigate('/app/student', { replace: true });
      return;
    }

    navigate('/app/tutor', { replace: true });
  }, [navigate, role]);

  useEffect(() => {
    if (session) {
      hadSessionRef.current = true;
    }
  }, [session]);

  useEffect(() => {
    autoJoinAttemptedRef.current = false;
    autoScreenShareAttemptedRef.current = false;
    connectionStartRecordedRef.current = false;
    activeInitKeyRef.current = '';
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(true);
    setIsPeerConnected(false);
    setHasAcceptedExtension(false);
    setGraceEndsAtMs(null);
    extensionPromptShownRef.current = false;
    autoEndingRef.current = false;
    boardContentLoadedRef.current = false;
    previousStatusRef.current = session?.status || null;
    setIsRatingPromptOpen(false);
  }, [session?.id, role]);

  const getSessionBoardSeedContent = useCallback(() => {
    const boardPreparationSource = session?.boardPreparationSource || request?.boardPreparationSource || null;
    const attachmentExtractions = boardPreparationSource?.attachmentExtractions || [];
    const extractedFromAttachments = attachmentExtractions
      .map((entry) => String(entry?.extractedText || entry?.text || '').trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();
    const gptExtraction = boardPreparationSource?.gptExtraction || null;
    const attachments = session?.attachments
      || request?.attachments
      || (session?.requestAttachment ? [session.requestAttachment] : [])
      || (request?.attachment ? [request.attachment] : []);
    const extractedText = boardPreparationSource?.extractedText
      || extractedFromAttachments
      || session?.requestDescription
      || request?.description
      || session?.topic
      || request?.topic
      || '';
    const ocrImageReferences = boardPreparationSource?.ocrImageReferences || [];

    debugLog('sessionRoom', '[whiteboardPreparation] board source resolved.', {
      sessionId: session?.id || null,
      requestId: session?.requestId || request?.id || null,
      sourceOnSession: Boolean(session?.boardPreparationSource),
      sourceOnRequest: Boolean(request?.boardPreparationSource),
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
      attachmentExtractionCount: Array.isArray(attachmentExtractions) ? attachmentExtractions.length : 0,
      extractedTextLength: String(extractedText || '').trim().length,
      ocrImageReferenceCount: Array.isArray(ocrImageReferences) ? ocrImageReferences.length : 0,
    });

    return {
      extractedText,
      attachments,
      attachmentExtractions,
      ocrImageReferences,
      gptExtraction,
    };
  }, [request, session]);

  const injectPreparedBoardContent = useCallback(async (editor) => {
    if (!editor || boardContentLoadedRef.current || role !== 'tutor') return;

    const {
      extractedText,
      attachments,
      attachmentExtractions,
      ocrImageReferences,
      gptExtraction,
    } = getSessionBoardSeedContent();
    if (!String(extractedText || '').trim() && !(attachments || []).length) {
      debugLog('sessionRoom', '[whiteboardPreparation] skipped injection because no board source data was available.', {
        sessionId: session?.id || null,
      });
      return;
    }

    try {
      const { AssetRecordType, createShapeId, toRichText } = await import('tldraw');
      const parsedQuestions = gptExtraction
        ? parseQuestionsFromGptExtraction({
            gptExtraction,
            attachments,
          })
        : parseQuestionsFromExtraction({
            extractedText,
            attachments,
            attachmentExtractions,
            ocrImageReferences,
          });
      const layout = prepareWhiteboardLayout(parsedQuestions);

      debugLog('sessionRoom', '[whiteboardPreparation] parsing finished.', {
        sessionId: session?.id || null,
        questionCount: parsedQuestions.length,
        layoutCount: layout.length,
      });

      const assets = [];
      const shapes = [];

      layout.forEach((item, index) => {
        if (item.type === 'text') {
          shapes.push({
            id: createShapeId(),
            type: 'text',
            parentId: editor.getCurrentPageId(),
            x: item.position.x,
            y: item.position.y,
            props: {
              richText: toRichText(item.content),
              autoSize: false,
              w: item.width || 900,
              size: 'm',
              font: 'sans',
              textAlign: 'start',
              scale: 1,
            },
          });
          return;
        }

        if (item.type === 'file' && item.url) {
          const assetId = AssetRecordType.createId();
          assets.push({
            id: assetId,
            type: 'bookmark',
            typeName: 'asset',
            props: {
              title: item.fileName || `Uploaded file ${index + 1}`,
              description: item.mimeType || 'Original uploaded file',
              image: '',
              favicon: '',
              src: item.url,
            },
            meta: {},
          });

          shapes.push({
            id: createShapeId(),
            type: 'bookmark',
            parentId: editor.getCurrentPageId(),
            x: item.position.x,
            y: item.position.y,
            props: {
              assetId,
              url: item.url,
              w: item.width || 420,
              h: item.height || 160,
            },
          });
          return;
        }

        if (item.type === 'image' && item.src) {
          const assetId = AssetRecordType.createId();
          assets.push({
            id: assetId,
            type: 'image',
            typeName: 'asset',
            props: {
              name: `Question image ${index + 1}`,
              src: item.src,
              mimeType: item.mimeType || 'image/png',
              w: item.width || 800,
              h: item.height || 600,
              isAnimated: false,
            },
            meta: {},
          });

          shapes.push({
            id: createShapeId(),
            type: 'image',
            parentId: editor.getCurrentPageId(),
            x: item.position.x,
            y: item.position.y,
            props: {
              assetId,
              w: item.width || 420,
              h: item.height || 320,
            },
          });
        }
      });

      if (assets.length) {
        editor.createAssets(assets);
      }
      if (shapes.length) {
        editor.createShapes(shapes);
      }

      if (shapes.length && typeof editor.setCamera === 'function') {
        editor.setCamera({ x: 80, y: 80, z: 1 }, { immediate: true });
      }

      boardContentLoadedRef.current = true;
      debugLog('sessionRoom', '[whiteboardPreparation] board injection completed.', {
        sessionId: session?.id || null,
        insertedAssetCount: assets.length,
        insertedShapeCount: shapes.length,
        createdElementCount: assets.length + shapes.length,
      });
    } catch (error) {
      debugLog('sessionRoom', '[whiteboardPreparation] board injection failed.', {
        sessionId: session?.id || null,
        message: error?.message,
      });
    }
  }, [getSessionBoardSeedContent, role, session?.id]);

  const handleBoardMount = useCallback((editor) => {
    boardEditorRef.current = editor;
    debugLog('sessionRoom', '[whiteboardPreparation] tldraw editor mounted.', {
      sessionId: session?.id || null,
      role,
    });
  }, [role, session?.id]);

  useEffect(() => {
    if (!boardEditorRef.current) return;
    injectPreparedBoardContent(boardEditorRef.current).catch((error) => {
      debugLog('sessionRoom', '[whiteboardPreparation] board injection effect failed.', {
        sessionId: session?.id || null,
        message: error?.message,
      });
    });
  }, [injectPreparedBoardContent, request?.boardPreparationSource, session?.boardPreparationSource, session?.id]);

  useEffect(() => {
    if (!session?.id) return;

    const previousStatus = previousStatusRef.current;
    const currentStatus = session.status;
    const movedIntoTerminalState = previousStatus
      && previousStatus !== currentStatus
      && !RATABLE_STATUSES.has(previousStatus)
      && RATABLE_STATUSES.has(currentStatus);

    if (movedIntoTerminalState && ratingStatus === 'pending') {
      setRatingForm({ overall: '5' });
      setIsRatingPromptOpen(true);
    }

    if (ratingStatus !== 'pending' || !RATABLE_STATUSES.has(currentStatus)) {
      setIsRatingPromptOpen(false);
    }

    previousStatusRef.current = currentStatus;
  }, [ratingStatus, session?.id, session?.status]);

  useEffect(() => {
    if (role !== 'student') return;
    if (!session?.id) return;
    if (![SESSION_STATUS.WAITING_STUDENT, SESSION_STATUS.IN_PROGRESS].includes(session.status)) return;

    const syncBillableClock = async () => {
      const accumulatedSeconds = Math.max(0, Number(session.billedSeconds || 0));
      const activeStartedAt = Number(session.billingStartedAt || 0);

      if (isStudentBillableActive) {
        if (activeStartedAt) return;

        await updateSession(session.id, {
          billingStartedAt: Date.now(),
          billedSeconds: accumulatedSeconds,
        });
        return;
      }

      if (!activeStartedAt) return;

      const nextBilledSeconds = accumulatedSeconds + Math.max(0, Math.floor((Date.now() - activeStartedAt) / 1000));
      await updateSession(session.id, {
        billingStartedAt: null,
        billedSeconds: nextBilledSeconds,
      });
    };

    syncBillableClock().catch((error) => {
      setNetworkError(error.message || 'Unable to update billable time.');
    });
  }, [
    isStudentBillableActive,
    role,
    session?.billingStartedAt,
    session?.billedSeconds,
    session?.id,
    session?.status,
  ]);

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
    debugLog('sessionRoom', '[parakleo:screen:ui] remote screen srcObject effect.', {
      hasVideoElement: Boolean(videoEl),
      hasStream: Boolean(remoteScreenStreamObj),
      hadPreviousSrcObject: Boolean(videoEl?.srcObject),
    });
    if (!videoEl) return;

    videoEl.srcObject = remoteScreenStreamObj || null;

    if (remoteScreenStreamObj) {
      debugLog('sessionRoom', '[parakleo:screen:ui] srcObject assigned.', {
        trackIds: remoteScreenStreamObj.getTracks().map((track) => track.id),
        videoTrackIds: remoteScreenStreamObj.getVideoTracks().map((track) => track.id),
      });

      const handleLoadedMetadata = async () => {
        debugLog('sessionRoom', '[parakleo:screen:ui] remote screen loadedmetadata.', {
          videoWidth: videoEl.videoWidth,
          videoHeight: videoEl.videoHeight,
          readyState: videoEl.readyState,
        });

        try {
          await videoEl.play();
          debugLog('sessionRoom', '[parakleo:screen:ui] remote screen video play succeeded.', {
            paused: videoEl.paused,
            readyState: videoEl.readyState,
            videoWidth: videoEl.videoWidth,
            videoHeight: videoEl.videoHeight,
          });
        } catch (error) {
          debugLog('sessionRoom', '[parakleo:screen:ui] remote screen video play failed.', {
            message: error?.message || String(error),
          });
        }
      };

      videoEl.onloadedmetadata = handleLoadedMetadata;
    } else {
      videoEl.onloadedmetadata = null;
      debugLog('sessionRoom', '[parakleo:screen:ui] srcObject cleared.');
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
          debugLog('sessionRoom', '[parakleo:screen:ui] onRemoteScreenStream callback.', {
            hasStream: Boolean(stream),
            streamId: stream?.id || null,
            trackIds: stream?.getTracks?.().map((track) => track.id) || [],
          });
          setRemoteScreenStreamObj(stream || null);
        },

        onScreenShareStateChange: ({ local, remote }) => {
          debugLog('sessionRoom', '[parakleo:screen:ui] onScreenShareStateChange callback.', {
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
          setIsPeerConnected(state === 'connected');
          if (state !== 'connected') return;

          if (role === 'tutor' && !autoScreenShareAttemptedRef.current) {
            autoScreenShareAttemptedRef.current = true;
            try {
              await rtcRef.current?.startScreenShare?.();
              setIsLocalScreenSharing(true);
            } catch (error) {
              debugLog('sessionRoom', 'Automatic screen share attempt failed.', {
                sessionId: session.id,
                message: error?.message || 'Unknown screen share error',
              });
            }
          }

          if (connectionStartRecordedRef.current) return;
          connectionStartRecordedRef.current = true;

          const updates = {};
          if (!session.callStartedAt) {
            updates.callStartedAt = Date.now();
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
    if (!RATABLE_STATUSES.has(session.status)) return;

    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(false);

    if (ratingStatus === 'pending') return;

    navigateAfterRatingFlow();
  }, [navigateAfterRatingFlow, ratingStatus, session?.status]);

  useEffect(() => {
    if (session) return;
    if (!hadSessionRef.current) return;

    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    setShowStudentControls(false);

    if (role === 'student') {
      navigate('/app/student', { replace: true });
      return;
    }

    navigate('/app/tutor', { replace: true });
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
  };

  const endCurrentSession = async () => {
    rtcRef.current?.close?.();
    rtcRef.current = null;
    rtcInitStartedRef.current = false;
    setRemoteScreenStreamObj(null);
    await endSession(session);
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
        setGraceEndsAtMs(Date.now() + (Math.max(0, selectedDurationSeconds + 120 - elapsedSeconds) * 1000));
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
      setIsRatingPromptOpen(false);
      navigateAfterRatingFlow();
    } finally {
      setIsSaving(false);
    }
  };

  const closeRatingPrompt = async () => {
    if (!session || isSaving) return;
    setIsSaving(true);
    try {
      await dismissSessionRating(session, role);
      setIsRatingPromptOpen(false);
      navigateAfterRatingFlow();
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

  const revealStudentControls = useCallback(() => {
    if (role !== 'student') return;

    if (studentControlsTimeoutRef.current) {
      clearTimeout(studentControlsTimeoutRef.current);
    }

    setShowStudentControls(true);
    studentControlsTimeoutRef.current = setTimeout(() => {
      setShowStudentControls(false);
    }, 5000);
  }, [role]);

  const controlsCompact = isMobileViewport;
  const showStudentOverlay = role !== 'student' || showStudentControls;
  const closeHref = role === 'tutor' ? '/app/tutor/sessions' : '/app';

  const renderTutorStageHeader = () => (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 max-w-[calc(100vw-7rem)]">
      <div className="rounded-[24px] border border-white/12 bg-black p-3 shadow-2xl backdrop-blur-md ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StageBadge icon={Clock3} className="bg-[#1b2230]/98">
            Call {formatDuration(callSeconds)}
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
      onPointerDown={(event) => {
        event.stopPropagation();
        revealStudentControls();
      }}
    >
      <div className="rounded-[22px] border border-zinc-200 bg-white/95 p-3 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge icon={Clock3}>Call length {formatDuration(callSeconds)}</StageBadge>
          <StageBadge icon={BadgeDollarSign} tone={isStudentBillableActive ? 'success' : 'warning'}>
            Billable {formatDuration(billedSeconds)}
          </StageBadge>

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
    <div className="relative h-full w-full overflow-hidden bg-white">
      {renderTutorStageHeader()}
      <div className="absolute inset-0">
        <TldrawSdkEmbed
          roomId={whiteboardRoom}
          licenseKey={tldrawLicenseKey}
          onMount={handleBoardMount}
        />
      </div>
    </div>
  );

  const renderStudentStage = () => (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      onPointerDown={revealStudentControls}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          revealStudentControls();
        }
      }}
    >
      {debugLog('sessionRoom', '[parakleo:screen:ui] renderStudentStage visibility.', {
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
          <div className="max-w-md rounded-[28px] border border-zinc-200 bg-white p-6 text-center shadow-xl backdrop-blur-md">
            <Presentation className="mx-auto h-8 w-8 text-zinc-500" />
            <p className="mt-4 text-base font-semibold text-zinc-900">
              No screen sharing has started yet.
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              The tutor’s shared screen will appear here once sharing starts.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-xl">
          <p className="text-sm text-zinc-600">Session not found or no access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-white text-zinc-900">
      {isPortraitMobile ? (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white/85 p-6 backdrop-blur-sm md:hidden">
          <div className="max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-xl">
            <p className="text-lg font-semibold text-zinc-900">Rotate your device</p>
            <p className="mt-2 text-sm text-zinc-600">
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
          onPointerDown={(event) => {
            event.stopPropagation();
            revealStudentControls();
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-2 rounded-[24px] border border-zinc-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
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
            onPointerDown={(event) => {
              event.stopPropagation();
              revealStudentControls();
            }}
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
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)]">
          <div className="min-h-screen w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col rounded-[32px] border border-zinc-200 bg-white/95 p-6 shadow-xl backdrop-blur md:p-8 lg:p-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                      <Star className="h-6 w-6 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                        Session feedback
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-zinc-900 sm:text-3xl lg:text-4xl">
                        Rate this session
                      </h2>
                    </div>
                  </div>
                  <p className="mt-5 max-w-2xl text-sm text-zinc-600 sm:text-base">
                    Tell us how this session went. Once you rate it or close this screen, it will not appear again.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeRatingPrompt}
                  disabled={isSaving}
                  aria-label="Close rating prompt"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`mt-10 flex flex-1 flex-col justify-center ${isSaving ? 'pointer-events-none' : ''}`}>
                <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-6 sm:p-8 lg:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Overall rating</p>
                  <div
                    className="mt-6 flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-5"
                    role="radiogroup"
                    aria-label="Overall rating"
                  >
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
                    className="text-[2.5rem] leading-none transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[3.25rem] lg:text-[4.5rem]"
                  >
                    <span className={starValue <= Number(ratingForm.overall) ? 'text-amber-300' : 'text-zinc-600'}>★</span>
                  </button>
                ))}
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-zinc-600">
                      {isSaving ? 'Saving rating...' : 'Tap a star to submit automatically.'}
                    </p>
                    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {isSaving ? 'Saving' : 'Ready'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
