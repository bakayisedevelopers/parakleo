import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Paperclip, Send, X, FileText, ImageIcon } from 'lucide-react';
import OnboardingStatusBanner from '../../../components/app/OnboardingStatusBanner';
import { useAuth } from '../../../hooks/useAuth';
import { useStudentRequests } from '../../../hooks/useClassRequests';
import { createClassRequest } from '../../../services/classRequestService';
import { uploadUserFile } from '../../../services/storageService';
import { getStudentOnboardingStatus } from '../../../utils/onboarding';
import { REQUEST_STATUSES } from '../../../utils/requestStatus';
import { DEFAULT_LESSON_DURATION, LESSON_DURATION_OPTIONS, formatRand } from '../../../utils/pricing';
import { fetchPricingQuote } from '../../../services/pricingService';
import { estimateFreeMinutePricing } from '../../../services/studentGrowthService';
import { useStudentSessions } from '../../../hooks/useSessions';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const [topic, setTopic] = useState('');
  const [cardId, setCardId] = useState(
    user?.paymentMethods?.find((card) => card.isDefault)?.id || user?.paymentMethods?.[0]?.id || ''
  );
  const [attachments, setAttachments] = useState([]);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_LESSON_DURATION);
  const [quote, setQuote] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { requests } = useStudentRequests(user?.uid);
  const { sessions } = useStudentSessions(user?.uid);

  const onboardingStatus = getStudentOnboardingStatus(user);
  const hasRequestContent = Boolean(topic.trim()) || attachments.length > 0;
  const canSend = onboardingStatus.complete && hasRequestContent && Boolean(cardId);
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
  const pricingPreview = quote
    ? estimateFreeMinutePricing({
        originalPrice: quote.totalAmount,
        requestedDurationMinutes: durationMinutes,
        freeMinutesRemaining: user?.freeMinutesRemaining || 0,
      })
    : null;

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  };

  const onTopicChange = (event) => {
    setTopic(event.target.value);
    resizeTextarea();
  };

  const refreshQuote = async (minutes) => {
    const nextQuote = await fetchPricingQuote({
      durationMinutes: minutes,
      subject: 'Mathematics',
    });
    setQuote(nextQuote);
    return nextQuote;
  };

  const onFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validFiles = files.filter((file) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      return isImage || isPdf;
    });

    if (!validFiles.length) return;

    setAttachments((prev) => {
      const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const newFiles = validFiles.filter(
        (file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
      );
      return [...prev, ...newFiles];
    });

    event.target.value = '';
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const goToRequestStatus = async () => {
    if (!canSend || isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      const activeQuote = quote || (await refreshQuote(durationMinutes));
      const activePricingPreview = estimateFreeMinutePricing({
        originalPrice: activeQuote.totalAmount,
        requestedDurationMinutes: durationMinutes,
        freeMinutesRemaining: user?.freeMinutesRemaining || 0,
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
      const requestText =
        topic.trim() || `Help me with attached file${attachments.length > 1 ? 's' : ''}: ${attachments.map((file) => file.name).join(', ')}`;

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
          })
        );
      }

      const requestId = await createClassRequest({
        topic: requestText,
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
        studentName: user.fullName || user.displayName || user.email,
        studentEmail: user.email,
        selectedCardId: cardId,
        pricingSnapshot: quoteWithDiscount,
      });

      navigate(`/app/student/request/${requestId}`, {
        state: {
          requestId,
          topic: requestText,
        },
      });
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit request right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = user?.fullName || user?.displayName || 'Student';

  useEffect(() => {
    if (!onboardingStatus.complete) return;
    refreshQuote(durationMinutes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingStatus.complete]);

  const handleDurationChange = async (event) => {
    const minutes = Number(event.target.value || DEFAULT_LESSON_DURATION);
    setDurationMinutes(minutes);
    setError('');
    try {
      await refreshQuote(minutes);
    } catch (quoteError) {
      setError(quoteError.message || 'Unable to refresh pricing quote.');
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-13rem)] flex-col overflow-hidden bg-transparent">
      {!onboardingStatus.complete ? (
        <div className="mb-4">
          <OnboardingStatusBanner user={user} role="student" />
          <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{onboardingStatus.message}</p>
            <Link
              to="/app/onboarding?role=student"
              className="mt-2 inline-flex rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Complete profile
            </Link>
          </div>
        </div>
      ) : null}

      <div className="relative flex flex-1 flex-col px-4 pt-4 md:px-6 md:pt-6">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/70 p-6 backdrop-blur-xl md:p-10">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Smart class requests
              </div>

              <h1 className="text-3xl font-black leading-tight tracking-tight text-zinc-100 md:text-3xl">
                Hello{' '}
                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 bg-clip-text text-transparent">
                  {displayName}
                </span>
                , request anything you would like help with.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                Describe or upload the question you need help with.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 text-sm text-indigo-100">
            <p className="font-semibold">Free minutes balance: {Number(user?.freeMinutesRemaining || 0).toFixed(2)} min</p>
            <p className="mt-1 text-xs text-indigo-200">
              Use your referral code <span className="font-semibold">{user?.referralCode || 'Loading...'}</span> to invite students and earn +30 min each.
            </p>
          </div>

          {latestOpenSession || activeOrOngoingRequest ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <p className="font-semibold">Continue your class</p>
              {latestOpenSession ? (
                <p className="mt-1">
                  Live session available: <span className="font-semibold">{latestOpenSession.topic || 'Mathematics class'}</span>.
                  <Link to={`/app/session/${latestOpenSession.id}`} className="ml-1 underline">Join now</Link>
                </p>
              ) : null}
              {!latestOpenSession && activeOrOngoingRequest ? (
                <p className="mt-1">
                  We&apos;re still processing your latest request: <span className="font-semibold">{activeOrOngoingRequest.topic || 'Mathematics request'}</span>.
                  <Link to={`/app/student/request/${activeOrOngoingRequest.id}`} className="ml-1 underline">View status</Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex-1" />

          <div className="sticky bottom-0 z-20 mt-8 pb-1 md:pb-1">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-transparent" />

            <div className="relative rounded-[2rem] bg-transparent p-1 md:p-1">
              <div className="rounded-[1.5rem] border border-white/10 bg-zinc-900 px-4 py-3 shadow-inner md:px-5 md:py-4">
                {attachments.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachments.map((file, index) => {
                      const isImage = file.type.startsWith('image/');
                      return (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                        >
                          {isImage ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                          <span className="max-w-[180px] truncate font-medium md:max-w-[260px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <textarea
                  ref={textareaRef}
                  value={topic}
                  onChange={onTopicChange}
                  placeholder="Ask for a class, explain the topic, or upload files..."
                  rows={1}
                  className="max-h-[220px] min-h-[28px] w-full resize-none overflow-y-auto bg-transparent py-1 text-sm leading-7 text-zinc-100 placeholder:text-zinc-500 outline-none md:text-[15px]"
                />
              </div>

              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                    <span className="text-xs font-semibold text-zinc-500">Duration</span>
                    <select
                      value={durationMinutes}
                      onChange={handleDurationChange}
                      className="w-auto bg-transparent text-xs text-zinc-800 outline-none"
                    >
                      {LESSON_DURATION_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option} min</option>
                      ))}
                    </select>
                  </label>

                  <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="hidden text-xs font-semibold sm:inline">Add files</span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      multiple
                      onChange={onFileChange}
                      className="hidden"
                    />
                  </label>

                  <label className="inline-flex h-11 min-w-[52px] items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 sm:min-w-[180px]">
                    <CreditCard className="h-4 w-4 shrink-0" />
                    <span className="hidden text-xs font-semibold text-zinc-500 sm:inline">Card</span>
                    <select
                      value={cardId}
                      onChange={(event) => setCardId(event.target.value)}
                      className="w-auto max-w-[130px] bg-transparent text-xs text-zinc-800 outline-none sm:max-w-none"
                    >
                      <option value="">Select</option>
                      {(user?.paymentMethods || []).map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.nickname.charAt(0).toUpperCase() + card.nickname.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>

                </div>

                <button
                  type="button"
                  onClick={goToRequestStatus}
                  disabled={!canSend || isSubmitting}
                  className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition md:h-14 md:text-[15px] ${
                    canSend
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-zinc-400'
                  }`}
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? 'Requesting...' : `Request ${pricingPreview ? formatRand(pricingPreview.finalPrice) : quote ? formatRand(quote.totalAmount) : 'quote'}`}
                </button>
              </div>

              {quote && pricingPreview ? (
                <p className="mt-2 text-xs text-zinc-600">
                  Original {formatRand(pricingPreview.originalPrice)} • Free-minute discount {formatRand(pricingPreview.discountApplied)} ({pricingPreview.freeMinutesApplied.toFixed(2)} min) • Pay now {formatRand(pricingPreview.finalPrice)}
                </p>
              ) : null}

              {!user?.paymentMethods?.length ? (
                <p className="mt-2 text-xs text-amber-700">
                  Add a payment card from Payment page first.
                </p>
              ) : null}

              {error ? (
                <p className="mt-2 text-xs text-rose-700">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
