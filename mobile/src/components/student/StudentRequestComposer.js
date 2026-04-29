import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AttachmentPickerModal } from './AttachmentPickerModal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { SOUTH_AFRICAN_SUBJECTS } from '../../constants/subjects';
import { createClassRequest } from '../../services/classRequestService';
import { extractAttachments } from '../../services/attachmentExtractionService';
import { fetchPricingQuote } from '../../services/pricingService';
import {
  buildSubjectClassificationInput,
  classifySubjectFromText,
} from '../../services/subjectClassificationService';
import { estimateFreeMinutePricing } from '../../services/studentGrowthService';
import { uploadUserFile } from '../../services/storageService';
import { colors } from '../../theme/colors';
import { getStudentOnboardingStatus } from '../../utils/onboarding';
import {
  DEFAULT_LESSON_DURATION,
  formatRand,
  LESSON_DURATION_OPTIONS,
} from '../../utils/pricing';
import { ACTIVE_REQUEST_STATUSES, getRequestStatusMeta } from '../../utils/requestStatus';

const QUICK_REQUEST_SUGGESTIONS = [
  { label: 'I need help with homework', value: 'I need help with homework.' },
  { label: 'I need help preparing for an exam', value: 'I need help preparing for an exam.' },
  { label: 'I need help with an assignment', value: 'I need help with an assignment.' },
  { label: 'I need a normal lesson', value: 'I need a normal lesson.' },
];

function buildAttachmentKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function buildBoardPreparationSource({ attachments = [], uploadedAttachments = [], attachmentExtractionByKey = {} }) {
  const attachmentExtractions = attachments.map((file, index) => {
    const fileKey = buildAttachmentKey(file);
    const extraction = attachmentExtractionByKey[fileKey] || null;
    const uploadedAttachment = uploadedAttachments[index] || null;

    return {
      fileName: file.name,
      uploadedAttachment,
      extractedText: String(extraction?.extractedText || '').trim(),
      text: String(extraction?.text || extraction?.extractedText || '').trim(),
      extractionMethod: extraction?.extractionMethod || '',
      extractionQuality: extraction?.extractionQuality || '',
      fileType: extraction?.fileType || '',
      source: extraction?.source || extraction?.fileType || '',
      selectedPages: Array.isArray(extraction?.selectedPages) ? extraction.selectedPages : [],
      scannedPdfDetected: Boolean(extraction?.scannedPdfDetected),
      ocrStatus: extraction?.ocrStatus || '',
      success: Boolean(extraction?.success),
      partialSuccess: Boolean(extraction?.partialSuccess),
      pages: Array.isArray(extraction?.pages) ? extraction.pages : [],
      extractedImages: Array.isArray(extraction?.extractedImages) ? extraction.extractedImages : [],
      failedPageCount: Number(extraction?.failedPageCount || 0),
    };
  });

  const extractedText = attachmentExtractions
    .map((item) => item.extractedText)
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return {
    extractedText,
    attachmentExtractions,
    ocrImageReferences: [],
  };
}

function normalizeEstimatedDuration(estimatedMinutes) {
  const numeric = Number(estimatedMinutes || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_LESSON_DURATION;
  return Math.min(90, Math.max(10, Math.round(numeric)));
}

function getDurationOptions(estimatedMinutes) {
  const normalizedEstimate = normalizeEstimatedDuration(estimatedMinutes);
  return Array.from(new Set([...LESSON_DURATION_OPTIONS, normalizedEstimate])).sort((a, b) => a - b);
}

function getReviewTopic({ classifiedTopic, topic }) {
  if (String(classifiedTopic || '').trim()) return String(classifiedTopic).trim();
  if (String(topic || '').trim()) return String(topic).trim();
  return '';
}

function getRequestFlowState({ onboardingComplete, latestOpenSession, activeOrOngoingRequest }) {
  if (!onboardingComplete) return 'blocked_onboarding';
  if (latestOpenSession) return 'blocked_active_session';
  if (activeOrOngoingRequest) return 'blocked_active_request';
  return 'request_flow';
}

function formatCardLabel(card) {
  if (!card) return 'Saved card';
  if (card.nickname) return card.nickname;
  const brand = String(card.brand || 'Card');
  return `${brand} ending ${card.last4 || '----'}`;
}

function buildQuoteWithDiscount(quote, requestedDurationMinutes, freeMinutesRemaining) {
  const pricingPreview = estimateFreeMinutePricing({
    originalPrice: quote?.totalAmount || 0,
    requestedDurationMinutes,
    freeMinutesRemaining,
  });

  return {
    ...quote,
    ...pricingPreview,
    finalAmount: pricingPreview.finalPrice,
    finalPayablePrice: pricingPreview.finalPrice,
  };
}

export function StudentRequestComposer({
  navigate,
  requests = [],
  sessions = [],
  user,
}) {
  const paymentMethods = user?.paymentMethods || [];
  const freeMinutesRemaining = Number(user?.freeMinutesRemaining || 0);
  const onboardingStatus = getStudentOnboardingStatus(user);
  const activeOrOngoingRequest = requests.find((request) => ACTIVE_REQUEST_STATUSES.includes(request.status));
  const latestOpenSession = sessions.find((session) => ['waiting_student', 'in_progress', 'in_session'].includes(session.status));
  const flowState = getRequestFlowState({
    onboardingComplete: onboardingStatus.complete,
    latestOpenSession,
    activeOrOngoingRequest,
  });

  const [stage, setStage] = useState('input');
  const [topic, setTopic] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachmentExtractionByKey, setAttachmentExtractionByKey] = useState({});
  const [attachmentExtractionStatusByKey, setAttachmentExtractionStatusByKey] = useState({});
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classifiedTopic, setClassifiedTopic] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(DEFAULT_LESSON_DURATION);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_LESSON_DURATION);
  const [hasManualDurationOverride, setHasManualDurationOverride] = useState(false);
  const [cardId, setCardId] = useState(
    paymentMethods.find((card) => card.isDefault)?.id || paymentMethods[0]?.id || '',
  );
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [quote, setQuote] = useState(null);
  const [pickerMode, setPickerMode] = useState('');
  const [isTextEntryOpen, setIsTextEntryOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPreparingReview, setIsPreparingReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubjectFallback, setShowSubjectFallback] = useState(false);
  const [unsupportedSubject, setUnsupportedSubject] = useState('');

  useEffect(() => {
    setCardId(paymentMethods.find((card) => card.isDefault)?.id || paymentMethods[0]?.id || '');
  }, [user?.uid, paymentMethods]);

  const durationOptions = useMemo(() => getDurationOptions(estimatedMinutes), [estimatedMinutes]);
  const reviewTopic = getReviewTopic({ classifiedTopic, topic });
  const pricingPreview = quote
    ? estimateFreeMinutePricing({
        originalPrice: quote.totalAmount,
        requestedDurationMinutes: durationMinutes,
        freeMinutesRemaining,
      })
    : null;
  const hasRequestContent = Boolean(topic.trim()) || attachments.length > 0;

  async function refreshQuote(minutes, subject) {
    const nextQuote = await fetchPricingQuote({
      durationMinutes: minutes,
      subject: subject || selectedSubject || 'Mathematics',
    });
    setQuote(nextQuote);
    return nextQuote;
  }

  function resetComposerState() {
    setStage('input');
    setTopic('');
    setAttachments([]);
    setAttachmentExtractionByKey({});
    setAttachmentExtractionStatusByKey({});
    setSelectedSubject('');
    setClassifiedTopic('');
    setEstimatedMinutes(DEFAULT_LESSON_DURATION);
    setDurationMinutes(DEFAULT_LESSON_DURATION);
    setHasManualDurationOverride(false);
    setError('');
    setQuote(null);
    setIsTextEntryOpen(false);
    setShowSubjectFallback(false);
    setUnsupportedSubject('');
  }

  async function handlePickedFiles(files) {
    setPickerMode('');
    if (!Array.isArray(files) || !files.length) return;

    const existingKeys = new Set(attachments.map((file) => buildAttachmentKey(file)));
    const nextFiles = files.filter((file) => !existingKeys.has(buildAttachmentKey(file)));
    if (!nextFiles.length) return;

    setStage('input');
    setError('');
    setSuccessMessage('');
    setIsExtracting(true);

    const nextAttachments = [...attachments, ...nextFiles];
    setAttachments(nextAttachments);
    setAttachmentExtractionStatusByKey((prev) => {
      const next = { ...prev };
      nextFiles.forEach((file) => {
        next[buildAttachmentKey(file)] = 'extracting';
      });
      return next;
    });

    try {
      await extractAttachments(nextFiles, (result, index) => {
        const file = nextFiles[index];
        const fileKey = buildAttachmentKey(file);
        setAttachmentExtractionByKey((prev) => ({ ...prev, [fileKey]: result }));
        setAttachmentExtractionStatusByKey((prev) => ({
          ...prev,
          [fileKey]: result.success ? 'text extracted' : 'extraction weak',
        }));
      });
    } catch (nextError) {
      setError(nextError.message || 'Unable to process the selected files right now.');
    } finally {
      setIsExtracting(false);
    }
  }

  function removeAttachment(indexToRemove) {
    const removed = attachments[indexToRemove];
    const removedKey = removed ? buildAttachmentKey(removed) : '';
    const nextAttachments = attachments.filter((_, index) => index !== indexToRemove);
    setAttachments(nextAttachments);
    setStage('input');
    setQuote(null);

    if (removedKey) {
      setAttachmentExtractionByKey((prev) => {
        const next = { ...prev };
        delete next[removedKey];
        return next;
      });
      setAttachmentExtractionStatusByKey((prev) => {
        const next = { ...prev };
        delete next[removedKey];
        return next;
      });
    }
  }

  async function prepareReview() {
    if (!hasRequestContent || isExtracting || isPreparingReview) return;

    setError('');
    setSuccessMessage('');
    setIsPreparingReview(true);

    try {
      const attachmentExtractions = attachments
        .map((file) => attachmentExtractionByKey[buildAttachmentKey(file)])
        .filter(Boolean);
      const subjectOptions = SOUTH_AFRICAN_SUBJECTS.map((subject) => ({ value: subject, label: subject }));
      const classificationInput = buildSubjectClassificationInput({
        typedText: topic,
        attachmentExtractions,
        supportedSubjects: subjectOptions,
      });
      const classification = await classifySubjectFromText({
        inputText: classificationInput.combinedText,
        inputPayload: classificationInput.structuredPayload,
        supportedSubjects: subjectOptions,
      });
      const nextEstimatedMinutes = normalizeEstimatedDuration(classification.estimatedMinutes || estimatedMinutes);
      const nextSubject = classification.subject || selectedSubject;

      setClassifiedTopic(classification.topic || '');
      setEstimatedMinutes(nextEstimatedMinutes);
      if (!hasManualDurationOverride) {
        setDurationMinutes(nextEstimatedMinutes);
      }

      if (classification.topic && !topic.trim()) {
        setTopic(classification.topic);
      }

      if (classification.unsupportedSubjectRequested && classification.unsupportedSubject) {
        setUnsupportedSubject(classification.unsupportedSubject);
        setShowSubjectFallback(true);
        return;
      }

      if (!nextSubject) {
        setShowSubjectFallback(true);
        return;
      }

      setSelectedSubject(nextSubject);
      await refreshQuote(hasManualDurationOverride ? durationMinutes : nextEstimatedMinutes, nextSubject);
      setStage('review');
    } catch (nextError) {
      setError(nextError.message || 'Unable to prepare the review right now.');
    } finally {
      setIsPreparingReview(false);
    }
  }

  async function confirmSubjectSelection() {
    if (!selectedSubject) return;

    setShowSubjectFallback(false);
    setUnsupportedSubject('');

    try {
      await refreshQuote(durationMinutes, selectedSubject);
      setStage('review');
    } catch (nextError) {
      setError(nextError.message || 'Unable to fetch pricing quote right now.');
    }
  }

  async function confirmRequest() {
    if (!selectedSubject) {
      setError('Select a subject before confirming.');
      return;
    }

    if (!cardId) {
      setError('Select a saved card before confirming.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const activeQuote = quote || (await refreshQuote(durationMinutes, selectedSubject));
      const quoteWithDiscount = buildQuoteWithDiscount(activeQuote, durationMinutes, freeMinutesRemaining);
      const uploadedAttachments = await Promise.all(
        attachments.map((attachment) => uploadUserFile({
          userId: user.uid,
          attachment,
          pathPrefix: 'request-attachments',
        })),
      );
      const boardPreparationSource = buildBoardPreparationSource({
        attachments,
        uploadedAttachments,
        attachmentExtractionByKey,
      });

      await createClassRequest({
        studentId: user.uid,
        studentName: user.fullName || user.displayName || 'Student',
        studentEmail: user.email || '',
        topic: reviewTopic || selectedSubject,
        description: topic.trim(),
        subject: selectedSubject,
        duration: `${durationMinutes} minutes`,
        durationMinutes,
        imageAttachment: uploadedAttachments[0]?.downloadUrl || '',
        attachment: uploadedAttachments[0] || null,
        attachments: uploadedAttachments,
        selectedCardId: cardId,
        pricingSnapshot: quoteWithDiscount,
        boardPreparationSource,
      });

      resetComposerState();
      setSuccessMessage('Your class request is live and matching tutors.');
      navigate('Requests');
    } catch (nextError) {
      setError(nextError.message || 'Unable to submit request right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeRequestMeta = activeOrOngoingRequest ? getRequestStatusMeta(activeOrOngoingRequest.status) : null;

  return (
    <View style={styles.wrap}>
      {successMessage ? (
        <Card style={styles.feedbackCard}>
          <Text style={styles.successText}>{successMessage}</Text>
        </Card>
      ) : null}

      {flowState === 'blocked_onboarding' ? (
        <Card style={styles.heroCard}>
          <StatusBadge label="Complete profile" tone="warning" />
          <Text style={styles.heroTitle}>Finish your student profile before requesting a class.</Text>
          <Text style={styles.heroCopy}>{onboardingStatus.message}</Text>
          <Button onPress={() => navigate('Onboarding')}>Complete profile</Button>
        </Card>
      ) : null}

      {flowState === 'blocked_active_request' ? (
        <Card style={styles.heroCard}>
          <StatusBadge label={activeRequestMeta?.label || 'Current request'} tone={activeRequestMeta?.tone || 'info'} />
          <Text style={styles.heroTitle}>You already have a request in progress.</Text>
          <Text style={styles.heroCopy}>
            Open the current request status instead of creating another request.
          </Text>
          <Text style={styles.currentTitle}>{activeOrOngoingRequest?.subject || 'Current request'}</Text>
          <Text style={styles.currentCopy}>{activeOrOngoingRequest?.topic || 'Live request'}</Text>
          <Button onPress={() => navigate('Requests')}>View current request</Button>
        </Card>
      ) : null}

      {flowState === 'blocked_active_session' ? (
        <Card style={styles.heroCard}>
          <StatusBadge label="In progress" tone="info" />
          <Text style={styles.heroTitle}>Your class is already in progress.</Text>
          <Text style={styles.heroCopy}>
            Re-open the live session instead of starting a new request.
          </Text>
          <Text style={styles.currentTitle}>{latestOpenSession?.subject || 'Current class'}</Text>
          <Text style={styles.currentCopy}>{latestOpenSession?.topic || latestOpenSession?.requestTopic || 'Live class session'}</Text>
          <Button onPress={() => navigate('Sessions')}>Continue current class</Button>
        </Card>
      ) : null}

      {flowState === 'request_flow' ? (
        <>
          <Card style={styles.heroCard}>
            <StatusBadge label="Student request" tone="success" />
            <Text style={styles.heroTitle}>Snap homework, upload a worksheet, or describe what you need help with.</Text>
            <Text style={styles.heroCopy}>
              We'll estimate the session length, detect the subject, and let you review before confirming.
            </Text>

            <View style={styles.actionRow}>
              <Button style={styles.actionButton} onPress={() => setPickerMode('camera')}>
                Take Picture
              </Button>
              <Button style={styles.actionButton} onPress={() => setPickerMode('upload')} variant="secondary">
                Upload
              </Button>
            </View>

            {attachments.length ? (
              <View style={styles.attachmentList}>
                {attachments.map((file, index) => {
                  const fileKey = buildAttachmentKey(file);
                  const status = attachmentExtractionStatusByKey[fileKey] || 'queued';
                  return (
                    <View key={fileKey} style={styles.attachmentRow}>
                      <View style={styles.attachmentMeta}>
                        <Text style={styles.attachmentName} numberOfLines={1}>{file.name}</Text>
                        <Text style={styles.attachmentStatus}>{status === 'text extracted' ? 'Done' : 'Processing...'}</Text>
                      </View>
                      <Pressable accessibilityRole="button" onPress={() => removeAttachment(index)} style={styles.removePill}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => setIsTextEntryOpen((current) => !current)}
              style={styles.toggleRow}
            >
              <Text style={styles.toggleTitle}>Or describe what you need help with</Text>
              <Text style={styles.toggleArrow}>{isTextEntryOpen ? 'v' : '>'}</Text>
            </Pressable>

            {isTextEntryOpen ? (
              <View style={styles.textEntry}>
                <TextInput
                  multiline
                  onChangeText={(value) => {
                    setTopic(value);
                    setStage('input');
                    setQuote(null);
                    setError('');
                  }}
                  placeholder="Type here..."
                  placeholderTextColor={colors.muted}
                  style={styles.textarea}
                  value={topic}
                />
                <View style={styles.suggestionWrap}>
                  {QUICK_REQUEST_SUGGESTIONS.map((option) => (
                    <Pressable
                      accessibilityRole="button"
                      key={option.label}
                      onPress={() => {
                        setIsTextEntryOpen(true);
                        setTopic(option.value);
                        setStage('input');
                        setQuote(null);
                        setError('');
                      }}
                      style={styles.suggestionChip}
                    >
                      <Text style={styles.suggestionText}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Button
              disabled={!hasRequestContent || isExtracting || isPreparingReview}
              onPress={prepareReview}
            >
              Continue to review
            </Button>
          </Card>

          {stage === 'review' ? (
            <Card style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>Review and confirm</Text>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Time</Text>
                <View style={styles.chipWrap}>
                  {durationOptions.map((option) => {
                    const active = durationMinutes === option;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={option}
                        onPress={async () => {
                          setHasManualDurationOverride(true);
                          setDurationMinutes(option);
                          try {
                            await refreshQuote(option, selectedSubject);
                          } catch (nextError) {
                            setError(nextError.message || 'Unable to refresh pricing quote right now.');
                          }
                        }}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                      >
                        <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option} min</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Minutes</Text>
                <Text style={styles.reviewValue}>{durationMinutes} selected | {freeMinutesRemaining.toFixed(2)} free</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Subject</Text>
                <View style={styles.chipWrap}>
                  {SOUTH_AFRICAN_SUBJECTS.map((subject) => {
                    const active = selectedSubject === subject;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={subject}
                        onPress={async () => {
                          setSelectedSubject(subject);
                          try {
                            await refreshQuote(durationMinutes, subject);
                          } catch (nextError) {
                            setError(nextError.message || 'Unable to refresh pricing quote right now.');
                          }
                        }}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                      >
                        <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{subject}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Topic</Text>
                <Text style={styles.reviewValue}>{reviewTopic || 'Not set'}</Text>
              </View>

              <View style={styles.pricingCard}>
                <View style={styles.pricingRow}>
                  <Text style={styles.sectionLabel}>Base price</Text>
                  <Text style={styles.reviewValue}>{formatRand(quote?.adjustedBaseAmount ?? quote?.baseAmount ?? 0)}</Text>
                </View>
                <View style={styles.pricingRow}>
                  <Text style={styles.sectionLabel}>Per minute</Text>
                  <Text style={styles.reviewValue}>{formatRand(quote?.adjustedRatePerMinute ?? quote?.ratePerMinute ?? 0)}</Text>
                </View>
                {pricingPreview ? (
                  <View style={styles.pricingRow}>
                    <Text style={styles.sectionLabel}>Due after {durationMinutes} min</Text>
                    <Text style={styles.reviewValue}>{formatRand(pricingPreview.finalPrice)}</Text>
                  </View>
                ) : null}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Payment</Text>
                  <View style={styles.chipWrap}>
                    {paymentMethods.map((card) => {
                      const active = cardId === card.id;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={card.id}
                          onPress={() => setCardId(card.id)}
                          style={[styles.choiceChip, active && styles.choiceChipActive]}
                        >
                          <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{formatCardLabel(card)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.actionRow}>
                <Button style={styles.actionButton} disabled={isSubmitting} onPress={confirmRequest}>
                  {isSubmitting ? 'Confirming...' : 'Confirm request'}
                </Button>
                <Button style={styles.actionButton} onPress={() => setStage('input')} variant="secondary">
                  Back
                </Button>
              </View>
            </Card>
          ) : null}
        </>
      ) : null}

      <AttachmentPickerModal
        visible={Boolean(pickerMode)}
        mode={pickerMode}
        onCancel={() => setPickerMode('')}
        onError={(message) => {
          setPickerMode('');
          setError(message);
        }}
        onFilesSelected={handlePickedFiles}
      />

      <Modal animationType="fade" transparent visible={showSubjectFallback} onRequestClose={() => setShowSubjectFallback(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {unsupportedSubject ? (
              <>
                <Text style={styles.modalTitle}>Subject not offered yet</Text>
                <Text style={styles.modalCopy}>Sorry, {unsupportedSubject} is not offered yet.</Text>
                <Button onPress={() => {
                  setShowSubjectFallback(false);
                  setUnsupportedSubject('');
                }}>
                  Close
                </Button>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Choose subject before review</Text>
                <Text style={styles.modalCopy}>We couldn&apos;t confidently resolve a supported subject from the request details.</Text>
                <View style={styles.chipWrap}>
                  {SOUTH_AFRICAN_SUBJECTS.map((subject) => {
                    const active = selectedSubject === subject;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={subject}
                        onPress={() => setSelectedSubject(subject)}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                      >
                        <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{subject}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.actionRow}>
                  <Button style={styles.actionButton} onPress={() => setShowSubjectFallback(false)} variant="secondary">
                    Cancel
                  </Button>
                  <Button style={styles.actionButton} disabled={!selectedSubject} onPress={confirmSubjectSelection}>
                    Confirm subject
                  </Button>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={isExtracting || isPreparingReview || isSubmitting}>
        <View style={styles.modalOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.modalTitle}>
              {isSubmitting ? 'Confirming request' : isPreparingReview ? 'Preparing review' : 'Processing your file'}
            </Text>
            <Text style={styles.modalCopy}>
              {isSubmitting
                ? 'Please wait while we upload your files and post the live request.'
                : isPreparingReview
                  ? 'Please wait while we classify the subject and fetch the pricing quote.'
                  : 'Please wait while we scan and prepare your uploaded files.'}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  heroCard: {
    gap: 14,
  },
  feedbackCard: {
    backgroundColor: '#ecfdf5',
  },
  successText: {
    color: colors.brandDark,
    fontSize: 14,
    fontWeight: '800',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  currentTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  currentCopy: {
    color: colors.muted,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  attachmentList: {
    gap: 10,
  },
  attachmentRow: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  attachmentMeta: {
    flex: 1,
    gap: 4,
  },
  attachmentName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  attachmentStatus: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  removePill: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  toggleArrow: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '800',
  },
  textEntry: {
    backgroundColor: '#fafafa',
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    minHeight: 90,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewCard: {
    gap: 14,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: colors.brandDark,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reviewValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  choiceChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: colors.brand,
  },
  choiceText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: colors.brandDark,
  },
  pricingCard: {
    backgroundColor: '#f0fdfa',
    borderColor: 'rgba(16,185,129,0.18)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  pricingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.2)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    gap: 14,
    maxHeight: '80%',
    padding: 18,
    width: '100%',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    gap: 12,
    maxWidth: 360,
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
