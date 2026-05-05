import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StudentRtcSessionView } from '../../components/student/StudentRtcSessionView';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { getFirebaseClients, getFunctionEndpoint } from '../../firebase/config';
import { subscribeToRequestById } from '../../services/classRequestService';
import {
  endSession,
  finalizeSessionClosure,
  joinSessionAsStudent,
  subscribeToSessionById,
  updateSession,
} from '../../services/sessionService';
import { colors } from '../../theme/colors';
import { formatRand } from '../../utils/pricing';
import { getSessionStatusMeta } from '../../utils/sessionStatus';

function useLiveSeconds(startAt) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startAt) {
    return 0;
  }

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

  if (!isBillableActive || !activeStartedAt) {
    return accumulatedSeconds;
  }

  return accumulatedSeconds + Math.max(0, Math.floor((now - activeStartedAt) / 1000));
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, '0');
  const remainingSeconds = Math.floor(safeSeconds % 60).toString().padStart(2, '0');

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${minutes}:${remainingSeconds}`;
  }

  return `${minutes}:${remainingSeconds}`;
}

function FloatingBadge({ children, tone = 'default' }) {
  return (
    <View style={[
      styles.floatingBadge,
      tone === 'success' && styles.floatingBadgeSuccess,
      tone === 'warning' && styles.floatingBadgeWarning,
      tone === 'danger' && styles.floatingBadgeDanger,
    ]}
    >
      <Text style={[
        styles.floatingBadgeText,
        tone === 'success' && styles.floatingBadgeTextSuccess,
        tone === 'warning' && styles.floatingBadgeTextWarning,
        tone === 'danger' && styles.floatingBadgeTextDanger,
      ]}
      >
        {children}
      </Text>
    </View>
  );
}

function AttachmentButtons({ attachments }) {
  if (!attachments.length) {
    return (
      <Text style={styles.metaCopy}>No uploaded attachments were linked to this request.</Text>
    );
  }

  return (
    <View style={styles.attachmentList}>
      {attachments.map((attachment, index) => (
        <Button
          key={`${attachment?.fileName || 'attachment'}-${index}`}
          onPress={() => attachment?.downloadUrl && Linking.openURL(attachment.downloadUrl).catch(() => null)}
          style={styles.attachmentButton}
          variant="secondary"
        >
          {attachment?.fileName || `Attachment ${index + 1}`}
        </Button>
      ))}
    </View>
  );
}

export function SessionRoomScreen({ route, navigate, goBack }) {
  const { user } = useAuth();
  const { height, width } = useWindowDimensions();
  const bridgeRef = useRef(null);
  const joinAttemptedRef = useRef(false);
  const extensionPromptShownRef = useRef(false);
  const autoEndingRef = useRef(false);

  const sessionId = route?.params?.sessionId || '';
  const [session, setSession] = useState(null);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idToken, setIdToken] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [hasAcceptedExtension, setHasAcceptedExtension] = useState(false);
  const [graceEndsAtMs, setGraceEndsAtMs] = useState(null);
  const [rtcState, setRtcState] = useState({
    connectionMessage: 'Preparing live class...',
    networkError: '',
    isMuted: false,
    isPeerConnected: false,
    isRemoteScreenSharing: false,
    hasLiveRemoteScreenTrack: false,
  });

  const isPortrait = height > width;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'claxi-bakayise';
  const iceEndpoint = getFunctionEndpoint('getIceConfig');
  const statusMeta = getSessionStatusMeta(session?.status);
  const snapshot = session?.pricingSnapshot || request?.pricingSnapshot || null;
  const callSeconds = useLiveSeconds(session?.callStartedAt);
  const isBillableActive = session?.status === 'in_progress'
    && rtcState.isPeerConnected
    && rtcState.isRemoteScreenSharing
    && rtcState.hasLiveRemoteScreenTrack;
  const billedSeconds = useBillableSeconds(session, isBillableActive);
  const selectedDurationMinutes = Number(
    session?.durationMinutes
    || session?.pricingSnapshot?.durationMinutes
    || request?.durationMinutes
    || request?.pricingSnapshot?.durationMinutes
    || 0,
  );
  const selectedDurationSeconds = Math.max(0, Math.round(selectedDurationMinutes * 60));
  const extensionGraceRemainingSeconds = hasAcceptedExtension && graceEndsAtMs
    ? Math.max(0, Math.ceil((graceEndsAtMs - Date.now()) / 1000))
    : 0;

  const attachments = useMemo(() => {
    if (!request) {
      return [];
    }

    if (Array.isArray(request.attachments) && request.attachments.length) {
      return request.attachments;
    }

    return request.attachment?.downloadUrl ? [request.attachment] : [];
  }, [request]);

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
    if (!session?.requestId) {
      setRequest(null);
      return undefined;
    }

    return subscribeToRequestById(
      session.requestId,
      setRequest,
      () => setRequest(null),
    );
  }, [session?.requestId]);

  useEffect(() => {
    let active = true;

    getFirebaseClients().auth.currentUser?.getIdToken?.()
      .then((token) => {
        if (active) {
          setIdToken(token || '');
        }
      })
      .catch(() => {
        if (active) {
          setIdToken('');
        }
      });

    return () => {
      active = false;
    };
  }, [session?.id, user?.uid]);

  useEffect(() => {
    if (!session?.id) {
      joinAttemptedRef.current = false;
      return;
    }

    if (session.status !== 'waiting_student') {
      return;
    }

    if (joinAttemptedRef.current) {
      return;
    }

    joinAttemptedRef.current = true;

    const defaultMethod = (user?.paymentMethods || []).find((method) => method?.isDefault)
      || user?.paymentMethods?.[0]
      || null;

    joinSessionAsStudent(
      session,
      defaultMethod?.id || '',
      defaultMethod?.last4 || '',
    ).catch((joinError) => {
      setError(joinError.message || 'Unable to join this session.');
      joinAttemptedRef.current = false;
    });
  }, [session, user?.paymentMethods]);

  useEffect(() => {
    if (!session?.id || session.status !== 'in_progress') {
      return;
    }

    const syncBillingClock = async () => {
      const accumulatedSeconds = Math.max(0, Number(session.billedSeconds || 0));
      const activeStartedAt = Number(session.billingStartedAt || 0);

      if (isBillableActive) {
        if (activeStartedAt) {
          return;
        }

        await updateSession(session.id, {
          billingStartedAt: Date.now(),
          billedSeconds: accumulatedSeconds,
        });
        return;
      }

      if (!activeStartedAt) {
        return;
      }

      const nextBilledSeconds = accumulatedSeconds + Math.max(0, Math.floor((Date.now() - activeStartedAt) / 1000));
      await updateSession(session.id, {
        billingStartedAt: null,
        billedSeconds: nextBilledSeconds,
      });
    };

    syncBillingClock().catch((billingError) => {
      setError(billingError.message || 'Unable to update billable time.');
    });
  }, [
    isBillableActive,
    session?.billingStartedAt,
    session?.billedSeconds,
    session?.id,
    session?.status,
  ]);

  useEffect(() => {
    if (session?.status !== 'in_progress') {
      return;
    }

    if (!selectedDurationSeconds || !session?.billingStartedAt) {
      return;
    }

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
      endSession(session)
        .catch((nextError) => {
          autoEndingRef.current = false;
          setError(nextError.message || 'Unable to end session at the selected time.');
        });
    }
  }, [billedSeconds, hasAcceptedExtension, selectedDurationSeconds, session]);

  useEffect(() => {
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.injectJavaScript('window.ClaxiSessionBridge && window.ClaxiSessionBridge.close && window.ClaxiSessionBridge.close(); true;');
      }
    };
  }, []);

  const handleBridgeMessage = (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload.type === 'rtc_state') {
        setRtcState((prev) => ({
          ...prev,
          ...(payload.payload || {}),
        }));
      }
    } catch {
      // Ignore malformed bridge messages from the WebView.
    }
  };

  const handleToggleMute = () => {
    bridgeRef.current?.injectJavaScript('window.ClaxiSessionBridge && window.ClaxiSessionBridge.toggleAudio && window.ClaxiSessionBridge.toggleAudio(); true;');
  };

  const closeRtcBridge = () => {
    bridgeRef.current?.injectJavaScript('window.ClaxiSessionBridge && window.ClaxiSessionBridge.close && window.ClaxiSessionBridge.close(); true;');
  };

  const handleEndSession = () => {
    if (!session?.id || actionBusy) {
      return;
    }

    Alert.alert(
      'End this class?',
      'This will finalize billing and close the live classroom.',
      [
        { text: 'Keep class open', style: 'cancel' },
        {
          text: 'End class',
          style: 'destructive',
          onPress: async () => {
            setActionBusy(true);
            try {
              closeRtcBridge();
              await endSession(session);
            } catch (nextError) {
              setError(nextError.message || 'Unable to end this class.');
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenCancel = () => {
    setCancelError('');
    setCancelReason('');
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    const trimmedReason = String(cancelReason || '').trim();
    if (!trimmedReason) {
      setCancelError('Please enter a cancellation reason.');
      return;
    }

    if (!session?.id || actionBusy) {
      return;
    }

    setActionBusy(true);
    try {
      closeRtcBridge();
      await finalizeSessionClosure(session, {
        closureType: session.status === 'waiting_student' ? 'canceled' : 'canceled_during',
        canceledBy: 'student',
        canceledReason: trimmedReason,
      });
      setIsCancelOpen(false);
    } catch (nextError) {
      setCancelError(nextError.message || 'Unable to cancel this class.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading session room" />;
  }

  if (error && !session) {
    return <ErrorState message={error} />;
  }

  if (!session) {
    return <ErrorState title="Session not found" message="We could not find this session room entry." />;
  }

  const statusLabel = statusMeta.label;
  const connectionCopy = rtcState.networkError || rtcState.connectionMessage || 'Preparing live class...';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.stage}>
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
              <Card style={styles.stageFallbackCard}>
                <Text style={styles.stageKicker}>Live classroom</Text>
                <Text style={styles.stageTitle}>{session.topic || session.subject || 'Class session'}</Text>
                <Text style={styles.stageCopy}>
                  {session.status === 'waiting_student'
                    ? 'Joining the live classroom now.'
                    : 'This session is not currently live. Review the latest session state and linked request details below.'}
                </Text>
              </Card>
            </View>
          )}

          <View style={styles.topOverlay}>
            <View style={styles.overlayHeader}>
              <Pressable accessibilityRole="button" onPress={() => goBack('Sessions')} style={styles.exitButton}>
                <Text style={styles.exitButtonText}>Back</Text>
              </Pressable>
              <View style={styles.overlayTitleWrap}>
                <Text style={styles.overlayKicker}>Claxi session room</Text>
                <Text style={styles.overlayTitle} numberOfLines={1}>
                  {session.topic || session.subject || 'Class session'}
                </Text>
              </View>
              <StatusBadge label={statusLabel} tone={statusMeta.tone} />
            </View>

            <View style={styles.badgeWrap}>
              <FloatingBadge>Call {formatDuration(callSeconds)}</FloatingBadge>
              <FloatingBadge tone={isBillableActive ? 'success' : 'warning'}>
                Billable {formatDuration(billedSeconds)}
              </FloatingBadge>
              <FloatingBadge tone={rtcState.networkError ? 'danger' : (rtcState.isPeerConnected ? 'success' : 'default')}>
                {rtcState.networkError ? 'Connection issue' : connectionCopy}
              </FloatingBadge>
              <FloatingBadge tone={rtcState.isRemoteScreenSharing ? 'success' : 'warning'}>
                {rtcState.isRemoteScreenSharing ? 'Screen live' : 'Waiting for tutor share'}
              </FloatingBadge>
              {hasAcceptedExtension ? (
                <FloatingBadge tone={extensionGraceRemainingSeconds > 0 ? 'success' : 'default'}>
                  {extensionGraceRemainingSeconds > 0
                    ? `Grace ${extensionGraceRemainingSeconds}s`
                    : 'Overtime billed at locked rate'}
                </FloatingBadge>
              ) : null}
            </View>
          </View>

          {isPortrait ? (
            <View style={styles.rotateOverlay}>
              <Card style={styles.rotateCard}>
                <Text style={styles.rotateTitle}>Rotate your device</Text>
                <Text style={styles.rotateCopy}>
                  This live classroom is designed for landscape so the tutor screen can fill the stage clearly.
                </Text>
              </Card>
            </View>
          ) : null}

          <View style={styles.controlsRail}>
            <Pressable accessibilityRole="button" onPress={handleToggleMute} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>{rtcState.isMuted ? 'Unmute' : 'Mute'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleOpenCancel} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleEndSession} style={[styles.controlButton, styles.controlButtonDanger]}>
              <Text style={[styles.controlButtonText, styles.controlButtonTextDanger]}>
                {actionBusy ? 'Working...' : 'End'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.metaSheet}>
          <Card style={styles.metaCard}>
            <Text style={styles.metaTitle}>Billing snapshot</Text>
            <Text style={styles.metaValue}>
              {snapshot
                ? `Base ${formatRand(snapshot.adjustedBaseAmount ?? snapshot.baseAmount ?? 0)} | Rate ${formatRand(snapshot.adjustedRatePerMinute ?? snapshot.ratePerMinute ?? 0)}`
                : 'Pricing loads from the linked request.'}
            </Text>
            <Text style={styles.metaCopy}>
              Selected duration: {selectedDurationMinutes ? `${selectedDurationMinutes} min` : 'TBD'}
            </Text>
          </Card>

          <Card style={styles.metaCard}>
            <Text style={styles.metaTitle}>Tutor and request</Text>
            <Text style={styles.metaValue}>{session.tutorName || session.tutorId || 'Tutor pending'}</Text>
            <Text style={styles.metaCopy}>
              {request?.id ? 'Request tracking and class details stay linked from this live room.' : 'Linked request details load when available.'}
            </Text>
            {request?.id ? (
              <Button
                onPress={() => navigate({ key: 'RequestStatus', params: { requestId: request.id, parentTab: 'Requests' } })}
                style={styles.metaAction}
                variant="secondary"
              >
                View request status
              </Button>
            ) : null}
          </Card>

          <Card style={styles.metaCard}>
            <Text style={styles.metaTitle}>Uploaded attachments</Text>
            <AttachmentButtons attachments={attachments} />
          </Card>
        </View>

        <Modal animationType="fade" transparent visible={isCancelOpen} onRequestClose={() => setIsCancelOpen(false)}>
          <View style={styles.modalOverlay}>
            <Card style={styles.modalCard}>
              <Text style={styles.modalTitle}>Cancel this class</Text>
              <Text style={styles.modalCopy}>
                Tell us why you want to cancel this class. The same reason is written into the live production session record.
              </Text>
              <FormField
                error={cancelError}
                inputStyle={styles.modalField}
                label="Cancellation reason"
                multiline
                numberOfLines={4}
                onChangeText={setCancelReason}
                placeholder="Enter cancellation reason"
                textAlignVertical="top"
                value={cancelReason}
              />
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
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  stageFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#000000',
    justifyContent: 'center',
    padding: 20,
  },
  stageFallbackCard: {
    backgroundColor: 'rgba(17,24,39,0.88)',
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: 420,
    width: '100%',
  },
  stageKicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stageTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  stageCopy: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  topOverlay: {
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  exitButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(228,228,231,0.9)',
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  exitButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  overlayTitleWrap: {
    flex: 1,
  },
  overlayKicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  overlayTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  floatingBadge: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(228,228,231,0.88)',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  floatingBadgeSuccess: {
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderColor: 'rgba(16,185,129,0.4)',
  },
  floatingBadgeWarning: {
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderColor: 'rgba(245,158,11,0.36)',
  },
  floatingBadgeDanger: {
    backgroundColor: 'rgba(244,63,94,0.16)',
    borderColor: 'rgba(244,63,94,0.36)',
  },
  floatingBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  floatingBadgeTextSuccess: {
    color: '#d1fae5',
  },
  floatingBadgeTextWarning: {
    color: '#fef3c7',
  },
  floatingBadgeTextDanger: {
    color: '#ffe4e6',
  },
  rotateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.44)',
    justifyContent: 'center',
    padding: 20,
  },
  rotateCard: {
    maxWidth: 360,
  },
  rotateTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  rotateCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  controlsRail: {
    bottom: 18,
    flexDirection: 'row',
    gap: 10,
    left: 16,
    position: 'absolute',
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(228,228,231,0.9)',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 88,
    paddingHorizontal: 18,
  },
  controlButtonDanger: {
    backgroundColor: '#f43f5e',
    borderColor: '#f43f5e',
  },
  controlButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  controlButtonTextDanger: {
    color: '#ffffff',
  },
  metaSheet: {
    backgroundColor: '#ffffff',
    gap: 12,
    padding: 16,
  },
  metaCard: {
    gap: 10,
  },
  metaTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  metaCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  metaAction: {
    marginTop: 6,
  },
  attachmentList: {
    gap: 10,
  },
  attachmentButton: {
    alignSelf: 'flex-start',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    gap: 14,
    maxWidth: 460,
    width: '100%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  modalCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  modalField: {
    minHeight: 120,
    paddingTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
});
