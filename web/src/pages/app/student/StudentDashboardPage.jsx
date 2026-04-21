import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Camera,
  ChevronRight,
  CreditCard,
  FileText,
  ImageIcon,
  Send,
  X,
} from 'lucide-react';
import OnboardingStatusBanner from '../../../components/app/OnboardingStatusBanner';
import { useAuth } from '../../../hooks/useAuth';
import { useLiveUserProfile } from '../../../hooks/useLiveUserProfile';
import { useStudentRequests } from '../../../hooks/useClassRequests';
import { useStudentSessions } from '../../../hooks/useSessions';
import { SUBJECT_OPTIONS } from '../../../constants/subjects';
import {
  extractAttachments,
} from '../../../services/attachmentExtractionService';
import { createClassRequest } from '../../../services/classRequestService';
import { fetchPricingQuote } from '../../../services/pricingService';
import { uploadUserFile } from '../../../services/storageService';
import { estimateFreeMinutePricing } from '../../../services/studentGrowthService';
import {
  buildSubjectClassificationInput,
  classifySubjectFromText,
} from '../../../services/subjectClassificationService';
import { DEFAULT_LESSON_DURATION, LESSON_DURATION_OPTIONS, formatRand } from '../../../utils/pricing';
import { REQUEST_STATUSES } from '../../../utils/requestStatus';
import { getStudentOnboardingStatus } from '../../../utils/onboarding';

const QUICK_REQUEST_SUGGESTIONS = [
  { label: 'I need help with homework', value: 'I need help with homework.' },
  { label: 'I need help preparing for an exam', value: 'I need help preparing for an exam.' },
  { label: 'I need help with an assignment', value: 'I need help with an assignment.' },
  { label: 'I need a normal lesson', value: 'I need a normal lesson.' },
];

const SUBJECT_ALIASES = {
  Mathematics: ['math', 'mathematics', 'algebra', 'geometry', 'calculus', 'trigonometry', 'statistics', 'stats'],
};

function resolveSubjectFromText(text, supportedSubjects = SUBJECT_OPTIONS) {
  const normalizedText = String(text || '').toLowerCase();
  if (!normalizedText.trim()) return '';

  const matched = supportedSubjects.find((subject) => {
    const aliases = SUBJECT_ALIASES[subject.value] || [];
    const normalizedLabel = subject.label.toLowerCase();
    const normalizedValue = subject.value.toLowerCase();
    const checks = [normalizedLabel, normalizedValue, ...aliases];
    return checks.some((term) => normalizedText.includes(term));
  });

  return matched?.value || '';
}

function getAttachmentKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function buildBoardPreparationSource({ attachments = [], uploadedAttachments = [], attachmentExtractionByKey = {} }) {
  const attachmentExtractions = attachments.map((file, index) => {
    const fileKey = getAttachmentKey(file);
    const extraction = attachmentExtractionByKey[fileKey] || null;
    const uploadedAttachment = uploadedAttachments[index] || null;

    return {
      fileName: file.name,
      uploadedAttachment,
      extractedText: String(extraction?.extractedText || '').trim(),
      extractionMethod: extraction?.extractionMethod || '',
      extractionQuality: extraction?.extractionQuality || '',
      fileType: extraction?.fileType || '',
      selectedPages: Array.isArray(extraction?.selectedPages) ? extraction.selectedPages : [],
      scannedPdfDetected: Boolean(extraction?.scannedPdfDetected),
      ocrStatus: extraction?.ocrStatus || '',
      success: Boolean(extraction?.success),
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

function getReviewTopic({ classifiedTopic, topic, attachments }) {
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
  const nickname = String(card.nickname || 'card');
  return nickname.charAt(0).toUpperCase() + nickname.slice(1);
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { profile: liveProfile } = useLiveUserProfile(user?.uid);
  const currentUser = liveProfile || user;
  const paymentMethods = currentUser?.paymentMethods || user?.paymentMethods || [];
  const displayName = currentUser?.fullName || currentUser?.displayName || user?.fullName || user?.displayName || 'Student';
  const freeMinutesRemaining = Number(currentUser?.freeMinutesRemaining || user?.freeMinutesRemaining || 0);
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const attachmentsRef = useRef([]);
  const isManualSubjectRef = useRef(false);
  const extractionRunCounterRef = useRef(0);
  const activeExtractionTokenByKeyRef = useRef({});
  const classificationRunCounterRef = useRef(0);

  const [stage, setStage] = useState('input');
  const [advanceIntent, setAdvanceIntent] = useState('');
  const [topic, setTopic] = useState('');
  const [cardId, setCardId] = useState(
    paymentMethods.find((card) => card.isDefault)?.id || paymentMethods[0]?.id || '',
  );
  const [attachments, setAttachments] = useState([]);
  const [attachmentExtractionByKey, setAttachmentExtractionByKey] = useState({});
  const [attachmentExtractionStatusByKey, setAttachmentExtractionStatusByKey] = useState({});
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classifiedTopic, setClassifiedTopic] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(DEFAULT_LESSON_DURATION);
  const [classificationStatus, setClassificationStatus] = useState('');
  const [classificationState, setClassificationState] = useState('idle');
  const [showSubjectFallback, setShowSubjectFallback] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_LESSON_DURATION);
  const [hasManualDurationOverride, setHasManualDurationOverride] = useState(false);
  const [isTextEntryOpen, setIsTextEntryOpen] = useState(false);
  const [quote, setQuote] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { requests } = useStudentRequests(user?.uid);
  const { sessions } = useStudentSessions(user?.uid);

  const onboardingStatus = getStudentOnboardingStatus(currentUser || user);
  const activeOrOngoingRequest = requests.find((request) => [
    REQUEST_STATUSES.PENDING,
    REQUEST_STATUSES.MATCHING,
    REQUEST_STATUSES.OFFERED,
    REQUEST_STATUSES.ACCEPTED,
    REQUEST_STATUSES.WAITING_STUDENT,
    REQUEST_STATUSES.IN_PROGRESS,
    REQUEST_STATUSES.IN_SESSION,
  ].includes(request.status));
  const latestOpenSession = sessions.find((session) => ['waiting_student', 'in_progress'].includes(session.status));
  const flowState = getRequestFlowState({
    onboardingComplete: onboardingStatus.complete,
    latestOpenSession,
    activeOrOngoingRequest,
  });

  const hasTypedText = Boolean(topic.trim());
  const hasRequestContent = hasTypedText || attachments.length > 0;
  const hasRunningExtraction = attachments.some((file) => {
    const fileKey = getAttachmentKey(file);
    const status = attachmentExtractionStatusByKey[fileKey];
    return status === 'extracting' || status === 'ocr processing';
  });
  const reviewTopic = getReviewTopic({ classifiedTopic, topic, attachments });
  const durationOptions = useMemo(() => getDurationOptions(estimatedMinutes), [estimatedMinutes]);
  const pricingPreview = quote
    ? estimateFreeMinutePricing({
        originalPrice: quote.totalAmount,
        requestedDurationMinutes: durationMinutes,
        freeMinutesRemaining,
      })
    : null;
  const readyForReview = hasRequestContent
    && !hasRunningExtraction
    && classificationState === 'done'
    && Boolean(estimatedMinutes)
    && Boolean(quote);
  const canConfirm = readyForReview && Boolean(selectedSubject) && Boolean(cardId) && !isSubmitting;
  const isPricingQuoteError = /pricing quote/i.test(error);

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  };

  const refreshQuote = async (minutes) => {
    const nextQuote = await fetchPricingQuote({
      durationMinutes: minutes,
      subject: 'Mathematics',
    });
    setQuote(nextQuote);
    return nextQuote;
  };

  const maybeAdvanceToReview = (intent = '') => {
    if (flowState !== 'request_flow') return;
    if (!readyForReview) {
      setAdvanceIntent(intent || 'text');
      return;
    }
    setAdvanceIntent('');
    setStage('review');
  };

  const onTopicChange = (event) => {
    const nextTopic = event.target.value;
    setIsTextEntryOpen(true);
    setTopic(nextTopic);
    setStage('input');
    setAdvanceIntent('');
    setError('');
    if (!isManualSubjectRef.current) {
      setSelectedSubject(resolveSubjectFromText(nextTopic, SUBJECT_OPTIONS));
    }
    resizeTextarea();
  };

  const applySuggestion = (value) => {
    setIsTextEntryOpen(true);
    setTopic(value);
    setStage('input');
    setAdvanceIntent('');
    setError('');
    if (!isManualSubjectRef.current) {
      setSelectedSubject(resolveSubjectFromText(value, SUBJECT_OPTIONS));
    }
    setTimeout(() => resizeTextarea(), 0);
  };

  const onFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validFiles = files.filter((file) => file.type.startsWith('image/') || file.type === 'application/pdf');
    if (!validFiles.length) {
      event.target.value = '';
      return;
    }

    const existingKeys = new Set(attachmentsRef.current.map((file) => getAttachmentKey(file)));
    const newFilesForExtraction = validFiles.filter((file) => !existingKeys.has(getAttachmentKey(file)));

    if (!newFilesForExtraction.length) {
      event.target.value = '';
      return;
    }

    setStage('input');
    setAdvanceIntent('attachment');
    setError('');

    const nextAttachments = [...attachmentsRef.current, ...newFilesForExtraction];
    attachmentsRef.current = nextAttachments;
    setAttachments(nextAttachments);

    const extractionTokenByFileKey = {};

    setAttachmentExtractionStatusByKey((prev) => {
      const next = { ...prev };
      newFilesForExtraction.forEach((file) => {
        const fileKey = getAttachmentKey(file);
        const token = extractionRunCounterRef.current + 1;
        extractionRunCounterRef.current = token;
        activeExtractionTokenByKeyRef.current[fileKey] = token;
        extractionTokenByFileKey[fileKey] = token;
        next[fileKey] = 'extracting';
      });
      return next;
    });

    extractAttachments(newFilesForExtraction, (result, index) => {
      const file = newFilesForExtraction[index];
      const fileKey = getAttachmentKey(file);
      const tokenForThisResult = extractionTokenByFileKey[fileKey];
      const activeToken = activeExtractionTokenByKeyRef.current[fileKey];

      if (!tokenForThisResult || tokenForThisResult !== activeToken) {
        return;
      }

      setAttachmentExtractionByKey((prev) => ({ ...prev, [fileKey]: result }));
      setAttachmentExtractionStatusByKey((prev) => ({
        ...prev,
        [fileKey]: result.success
          ? 'text extracted'
          : result.requiresPageSelection
            ? 'ocr processing'
            : result.extractionMethod === 'fallback'
              ? 'fallback needed'
              : 'extraction weak',
      }));

    }).finally(() => {
      setAttachmentExtractionStatusByKey((prev) => {
        const next = { ...prev };
        newFilesForExtraction.forEach((file) => {
          const fileKey = getAttachmentKey(file);
          if (next[fileKey] === 'extracting') {
            next[fileKey] = 'fallback needed';
          }
        });
        return next;
      });
    });

    event.target.value = '';
  };

  const removeAttachment = (indexToRemove) => {
    const removed = attachmentsRef.current[indexToRemove];
    if (removed) {
      const removedKey = getAttachmentKey(removed);
      delete activeExtractionTokenByKeyRef.current[removedKey];
      setAttachmentExtractionByKey((current) => {
        const updated = { ...current };
        delete updated[removedKey];
        return updated;
      });
      setAttachmentExtractionStatusByKey((current) => {
        const updated = { ...current };
        delete updated[removedKey];
        return updated;
      });
    }

    const nextAttachments = attachmentsRef.current.filter((_, index) => index !== indexToRemove);
    attachmentsRef.current = nextAttachments;
    setAttachments(nextAttachments);
    setStage('input');
    setAdvanceIntent(nextAttachments.length ? 'attachment' : '');
  };

  const confirmRequest = async () => {
    if (!canConfirm) {
      if (!selectedSubject) {
        setShowSubjectFallback(true);
      }
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const activeQuote = quote || (await refreshQuote(durationMinutes));
      const activePricingPreview = estimateFreeMinutePricing({
        originalPrice: activeQuote.totalAmount,
        requestedDurationMinutes: durationMinutes,
        freeMinutesRemaining,
      });

      const quoteWithDiscount = {
        ...activeQuote,
        originalPrice: activePricingPreview.originalPrice,
        discountApplied: activePricingPreview.discountApplied,
        finalPrice: activePricingPreview.finalPrice,
        discountSource: activePricingPreview.discountSource,
        freeMinutesApplied: activePricingPreview.freeMinutesApplied,
        requestedDurationMinutes: durationMinutes,
      };

      let uploadedAttachments = [];
      if (attachments.length) {
        uploadedAttachments = await Promise.all(
          attachments.map(async (file) => {
            const uploadResult = await uploadUserFile({
              userId: user.uid,
              file,
              pathPrefix: 'request-attachments',
            });

            return {
              fileName: file.name,
              contentType: file.type || '',
              size: Number(file.size || 0),
              path: uploadResult.objectPath,
              downloadUrl: uploadResult.downloadUrl,
            };
          }),
        );
      }

      const boardPreparationSource = buildBoardPreparationSource({
        attachments,
        uploadedAttachments,
        attachmentExtractionByKey,
      });

      const requestId = await createClassRequest({
        subject: selectedSubject,
        topic: reviewTopic,
        classifiedTopic: classifiedTopic || reviewTopic,
        estimatedMinutes: normalizeEstimatedDuration(estimatedMinutes),
        description: topic.trim(),
        preferredDate: '',
        preferredTime: '',
        duration: `${durationMinutes} minutes`,
        durationMinutes,
        meetingProviderPreference: 'any',
        mode: 'online',
        imageAttachment: uploadedAttachments.map((file) => file.fileName).join(', '),
        attachment: uploadedAttachments[0] || null,
        attachments: uploadedAttachments,
        studentId: user.uid,
        studentName: currentUser?.fullName || currentUser?.displayName || user?.email,
        studentEmail: user.email,
        selectedCardId: cardId,
        pricingSnapshot: quoteWithDiscount,
        boardPreparationSource,
      });

      navigate(`/app/student/request/${requestId}`, {
        state: {
          requestId,
          topic: reviewTopic,
        },
      });
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit request right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!paymentMethods.length) {
      setCardId('');
      return;
    }

    const hasCurrentCard = paymentMethods.some((card) => card.id === cardId);
    if (hasCurrentCard) return;
    setCardId(paymentMethods.find((card) => card.isDefault)?.id || paymentMethods[0]?.id || '');
  }, [cardId, paymentMethods]);

  useEffect(() => {
    if (!onboardingStatus.complete) return;
    refreshQuote(durationMinutes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingStatus.complete]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    if (flowState !== 'request_flow') {
      setStage('input');
      setAdvanceIntent('');
      return;
    }
    if (!hasRequestContent) {
      setStage('input');
      setAdvanceIntent('');
    }
  }, [flowState, hasRequestContent]);

  useEffect(() => {
    if (isManualSubjectRef.current) return;

    const extractionResults = Object.values(attachmentExtractionByKey || {});
    const { combinedText, hasUsableText } = buildSubjectClassificationInput({
      typedText: topic,
      attachmentExtractions: extractionResults,
    });

    if (!hasUsableText) {
      setClassifiedTopic('');
      setEstimatedMinutes(DEFAULT_LESSON_DURATION);
      setClassificationStatus('');
      setClassificationState('idle');
      if (!hasManualDurationOverride) {
        setDurationMinutes(DEFAULT_LESSON_DURATION);
      }
      return;
    }

    const runId = classificationRunCounterRef.current + 1;
    classificationRunCounterRef.current = runId;
    let isCancelled = false;

    setClassificationState('running');
    setClassificationStatus('Analyzing your request...');

    const timeoutId = setTimeout(async () => {
      try {
        const result = await classifySubjectFromText({
          inputText: combinedText,
          supportedSubjects: SUBJECT_OPTIONS,
        });

        if (isCancelled || classificationRunCounterRef.current !== runId) return;

        const nextEstimatedMinutes = normalizeEstimatedDuration(result.estimatedMinutes);
        setClassifiedTopic(result.topic || '');
        setEstimatedMinutes(nextEstimatedMinutes);
        setClassificationState('done');

        if (result.subject) {
          setSelectedSubject(result.subject);
          setClassificationStatus(
            result.needsManualSubjectSelection || result.subjectConfidence === 'low'
              ? 'Subject detected. Please confirm before sending.'
              : 'Subject and study focus detected from your request.',
          );
        } else {
          setClassificationStatus('We need you to choose the subject manually before review.');
        }

        if (!hasManualDurationOverride) {
          setDurationMinutes(nextEstimatedMinutes);
        }
      } catch (classificationError) {
        if (isCancelled || classificationRunCounterRef.current !== runId) return;
        setClassificationState('error');
        setClassificationStatus('We could not estimate the request yet. Keep editing or try again.');
      }
    }, 450);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [topic, attachmentExtractionByKey, hasManualDurationOverride]);

  useEffect(() => {
    if (!onboardingStatus.complete) return;
    refreshQuote(durationMinutes).catch((quoteError) => {
      setError(quoteError.message || 'Unable to refresh pricing quote.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMinutes]);

  useEffect(() => {
    if (!advanceIntent || !readyForReview) return;
    maybeAdvanceToReview(advanceIntent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceIntent, readyForReview, selectedSubject, flowState]);

  const handleDurationChange = (event) => {
    setHasManualDurationOverride(true);
    setDurationMinutes(Number(event.target.value || DEFAULT_LESSON_DURATION));
    setError('');
  };

  const renderAttachmentRow = (file, index) => {
    const isImage = file.type.startsWith('image/');
    const fileKey = getAttachmentKey(file);
    const extractionStatus = attachmentExtractionStatusByKey[fileKey];
    const extractionResult = attachmentExtractionByKey[fileKey];
    return (
      <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="space-y-2 rounded-3xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900 text-zinc-200">
            {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{file.name}</p>
            <p className="text-xs text-zinc-400">{extractionStatus || 'Queued'}</p>
          </div>
          <button
            type="button"
            onClick={() => removeAttachment(index)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/80 text-zinc-300 transition hover:text-white"
            aria-label={`Remove ${file.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      </div>
    );
  };

  if (flowState === 'blocked_onboarding') {
    return (
      <div className="space-y-4">
        <OnboardingStatusBanner user={currentUser || user} role="student" />
        <div className="overflow-hidden rounded-[2rem] border border-amber-300/30 bg-zinc-900/75 p-5 shadow-[0_20px_70px_rgba(2,6,23,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">Complete setup first</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">Finish your student profile before requesting a class.</h1>
          <p className="mt-2 text-sm text-zinc-300">{onboardingStatus.message}</p>
          <Link
            to="/app/onboarding?role=student"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            Complete onboarding
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (flowState === 'blocked_active_session' || flowState === 'blocked_active_request') {
    const showSession = flowState === 'blocked_active_session' && latestOpenSession;

    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/75 p-5 shadow-[0_20px_70px_rgba(2,6,23,0.35)]">
          <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Continue current class
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">
            {showSession ? 'Your class is already in progress.' : 'You already have a request in progress.'}
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            {showSession
              ? 'Jump back into the active session instead of starting a new intake.'
              : 'Open the current request status instead of creating another request.'}
          </p>

          <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {showSession ? (latestOpenSession?.subject || 'Current class') : (activeOrOngoingRequest?.subject || 'Current request')}
            </p>
            <p className="mt-2 text-lg font-bold text-white">
              {showSession
                ? (latestOpenSession?.topic || 'Live class')
                : (activeOrOngoingRequest?.topic || 'Live request')}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {showSession
                ? `${latestOpenSession?.duration || 'Live now'}`
                : `${activeOrOngoingRequest?.statusDetail || 'Tutor matching is still running.'}`}
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              to={showSession ? `/app/session/${latestOpenSession.id}` : `/app/student/request/${activeOrOngoingRequest.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              {showSession ? 'Continue current class' : 'View current request'}
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to={showSession ? '/app/student/requests' : '/app/student/requests'}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Open my classes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/75 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur">
        <div className="relative overflow-hidden p-4 sm:p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_36%)]" />
          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Student request</p>
                <h1 className="mt-2 text-[1.9rem] font-black leading-tight tracking-tight text-white">
                  Hi {displayName.split(' ')[0]}, start with a picture.
                </h1>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Snap homework, upload a worksheet, or describe what you need help with. We&apos;ll estimate the session length, detect the subject, and let you review before confirming.
                </p>
                {stage !== 'review' ? (
                  <>
                    <div className="mt-4 flex items-center gap-3">
                      <label className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark">
                        <Camera className="mr-2 h-4 w-4" />
                        Take Picture
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          onChange={onFileChange}
                          className="hidden"
                        />
                      </label>

                      <label className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 px-6 py-3 text-sm font-bold text-brand transition hover:bg-brand/20">
                        Upload PDF
                        <ChevronRight className="ml-2 h-4 w-4" />
                        <input
                          type="file"
                          accept="application/pdf"
                          multiple
                          onChange={onFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="mt-3 space-y-3">
                      {attachments.length ? (
                        <div className="space-y-3">
                          {attachments.map((file, index) => renderAttachmentRow(file, index))}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setIsTextEntryOpen((current) => !current)}
                        className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-zinc-950/45 px-4 py-3 text-left transition hover:bg-zinc-950/60"
                        aria-expanded={isTextEntryOpen}
                      >
                        <span className="text-sm font-semibold text-white">Or describe what you need help with</span>
                        <ChevronRight className={`h-4 w-4 text-zinc-300 transition ${isTextEntryOpen ? 'rotate-90' : ''}`} />
                      </button>

                      {isTextEntryOpen ? (
                        <div className="rounded-[1.5rem] border border-white/10 bg-zinc-950/55 p-4">
                          <textarea
                            ref={textareaRef}
                            value={topic}
                            onChange={onTopicChange}
                            placeholder="Type here..."
                            rows={1}
                            className="max-h-[200px] min-h-[64px] w-full resize-none overflow-y-auto rounded-2xl border border-white/10 bg-transparent p-3 text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 outline-none"
                          />
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Detected subject</p>
                              <p className="mt-1 text-sm text-zinc-200">
                                {selectedSubject || 'Waiting for subject confirmation'}
                              </p>
                              {classificationStatus ? (
                                <p className="mt-1 text-xs text-zinc-400">{classificationStatus}</p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => maybeAdvanceToReview('text')}
                              disabled={!topic.trim()}
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-300"
                            >
                              Continue
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {QUICK_REQUEST_SUGGESTIONS.map((option) => (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => applySuggestion(option.value)}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-emerald-300/40 hover:bg-emerald-500/10"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="hidden rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 sm:block">
                2-step intake
              </div>
            </div>

            <div className="grid gap-3">
              {stage === 'review' ? (
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">Review and confirm</h2>
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-zinc-200">
                    <label className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3">
                      <span className="font-semibold text-brand">Time</span>
                      <select
                        value={durationMinutes}
                        onChange={handleDurationChange}
                        className="bg-transparent text-right text-sm font-semibold text-white outline-none"
                      >
                        {durationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option} min
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3">
                      <span className="font-semibold text-brand">Minutes</span>
                      <span className="text-right font-semibold text-white">
                        {durationMinutes} selected • {freeMinutesRemaining.toFixed(2)} free
                      </span>
                    </div>

                    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3">
                      <span className="font-semibold text-brand">Subject</span>
                      <span className="text-right font-semibold text-white">{selectedSubject || 'Select subject'}</span>
                    </div>

                    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3">
                      <span className="font-semibold text-brand">Topic</span>
                      <span className="text-right font-semibold text-white">{reviewTopic || 'Not set'}</span>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-brand/20 bg-brand/5 p-4">
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="font-semibold text-brand">Base price</span>
                        <span className="text-right font-semibold text-white">{formatRand(quote?.adjustedBaseAmount ?? quote?.baseAmount ?? 0)}</span>
                      </div>
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="font-semibold text-brand">Per minute</span>
                        <span className="text-right font-semibold text-white">{formatRand(quote?.adjustedRatePerMinute ?? quote?.ratePerMinute ?? 0)}</span>
                      </div>
                      {pricingPreview ? (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="font-semibold text-brand">Due now</span>
                          <span className="text-right font-semibold text-white">{formatRand(pricingPreview.finalPrice)}</span>
                        </div>
                      ) : null}
                      <label className="flex w-full items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-brand">
                          <CreditCard className="h-4 w-4 text-brand" />
                          Payment
                        </span>
                        <select
                          value={cardId}
                          onChange={(event) => setCardId(event.target.value)}
                          className="max-w-[180px] bg-transparent text-right text-sm font-semibold text-white outline-none"
                        >
                          <option value="">Select card</option>
                          {paymentMethods.map((card) => (
                            <option key={card.id} value={card.id}>
                              {formatCardLabel(card)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={confirmRequest}
                      disabled={!canConfirm}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-500 disabled:text-zinc-200"
                    >
                      <Send className="h-4 w-4" />
                      {isSubmitting ? 'Confirming...' : 'Confirm request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStage('input')}
                      className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {showSubjectFallback ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/75 px-4">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-zinc-900 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.55)]">
            <p className="text-lg font-bold text-white">Choose subject before review</p>
            <p className="mt-2 text-sm text-zinc-400">We couldn&apos;t confidently resolve a supported subject from the request details.</p>

            <select
              value={selectedSubject}
              onChange={(event) => {
                const nextSubject = event.target.value;
                isManualSubjectRef.current = Boolean(nextSubject);
                setSelectedSubject(nextSubject);
              }}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-3 text-sm text-white outline-none"
            >
              <option value="">Select subject</option>
              {SUBJECT_OPTIONS.map((subject) => (
                <option key={subject.value} value={subject.value}>
                  {subject.label}
                </option>
              ))}
            </select>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubjectFallback(false)}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedSubject}
                onClick={() => {
                  setShowSubjectFallback(false);
                  maybeAdvanceToReview(advanceIntent || 'text');
                }}
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-200"
              >
                Confirm subject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
