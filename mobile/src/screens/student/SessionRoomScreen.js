import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudentRtcSessionView } from '../../components/student/StudentRtcSessionView';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { getFirebaseClients, getFunctionEndpoint } from '../../firebase/config';
import {
  endSession,
  finalizeSessionClosure,
  joinSessionAsStudent,
  subscribeToSessionById,
  updateSession,
} from '../../services/sessionService';

function useLiveSeconds(startAt) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startAt) return 0;
  return Math.max(0, Math.floor((now - Number(startAt)) / 1000));
}

function useBillableSeconds(session, isBillableActive) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const accumulatedSeconds = Math.max(0, Number(session?.billedSeconds || 0));
  const activeStartedAt = Number(session?.billingStartedAt || 0);
  if (!isBillableActive || !activeStartedAt) return accumulatedSeconds;

  return accumulatedSeconds + Math.max(0, Math.floor((now - activeStartedAt) / 1000));
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, '0');
  const remainingSeconds = Math.floor(safeSeconds % 60).toString().padStart(2, '0');
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${minutes}:${remainingSeconds}`;
  return `${minutes}:${remainingSeconds}`;
}

function StageBadge({ children, tone = 'default', icon = null }) {
  return (
    <View style={[
      styles.badge,
      tone === 'success' && styles.badgeSuccess,
      tone === 'warning' && styles.badgeWarning,
      tone === 'danger' && styles.badgeDanger,
      tone === 'info' && styles.badgeInfo,
    ]}
    >
      <View style={styles.badgeInner}>
        {icon ? (
          <Ionicons
            color={
              tone === 'success'
                ? '#047857'
                : tone === 'warning'
                  ? '#b45309'
                  : tone === 'danger'
                    ? '#be123c'
                    : tone === 'info'
                      ? '#0369a1'
                      : '#27272a'
            }
            name={icon}
            size={13}
          />
        ) : null}
        <Text style={[
          styles.badgeText,
          tone === 'success' && styles.badgeTextSuccess,
          tone === 'warning' && styles.badgeTextWarning,
          tone === 'danger' && styles.badgeTextDanger,
          tone === 'info' && styles.badgeTextInfo,
        ]}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

function RailIconButton({ icon, label, onPress, active = false, danger = false }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.railIconButton,
        active && styles.railIconButtonActive,
        danger && styles.railIconButtonDanger,
      ]}
    >
      <Ionicons
        color={danger ? '#ffffff' : (active ? '#047857' : '#27272a')}
        name={icon}
        size={19}
      />
    </Pressable>
  );
}

export function SessionRoomScreen({ route, navigate, goBack }) {
  const { user } = useAuth();
  const { height, width } = useWindowDimensions();
  const isPortraitMobile = height > width;

  const bridgeRef = useRef(null);
  const joinAttemptedRef = useRef(false);
  const extensionPromptShownRef = useRef(false);
  const autoEndingRef = useRef(false);
  const controlsTimeoutRef = useRef(null);
  const terminalRedirectedRef = useRef(false);

  const sessionId = route?.params?.sessionId || '';
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idToken, setIdToken] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [showStudentControls, setShowStudentControls] = useState(true);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [hasAcceptedExtension, setHasAcceptedExtension] = useState(false);
  const [graceEndsAtMs, setGraceEndsAtMs] = useState(null);
  const [rtcState, setRtcState] = useState({
    connectionMessage: 'Connecting...',
    networkError: '',
    isMuted: false,
    isPeerConnected: false,
    isRemoteScreenSharing: false,
    hasLiveRemoteScreenTrack: false,
  });

  const iceEndpoint = getFunctionEndpoint('getIceConfig');
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'parakleo';
  const selectedDurationMinutes = Number(session?.durationMinutes || session?.pricingSnapshot?.durationMinutes || 0);
  const selectedDurationSeconds = Math.max(0, Math.round(selectedDurationMinutes * 60));
  const graceRemaining = Math.max(0, Math.ceil(((session?.joinGraceEndsAt || 0) - Date.now()) / 1000));
  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const isStudentBillableActive = session?.status === 'in_progress'
    && rtcState.isPeerConnected
    && rtcState.isRemoteScreenSharing
    && rtcState.hasLiveRemoteScreenTrack;
  const billedSeconds = useBillableSeconds(session, isStudentBillableActive);
  const extensionGraceRemainingSeconds = hasAcceptedExtension && graceEndsAtMs
    ? Math.max(0, Math.ceil((graceEndsAtMs - Date.now()) / 1000))
    : 0;

  const connectionTone = useMemo(() => {
    const networkError = String(rtcState.networkError || '');
    const connectionMessage = String(rtcState.connectionMessage || '');
    if (networkError) return 'danger';
    if (!connectionMessage) return 'default';
    if (connectionMessage.toLowerCase().includes('connected') || connectionMessage.toLowerCase().includes('live')) {
      return 'success';
    }
    return 'info';
  }, [rtcState.connectionMessage, rtcState.networkError]);

  useEffect(() => subscribeToSessionById(
    sessionId,
    (item) => {
      setSession(item);
      setLoading(false);
    },
    (nextError) => {
      setError(nextError.message || 'Unable to load this session right now.');
      setLoading(false);
    },
  ), [sessionId]);

  useEffect(() => {
    let active = true;
    getFirebaseClients().auth.currentUser?.getIdToken?.()
      .then((token) => {
        if (active) setIdToken(token || '');
      })
      .catch(() => {
        if (active) setIdToken('');
      });
    return () => {
      active = false;
    };
  }, [session?.id, user?.uid]);

  useEffect(() => {
    joinAttemptedRef.current = false;
    setShowStudentControls(true);
    setHasAcceptedExtension(false);
    setGraceEndsAtMs(null);
    extensionPromptShownRef.current = false;
    autoEndingRef.current = false;
  }, [session?.id]);

  useEffect(() => {
    if (!session?.id) return;
    if (session.status !== 'waiting_student') return;
    if (joinAttemptedRef.current) return;

    joinAttemptedRef.current = true;
    const defaultMethod = (user?.paymentMethods || []).find((method) => method?.isDefault)
      || user?.paymentMethods?.[0]
      || null;

    joinSessionAsStudent(session, defaultMethod?.id || '', defaultMethod?.last4 || '')
      .catch((joinError) => {
        setError(joinError.message || 'Unable to join this session.');
        joinAttemptedRef.current = false;
      });
  }, [session, user?.paymentMethods]);

  useEffect(() => {
    if (!session?.id) return;
    if (!['waiting_student', 'in_progress'].includes(session.status)) return;

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

    syncBillableClock().catch((billingError) => {
      setError(billingError.message || 'Unable to update billable time.');
    });
  }, [
    isStudentBillableActive,
    session?.billingStartedAt,
    session?.billedSeconds,
    session?.id,
    session?.status,
  ]);

  useEffect(() => {
    if (!session) return;
    if (session.status !== 'in_progress') return;
    if (!selectedDurationSeconds || !session.billingStartedAt) return;

    const warningThreshold = Math.max(0, selectedDurationSeconds - 60);
    if (!extensionPromptShownRef.current && billedSeconds >= warningThreshold) {
      extensionPromptShownRef.current = true;
      Alert.alert(
        'Add a 2-minute grace period?',
        'Your selected lesson time is almost up. Continue and get a 2-minute grace period?',
        [
          { text: 'Keep locked time', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              setHasAcceptedExtension(true);
              setGraceEndsAtMs(Date.now() + (Math.max(0, selectedDurationSeconds + 120 - billedSeconds) * 1000));
            },
          },
        ],
      );
    }

    if (!hasAcceptedExtension && billedSeconds >= selectedDurationSeconds && !autoEndingRef.current) {
      autoEndingRef.current = true;
      endSession(session).catch((nextError) => {
        autoEndingRef.current = false;
        setError(nextError.message || 'Unable to end session at selected time.');
      });
    }
  }, [billedSeconds, hasAcceptedExtension, selectedDurationSeconds, session]);

  useEffect(() => () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (bridgeRef.current) {
      if (typeof bridgeRef.current.close === 'function') {
        bridgeRef.current.close();
      } else {
        bridgeRef.current.injectJavaScript?.('window.ParakleoSessionBridge && window.ParakleoSessionBridge.close && window.ParakleoSessionBridge.close(); true;');
      }
    }
  }, []);

  const revealStudentControls = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowStudentControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowStudentControls(false);
    }, 5000);
  }, []);

  const handleBridgeMessage = (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload.type === 'rtc_state') {
        setRtcState((prev) => ({
          ...prev,
          ...(payload.payload || {}),
        }));
        return;
      }

      if (payload.type === 'log') {
        const message = payload?.payload?.message || 'RTC bridge log';
        const detail = payload?.payload?.error ? ` (${payload.payload.error})` : '';
        // Surface WebView RTC diagnostics in Metro/device logs for debugging.
        // eslint-disable-next-line no-console
        console.log(`[StudentRtcBridge] ${message}${detail}`);
      }
    } catch {
      // Ignore malformed bridge messages from the WebView.
    }
  };

  const handleToggleMute = () => {
    if (typeof bridgeRef.current?.toggleAudio === 'function') {
      bridgeRef.current.toggleAudio();
      return;
    }
    bridgeRef.current?.injectJavaScript?.('window.ParakleoSessionBridge && window.ParakleoSessionBridge.toggleAudio && window.ParakleoSessionBridge.toggleAudio(); true;');
  };

  const closeRtcBridge = () => {
    if (typeof bridgeRef.current?.close === 'function') {
      bridgeRef.current.close();
      return;
    }
    bridgeRef.current?.injectJavaScript?.('window.ParakleoSessionBridge && window.ParakleoSessionBridge.close && window.ParakleoSessionBridge.close(); true;');
  };

  const navigateToRequestStatus = useCallback((requestId) => {
    if (requestId) {
      navigate({ key: 'RequestStatus', params: { requestId, parentTab: 'Requests' } });
      return;
    }
    goBack('Sessions');
  }, [goBack, navigate]);

  const handleOpenCancel = () => {
    setCancelError('');
    setCancelReason('');
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    const trimmedReason = String(cancelReason || '').trim();
    if (!trimmedReason) {
      setCancelError('Please enter a cancellation reason before canceling the class.');
      return;
    }
    if (!session?.id || actionBusy) return;

    setActionBusy(true);
    try {
      closeRtcBridge();
      await finalizeSessionClosure(session, {
        closureType: 'canceled_during',
        canceledBy: 'student',
        canceledReason: trimmedReason,
      });
      setIsCancelOpen(false);
      navigateToRequestStatus(session?.requestId || '');
    } catch (nextError) {
      setCancelError(nextError.message || 'Unable to cancel this class.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleEndSession = async () => {
    if (!session?.id || actionBusy) return;
    setActionBusy(true);
    try {
      closeRtcBridge();
      await endSession(session);
      navigateToRequestStatus(session?.requestId || '');
    } catch (nextError) {
      setError(nextError.message || 'Unable to end this class.');
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    if (!session?.id) return;
    const normalizedStatus = String(session.status || '').toLowerCase();
    if (!['completed', 'canceled', 'canceled_during'].includes(normalizedStatus)) return;
    if (terminalRedirectedRef.current) return;

    terminalRedirectedRef.current = true;
    closeRtcBridge();
    navigateToRequestStatus(session?.requestId || '');
  }, [session?.id, session?.requestId, session?.status, navigateToRequestStatus]);

  const handleJoinNow = async () => {
    if (!session || actionBusy) return;
    const defaultMethod = (user?.paymentMethods || []).find((method) => method?.isDefault)
      || user?.paymentMethods?.[0]
      || null;
    setActionBusy(true);
    try {
      await joinSessionAsStudent(session, defaultMethod?.id || '', defaultMethod?.last4 || '');
    } catch (nextError) {
      setError(nextError.message || 'Unable to join this session.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading session room" />;
  if (error && !session) return <ErrorState message={error} />;
  if (!session) return <ErrorState title="Session not found" message="Session not found or no access." />;

  const connectionCopy = rtcState.connectionMessage || 'Connecting...';
  const showOverlay = showStudentControls;

  return (
    <View style={styles.safe}>
      <View style={styles.root}>
        {isPortraitMobile ? (
          <View style={styles.rotateOverlay}>
            <Card style={styles.rotateCard}>
              <Text style={styles.rotateTitle}>Rotate your device</Text>
              <Text style={styles.rotateCopy}>
                This tutoring room is best viewed in landscape so the board or shared screen can fill the page clearly.
              </Text>
            </Card>
          </View>
        ) : null}

        <Pressable onPress={revealStudentControls} style={styles.stage}>
          {session.status === 'in_progress' && idToken ? (
            <StudentRtcSessionView
              bridgeRef={bridgeRef}
              iceEndpoint={iceEndpoint}
              idToken={idToken}
              onBridgeMessage={handleBridgeMessage}
              projectId={projectId}
              sessionId={session.id}
            />
          ) : (
            <View style={styles.stageFallback}>
              <Card style={styles.fallbackCard}>
                <Text style={styles.fallbackTitle}>No screen sharing has started yet.</Text>
                <Text style={styles.fallbackCopy}>
                  The tutor&apos;s shared screen will appear here once sharing starts.
                </Text>
              </Card>
            </View>
          )}

          <View style={[styles.topOverlay, !showOverlay && styles.hiddenOverlay]}>
            <View style={styles.badgeWrap}>
              <StageBadge icon="time-outline">Call length {formatDuration(callSeconds)}</StageBadge>
              <StageBadge icon="cash-outline" tone={isStudentBillableActive ? 'success' : 'warning'}>
                Billable {formatDuration(billedSeconds)}
              </StageBadge>
              <StageBadge icon="wifi-outline" tone={connectionTone}>
                {connectionCopy}
              </StageBadge>
              <StageBadge
                icon={rtcState.networkError ? 'alert-circle-outline' : (rtcState.isRemoteScreenSharing ? 'desktop-outline' : 'hourglass-outline')}
                tone={rtcState.networkError ? 'danger' : (rtcState.isRemoteScreenSharing ? 'success' : 'warning')}
              >
                {rtcState.networkError
                  ? 'Connection issue'
                  : rtcState.isRemoteScreenSharing
                    ? 'Screen live'
                    : 'Waiting for tutor to share'}
              </StageBadge>
              {session.status === 'waiting_student' ? (
                <StageBadge icon="time-outline" tone="warning">Join window {graceRemaining}s</StageBadge>
              ) : null}
              {hasAcceptedExtension ? (
                <StageBadge icon="time-outline" tone={extensionGraceRemainingSeconds > 0 ? 'success' : 'info'}>
                  {extensionGraceRemainingSeconds > 0
                    ? `Grace period ${extensionGraceRemainingSeconds}s`
                    : 'Overtime billed at locked rate'}
                </StageBadge>
              ) : null}
            </View>
          </View>

          <View style={[styles.controlsRailWrap, !showOverlay && styles.hiddenOverlay]}>
            <View style={styles.controlsRail}>
              <RailIconButton
                active={!rtcState.isMuted}
                icon={rtcState.isMuted ? 'mic-off-outline' : 'mic-outline'}
                label={rtcState.isMuted ? 'Unmute' : 'Mute'}
                onPress={handleToggleMute}
              />
              <RailIconButton icon="close-outline" label="Cancel" onPress={handleOpenCancel} />
              <RailIconButton danger icon="call-outline" label={actionBusy ? 'Working' : 'End session'} onPress={handleEndSession} />
            </View>
          </View>

          {session.status === 'waiting_student' ? (
            <View style={[styles.joinNowWrap, !showOverlay && styles.hiddenOverlay]}>
              <Button disabled={actionBusy} onPress={handleJoinNow} style={styles.joinNowButton}>
                {actionBusy ? 'Joining...' : 'Join now'}
              </Button>
            </View>
          ) : null}
        </Pressable>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {isCancelOpen ? (
          <View style={styles.modalOverlay}>
            <Card style={styles.modalCard}>
              <Text style={styles.modalTitle}>Cancel this class</Text>
              <Text style={styles.modalCopy}>Please tell us why you want to cancel this class.</Text>
              <TextInput
                multiline
                numberOfLines={4}
                onChangeText={setCancelReason}
                placeholder="Enter cancellation reason"
                style={styles.modalInput}
                textAlignVertical="top"
                value={cancelReason}
              />
              {cancelError ? <Text style={styles.modalError}>{cancelError}</Text> : null}
              <View style={styles.modalActions}>
                <Button onPress={() => setIsCancelOpen(false)} style={styles.modalButton} variant="secondary">
                  Keep class open
                </Button>
                <Button disabled={actionBusy} onPress={handleConfirmCancel} style={styles.modalButton}>
                  {actionBusy ? 'Canceling...' : 'Confirm cancel'}
                </Button>
              </View>
            </Card>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  root: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  stage: {
    backgroundColor: '#000000',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  stageFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackCard: {
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  fallbackTitle: {
    color: '#18181b',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackCopy: {
    color: '#52525b',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  topOverlay: {
    left: 72,
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 20,
  },
  hiddenOverlay: {
    opacity: 0,
  },
  badgeWrap: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(228,228,231,1)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
  },
  badge: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  badgeSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  badgeWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  badgeDanger: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  badgeInfo: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  badgeText: {
    color: '#27272a',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextSuccess: {
    color: '#047857',
  },
  badgeTextWarning: {
    color: '#b45309',
  },
  badgeTextDanger: {
    color: '#be123c',
  },
  badgeTextInfo: {
    color: '#0369a1',
  },
  controlsRailWrap: {
    bottom: 16,
    left: 16,
    position: 'absolute',
    zIndex: 30,
  },
  controlsRail: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#e4e4e7',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 8,
  },
  railIconButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  railIconButtonActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  railIconButtonDanger: {
    backgroundColor: '#f43f5e',
    borderColor: '#f43f5e',
  },
  joinNowWrap: {
    bottom: 16,
    position: 'absolute',
    right: 16,
    zIndex: 30,
  },
  joinNowButton: {
    borderRadius: 16,
    minHeight: 46,
    paddingHorizontal: 18,
  },
  errorBanner: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '600',
  },
  rotateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 70,
  },
  rotateCard: {
    maxWidth: 360,
    width: '100%',
  },
  rotateTitle: {
    color: '#18181b',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  rotateCopy: {
    color: '#52525b',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
    zIndex: 120,
  },
  modalCard: {
    gap: 12,
    maxWidth: 460,
    width: '100%',
  },
  modalTitle: {
    color: '#18181b',
    fontSize: 24,
    fontWeight: '900',
  },
  modalCopy: {
    color: '#52525b',
    fontSize: 14,
    lineHeight: 20,
  },
  modalInput: {
    borderColor: '#d4d4d8',
    borderRadius: 12,
    borderWidth: 1,
    color: '#18181b',
    minHeight: 110,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  modalError: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    flex: 1,
  },
});
