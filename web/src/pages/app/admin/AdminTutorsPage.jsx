import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import EmptyState from '../../../components/ui/EmptyState';
import { getTutorsForAdmin, setTutorVerificationStatus } from '../../../services/userService';
import { getTutorOnboardingStatus, hasCurrentTutorAgreement } from '../../../utils/onboarding';

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingTutorId, setRejectingTutorId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const items = await getTutorsForAdmin();
      setTutors(items);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (uid, status, reason = '') => {
    setIsSubmitting(true);
    try {
      await setTutorVerificationStatus(uid, status, reason);
      setRejectingTutorId(null);
      setRejectionReason('');
      await load();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tutor Verification" description="Review and update tutor verification statuses." />
      <SectionCard>
        {isLoading ? <LoadingState message="Loading tutors..." /> : null}
        {!isLoading && !tutors.length ? <EmptyState title="No tutors found" description="Tutor profiles will appear here." /> : null}
        {!isLoading && tutors.length ? (
          <div className="space-y-3">
            {tutors.map((tutor) => {
              const onboardingStatus = getTutorOnboardingStatus(tutor);
              const isRejectingThis = rejectingTutorId === tutor.uid;
              return (
                <div key={tutor.uid} className="rounded-2xl border border-zinc-300 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{tutor.fullName || tutor.displayName || tutor.email}</p>
                      <p className="text-sm text-zinc-600">{tutor.email}</p>
                      <p className="text-xs text-zinc-500">Verification: <span className="font-semibold">{tutor?.tutorProfile?.verificationStatus || 'pending'}</span></p>
                      {tutor?.tutorProfile?.verificationStatus === 'rejected' && tutor?.tutorProfile?.rejectionReason ? (
                        <p className="text-xs text-rose-600 font-medium">Rejection feedback: {tutor.tutorProfile.rejectionReason}</p>
                      ) : null}
                      <p className="text-xs text-zinc-500">Onboarding: {onboardingStatus.complete ? 'Complete' : onboardingStatus.message}</p>
                      <p className="text-xs text-zinc-500">Agreement: {hasCurrentTutorAgreement(tutor) ? `Accepted v${tutor?.tutorAgreement?.acceptedVersion || ''}` : 'Pending acceptance'}</p>
                    </div>
                    <Link
                      to={`/app/admin/tutors/${tutor.uid}`}
                      className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                    >
                      View details
                    </Link>
                  </div>

                  {isRejectingThis ? (
                    <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3">
                      <p className="text-xs font-semibold text-rose-900">Rejection reason / feedback for tutor (optional):</p>
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g. Police clearance certificate expired, results illegible..."
                        className="mt-2 w-full rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-rose-500 focus:outline-none"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => updateStatus(tutor.uid, 'rejected', rejectionReason)}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Rejecting...' : 'Confirm Reject'}
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            setRejectingTutorId(null);
                            setRejectionReason('');
                          }}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        disabled={isSubmitting || !hasCurrentTutorAgreement(tutor) || !onboardingStatus.complete}
                        onClick={() => updateStatus(tutor.uid, 'verified')}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Verify
                      </button>
                      <button
                        disabled={isSubmitting}
                        onClick={() => {
                          setRejectingTutorId(tutor.uid);
                          setRejectionReason(tutor?.tutorProfile?.rejectionReason || '');
                        }}
                        className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        disabled={isSubmitting}
                        onClick={() => updateStatus(tutor.uid, 'pending')}
                        className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
