import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Power } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { useAuth } from '../../../hooks/useAuth';
import { useTutorAvailableRequests } from '../../../hooks/useClassRequests';
import { getTutorOnboardingStatus } from '../../../utils/onboarding';
import { updateUserProfile } from '../../../services/userService';
import { acceptClassRequest, declineClassRequest } from '../../../services/classRequestService';
import { findSessionIdByRequestAndTutor } from '../../../services/sessionService';
import { debugError, debugLog } from '../../../utils/devLogger';
import useViewportMode from '../../../hooks/useViewportMode';

export default function TutorDashboardPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { requests } = useTutorAvailableRequests(user?.uid);
  const onboardingStatus = getTutorOnboardingStatus(user);
  const isOnline = user?.onlineStatus === 'online';
  const { useBottomNav } = useViewportMode();
  const isTutorRestrictedMobile = useBottomNav;
  const [now, setNow] = useState(Date.now());
  const [activeRequestId, setActiveRequestId] = useState('');
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleOnlineStatus = async () => {
    if (isTutorRestrictedMobile) return;
    if (!onboardingStatus.complete) return;
    debugLog('tutorDashboard', 'Toggling tutor online status.', { current: isOnline ? 'online' : 'offline' });
    const profile = await updateUserProfile(user.uid, { onlineStatus: isOnline ? 'offline' : 'online' });
    setUser((prev) => ({ ...prev, ...profile }));
  };

  const respond = async (requestId, response) => {
    debugLog('tutorDashboard', 'Tutor responding to request from dashboard.', { requestId, response });
    setActiveRequestId(requestId);
    setRequestError('');
    try {
      if (response === 'accept') {
        await acceptClassRequest({
          requestId,
          tutorId: user.uid,
          tutorName: user.fullName || user.displayName || user.email,
          tutorEmail: user.email,
        });
        const sessionId = await findSessionIdByRequestAndTutor({ requestId, tutorId: user.uid });
        if (sessionId) {
          navigate(`/app/session/${sessionId}`);
        }
      } else {
        await declineClassRequest({ requestId, tutorId: user.uid });
      }
    } catch (error) {
      debugError('tutorDashboard', 'Tutor response failed.', { requestId, response, message: error.message });
      setRequestError(error.message || 'Unable to process this request. Please try again.');
    } finally {
      setActiveRequestId('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tutor Home" description="Go online to view requests and respond quickly." />

      {!onboardingStatus.complete ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {onboardingStatus.message} <Link className="font-semibold underline" to="/app/onboarding?role=tutor">Complete profile</Link>
        </div>
      ) : null}
      {isTutorRestrictedMobile ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          To teach and accept class requests, please access Claxi from a laptop or tablet in landscape mode.
        </div>
      ) : null}

      <SectionCard>
        <div className="rounded-3xl border border-emerald-200 bg-white p-4 md:p-6">
          <p className="text-2xl font-black text-zinc-900">Go online to view requests</p>
          <p className="mt-1 text-sm text-zinc-500">When you are online, new requests will appear below in real time.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleOnlineStatus}
              disabled={isTutorRestrictedMobile || !onboardingStatus.complete}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-white ${isOnline ? 'bg-rose-600' : 'bg-emerald-600'}`}
            >
              <Power className="h-4 w-4" />
              {isOnline ? 'Go Offline' : 'Go Online'}
            </button>
            {!isTutorRestrictedMobile ? (
              <Link to="/app/tutor/available-requests" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700">
                Open full request list
              </Link>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {isOnline ? (
        <SectionCard title="Incoming requests">
          {requestError ? (
            <p className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {requestError}
            </p>
          ) : null}
          {requests.length ? (
            <div className="space-y-3">
              {requests.map((request) => {
                const secondsLeft = Math.max(0, Math.ceil(((request.offerExpiresAt || 0) - now) / 1000));
                return (
                  <div key={request.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="font-semibold text-zinc-900">{request.topic}</p>
                    <p className="text-sm text-zinc-600">{request.description || 'New class request'}</p>
                    <p className="mt-1 text-xs font-semibold text-amber-700">{secondsLeft}s remaining</p>
                    <div className="mt-3 flex gap-2">
                      <button disabled={activeRequestId === request.id} onClick={() => respond(request.id, 'accept')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Accept</button>
                      <button disabled={activeRequestId === request.id} onClick={() => respond(request.id, 'decline')} className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700">Decline</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No requests yet. Stay online to receive offers.</p>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
