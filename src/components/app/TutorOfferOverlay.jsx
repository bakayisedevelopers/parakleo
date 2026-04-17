import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ImageIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTutorAvailableRequests } from '../../hooks/useClassRequests';
import { OFFER_TIMEOUT_SECONDS } from '../../constants/lifecycle';
import { acceptClassRequest, declineClassRequest } from '../../services/classRequestService';
import { findSessionIdByRequestAndTutor } from '../../services/sessionService';
import { getTutorOnboardingStatus } from '../../utils/onboarding';
import { debugError, debugLog } from '../../utils/devLogger';
import { formatRand, normalizePricingSnapshot } from '../../utils/pricing';

function getDemandLabel(pricingBand) {
  const normalized = String(pricingBand || 'normal').toLowerCase();
  if (normalized === 'low') return { text: 'Low demand', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (normalized === 'high') return { text: 'High demand', tone: 'bg-rose-50 text-rose-700 border-rose-200' };
  return { text: 'Normal demand', tone: 'bg-blue-50 text-blue-700 border-blue-200' };
}

export default function TutorOfferOverlay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { requests } = useTutorAvailableRequests(user?.uid);
  const onboardingStatus = getTutorOnboardingStatus(user);
  const canAccept = onboardingStatus.complete && user?.onlineStatus === 'online';

  const [activeRequest, setActiveRequest] = useState(null);
  const [displayRequest, setDisplayRequest] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [now, setNow] = useState(Date.now());

  const audioCtxRef = useRef(null);
  const latestRequestIdRef = useRef(null);
  const processingRef = useRef(false);

  const topRequest = requests[0] || null;

  useEffect(() => {
    if (!displayRequest?.id) return undefined;

    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [displayRequest?.id]);

  useEffect(() => {
    if (processingRef.current) return;

    if (!topRequest) {
      setDisplayRequest(null);
      return;
    }

    setDisplayRequest(topRequest);
  }, [topRequest]);

  useEffect(() => {
    if (!displayRequest?.id) return;
    if (latestRequestIdRef.current === displayRequest.id) return;

    latestRequestIdRef.current = displayRequest.id;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new window.AudioContext();
      }

      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.05;

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch {
      // Ignore audio notification errors.
    }
  }, [displayRequest?.id]);

  const secondsLeft = Math.max(0, Math.ceil(((displayRequest?.offerExpiresAt || 0) - now) / 1000));
  const progress = useMemo(() => {
    const total = OFFER_TIMEOUT_SECONDS;
    return Math.max(0, Math.min(100, (secondsLeft / total) * 100));
  }, [secondsLeft]);

  const progressColor =
    progress > 60 ? 'bg-emerald-500' : progress > 30 ? 'bg-amber-500' : 'bg-rose-500';

  const handleResponse = async (response) => {
    if (!displayRequest || !canAccept) return;
    if (processingRef.current) return;

    processingRef.current = true;
    setActiveRequest(displayRequest.id);
    setErrorMessage('');

    debugLog('tutorOffer', 'Tutor offer response started.', {
      response,
      requestId: displayRequest.id,
    });

    try {
      if (response === 'accept') {
        const result = await acceptClassRequest({
          requestId: displayRequest.id,
          tutorId: user.uid,
          tutorName: user.fullName || user.displayName || user.email,
          tutorEmail: user.email,
        });

        let sessionId = result?.sessionId || null;

        if (!sessionId) {
          sessionId = await findSessionIdByRequestAndTutor({
            requestId: displayRequest.id,
            tutorId: user.uid,
          });
        }

        debugLog('tutorOffer', 'Tutor accepted request successfully.', {
          requestId: displayRequest.id,
          sessionId: sessionId || null,
          reused: Boolean(result?.reused),
        });

        if (!sessionId) {
          throw new Error('Call session was created, but no session ID was found.');
        }

        setDisplayRequest(null);
        navigate(`/app/session/${sessionId}`);
        return;
      }

      await declineClassRequest({
        requestId: displayRequest.id,
        tutorId: user.uid,
      });

      debugLog('tutorOffer', 'Tutor declined request.', {
        requestId: displayRequest.id,
      });

      setDisplayRequest(null);
    } catch (error) {
      debugError('tutorOffer', 'Tutor offer response failed.', {
        message: error.message,
        requestId: displayRequest.id,
      });
      setErrorMessage(error.message || 'Unable to process this request. Please try again.');
    } finally {
      processingRef.current = false;
      setActiveRequest(null);
    }
  };

  if (!displayRequest) return null;

  const isImage = displayRequest.attachment?.contentType?.startsWith('image/');
  const pricing = normalizePricingSnapshot(displayRequest.pricingSnapshot);
  const demand = getDemandLabel(pricing.pricingBand);
  const requestedDurationMinutes = Number(displayRequest.durationMinutes || pricing.requestedDurationMinutes || pricing.durationMinutes || 0);
  const dynamicRate = Math.max(0, Number(pricing.adjustedRatePerMinute || pricing.ratePerMinute || 0));
  const baseAmount = Number(pricing.adjustedBaseAmount ?? pricing.baseAmount ?? 0);
  const estimatedTotal = Number(pricing.finalPrice ?? pricing.totalAmount ?? 0);
  const dynamicPortion = Math.max(0, estimatedTotal - baseAmount);
  const attachments = displayRequest.attachments?.length
    ? displayRequest.attachments
    : displayRequest.attachment?.downloadUrl
      ? [displayRequest.attachment]
      : [];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/80 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Incoming request
            </p>
            <h3 className="text-lg font-bold text-zinc-900">
              {displayRequest.topic || 'Mathematics request'}
            </h3>
            <p className="text-sm text-zinc-600">
              {displayRequest.duration || 'N/A'} • {displayRequest.subject || 'Mathematics'}
            </p>
          </div>
          <div className="min-w-[100px] text-right">
            <p className="text-xs font-semibold text-zinc-500">Time left</p>
            <p className="text-2xl font-black text-zinc-900">{secondsLeft}s</p>
          </div>
        </div>

        <div className="mb-3 h-2 overflow-hidden rounded-full bg-zinc-200">
          <div
            className={`h-full ${progressColor} transition-all`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {errorMessage ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-1 font-semibold ${demand.tone}`}>
            {demand.text}
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-semibold text-zinc-700">
            Rate / min: {formatRand(dynamicRate)}
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-semibold text-zinc-700">
            Duration: {requestedDurationMinutes || 'N/A'} min
          </span>
        </div>

        <p className="mb-3 text-sm text-zinc-700">
          {displayRequest.description || 'Student sent a request with attachment(s).'}
        </p>
        <p className="mb-3 text-xs font-semibold text-zinc-500">
          Offers expire after {OFFER_TIMEOUT_SECONDS} seconds.
        </p>

        <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            What you&apos;re agreeing to
          </p>
          <div className="mt-2 grid gap-2 text-xs text-zinc-700 sm:grid-cols-2">
            <p>Base amount: <span className="font-semibold">{formatRand(baseAmount)}</span></p>
            <p>Dynamic demand value: <span className="font-semibold">{formatRand(dynamicPortion)}</span></p>
            <p>Dynamic rate per minute: <span className="font-semibold">{formatRand(dynamicRate)}</span></p>
            <p>Total expected session price: <span className="font-semibold">{formatRand(estimatedTotal)}</span></p>
          </div>
        </div>

        {attachments.length ? (
          <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
            <p className="mb-2 font-semibold text-zinc-700">Attachment preview</p>
            <div className="space-y-2">
              {attachments.slice(0, 3).map((file, index) => {
                const itemIsImage = file?.contentType?.startsWith('image/') || (index === 0 && isImage);
                return (
                  <a
                    key={`${file.fileName || 'attachment'}-${index}`}
                    href={file.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-zinc-200 bg-white p-2 transition hover:border-emerald-300"
                  >
                    {itemIsImage ? (
                      <img
                        src={file.downloadUrl}
                        alt={file.fileName || 'Attachment preview'}
                        className="max-h-44 w-full rounded-lg object-contain"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-zinc-700">
                        {file?.contentType?.includes('pdf') ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                        <span>{file.fileName || 'Document attachment'}</span>
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleResponse('accept')}
            disabled={!canAccept || activeRequest === displayRequest.id || processingRef.current}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {activeRequest === displayRequest.id ? 'Submitting...' : 'Accept'}
          </button>
          <button
            type="button"
            onClick={() => handleResponse('decline')}
            disabled={!canAccept || activeRequest === displayRequest.id || processingRef.current}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
