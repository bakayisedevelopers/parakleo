import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Search, XCircle } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { useStudentRequest } from '../../../hooks/useClassRequests';
import { useStudentSessions } from '../../../hooks/useSessions';
import { useAuth } from '../../../hooks/useAuth';
import { REQUEST_STATUSES } from '../../../utils/requestStatus';
import { cancelClassRequest } from '../../../services/classRequestService';

function getStatusCopy(status) {
  if ([REQUEST_STATUSES.PENDING, REQUEST_STATUSES.MATCHING, REQUEST_STATUSES.OFFERED].includes(status)) return 'Searching for a tutor';
  if ([REQUEST_STATUSES.ACCEPTED, REQUEST_STATUSES.WAITING_STUDENT, REQUEST_STATUSES.IN_PROGRESS, REQUEST_STATUSES.IN_SESSION].includes(status)) return 'Tutor found';
  if (status === REQUEST_STATUSES.NO_TUTOR_AVAILABLE) return 'No tutor available';
  if (status === REQUEST_STATUSES.COMPLETED) return 'Class completed';
  if ([REQUEST_STATUSES.CANCELED, REQUEST_STATUSES.CANCELED_DURING, REQUEST_STATUSES.EXPIRED].includes(status)) return 'Request closed';
  return 'Request made';
}

function getStatusMeta(status) {
  if ([REQUEST_STATUSES.PENDING, REQUEST_STATUSES.MATCHING, REQUEST_STATUSES.OFFERED].includes(status)) {
    return {
      label: 'Searching for tutor',
      tone: 'emerald',
      icon: Search,
      badge: 'Request made • searching for tutor',
    };
  }

  if ([REQUEST_STATUSES.ACCEPTED, REQUEST_STATUSES.WAITING_STUDENT, REQUEST_STATUSES.IN_PROGRESS, REQUEST_STATUSES.IN_SESSION].includes(status)) {
    return {
      label: 'Tutor found',
      tone: 'violet',
      icon: CheckCircle2,
      badge: 'Tutor accepted your request',
    };
  }

  if (status === REQUEST_STATUSES.NO_TUTOR_AVAILABLE) {
    return {
      label: 'No tutor available',
      tone: 'amber',
      icon: Search,
      badge: 'No tutor available right now',
    };
  }

  if (status === REQUEST_STATUSES.COMPLETED) {
    return {
      label: 'Completed',
      tone: 'emerald',
      icon: CheckCircle2,
      badge: 'Class completed successfully',
    };
  }

  if ([REQUEST_STATUSES.CANCELED, REQUEST_STATUSES.CANCELED_DURING, REQUEST_STATUSES.EXPIRED].includes(status)) {
    return {
      label: 'Closed',
      tone: 'rose',
      icon: XCircle,
      badge: 'This request is no longer active',
    };
  }

  return {
    label: 'Request made',
    tone: 'zinc',
    icon: Search,
    badge: 'Preparing your request',
  };
}

function getToneClasses(tone) {
  if (tone === 'emerald') {
    return {
      iconWrap: 'bg-emerald-100 text-emerald-700',
      gradient: 'from-emerald-500 via-teal-500 to-blue-500',
    };
  }

  if (tone === 'violet') {
    return {
      iconWrap: 'bg-violet-100 text-violet-700',
      gradient: 'from-violet-500 via-fuchsia-500 to-blue-500',
    };
  }

  if (tone === 'amber') {
    return {
      iconWrap: 'bg-amber-100 text-amber-700',
      gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    };
  }

  if (tone === 'rose') {
    return {
      iconWrap: 'bg-rose-100 text-rose-700',
      gradient: 'from-rose-500 via-pink-500 to-red-500',
    };
  }

  return {
    iconWrap: 'bg-zinc-100 text-zinc-700',
    gradient: 'from-zinc-500 via-zinc-400 to-zinc-500',
  };
}

export default function StudentRequestStatusPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requestId: requestIdParam } = useParams();
  const { state } = useLocation();
  const requestId = requestIdParam || state?.requestId || '';
  const { request } = useStudentRequest(requestId);
  const { sessions } = useStudentSessions(user?.uid);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  if (!requestId) {
    return <Navigate to="/app/student" replace />;
  }

  const currentStatus = request?.status;
  const statusText = getStatusCopy(currentStatus);
  const meta = getStatusMeta(currentStatus);
  const tone = getToneClasses(meta.tone);
  const StatusIcon = meta.icon;

  const topic = request?.topic || state?.topic || 'Your request';
  const duration = request?.duration || 'Per-minute billing';
  const canJoin =
    currentStatus === REQUEST_STATUSES.ACCEPTED ||
    currentStatus === REQUEST_STATUSES.WAITING_STUDENT ||
    currentStatus === REQUEST_STATUSES.IN_PROGRESS ||
    currentStatus === REQUEST_STATUSES.IN_SESSION;
  const matchingSession = useMemo(
    () => sessions.find((item) => item.requestId === requestId),
    [requestId, sessions],
  );
  const shouldAutoOpenSession = canJoin && Boolean(matchingSession?.id);

  useEffect(() => {
    if (!shouldAutoOpenSession) return;
    navigate(`/app/session/${matchingSession.id}`, { replace: true });
  }, [matchingSession?.id, navigate, shouldAutoOpenSession]);

  const canCancel = ![
    REQUEST_STATUSES.CANCELED,
    REQUEST_STATUSES.CANCELED_DURING,
    REQUEST_STATUSES.COMPLETED,
    REQUEST_STATUSES.EXPIRED,
  ].includes(currentStatus);

  const submitCancel = async () => {
    if (!request?.id || !cancelReason.trim()) return;
    setIsCanceling(true);
    try {
      await cancelClassRequest({ requestId: request.id, canceledBy: 'student', reason: cancelReason });
      setShowCancelModal(false);
      setCancelReason('');
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request Status"
        description="Simple live status for your class request."
      />

      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/70 shadow-[0_20px_70px_rgba(2,6,23,0.4)] backdrop-blur-xl">
        <div className={`relative overflow-hidden bg-gradient-to-r ${tone.gradient} px-6 py-8 text-white md:px-8 md:py-10`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_35%)]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
                Live request update
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{statusText}</h1>
              <p className="mt-3 max-w-xl text-sm text-white/90 md:text-base">
                Request made, tutor search, and class completion updates appear here.
              </p>
            </div>

            <div className="w-full max-w-sm rounded-[1.75rem] border border-white/20 bg-white/10 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.iconWrap}`}>
                  <StatusIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Current state</p>
                  <p className="truncate text-lg font-bold text-white">{meta.label}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/85">{meta.badge}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <SectionCard title="Request overview" subtitle="Essential details only. Open full details when needed.">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-zinc-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Topic</p>
                <p className="mt-2 break-words text-lg font-bold text-zinc-100">{topic}</p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-zinc-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Duration</p>
                <p className="mt-2 text-lg font-bold text-zinc-100">{duration}</p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-zinc-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Payment method</p>
                <p className="mt-2 text-sm font-bold text-zinc-100">{request?.selectedCardId || 'Selected card on file'}</p>
              </div>
            </div>

            {canJoin ? (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  Your class is ready. Join now from the button on the right.
                </p>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Actions" subtitle="Quick things you may need right now.">
          <div className="space-y-3">
            {canJoin ? (
              <Link
                to={matchingSession?.id ? `/app/session/${matchingSession.id}` : '/app/student/requests'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
              >
                Join session
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}

            <Link
              to={`/app/student/requests/${requestId}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-100 transition hover:bg-zinc-700"
              >
              View full request details
            </Link>

            {canCancel ? (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
              >
                Cancel Request
              </button>
            ) : null}
          </div>
        </SectionCard>
      </div>
      {showCancelModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/70 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-lg font-black text-zinc-900">Cancel request</p>
            <p className="mt-1 text-sm text-zinc-600">Please provide a reason. This helps us improve matching quality.</p>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Type your cancellation reason"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCancelModal(false)} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold">
                Close
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || isCanceling}
                onClick={submitCancel}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {isCanceling ? 'Canceling...' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
