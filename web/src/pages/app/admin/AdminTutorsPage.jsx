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

  const updateStatus = async (uid, status) => {
    await setTutorVerificationStatus(uid, status);
    await load();
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
              return (
                <div key={tutor.uid} className="rounded-2xl border border-zinc-300 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{tutor.fullName || tutor.displayName || tutor.email}</p>
                      <p className="text-sm text-zinc-600">{tutor.email}</p>
                      <p className="text-xs text-zinc-500">Verification: {tutor?.tutorProfile?.verificationStatus || 'pending'}</p>
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
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button disabled={!hasCurrentTutorAgreement(tutor) || !onboardingStatus.complete} onClick={() => updateStatus(tutor.uid, 'verified')} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Verify</button>
                    <button onClick={() => updateStatus(tutor.uid, 'rejected')} className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600">Reject</button>
                    <button onClick={() => updateStatus(tutor.uid, 'pending')} className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700">Reset</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
