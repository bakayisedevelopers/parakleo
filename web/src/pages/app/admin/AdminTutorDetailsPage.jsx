import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import LoadingState from '../../../components/ui/LoadingState';
import EmptyState from '../../../components/ui/EmptyState';
import { getTutorOnboardingStatus, hasCurrentTutorAgreement } from '../../../utils/onboarding';
import { getUserProfile, setTutorVerificationStatus } from '../../../services/userService';
import { subscribeToTutorDocuments, TUTOR_DOCUMENT_TYPES } from '../../../services/tutorDocumentService';

function formatDateTime(value) {
  if (!value) return 'Not available';
  const parsed = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  const time = parsed?.getTime?.() || 0;
  if (!Number.isFinite(time) || time <= 0) return 'Not available';
  return parsed.toLocaleString();
}

export default function AdminTutorDetailsPage() {
  const { uid } = useParams();
  const [tutor, setTutor] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!uid) return undefined;

    setIsLoading(true);
    getUserProfile(uid)
      .then((profile) => {
        if (cancelled) return;
        setTutor(profile);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error.message || 'Unable to load tutor details.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToTutorDocuments(uid, setDocuments);
  }, [uid]);

  const onboardingStatus = useMemo(() => getTutorOnboardingStatus(tutor || {}), [tutor]);
  const resultsDocuments = documents.filter((document) => String(document?.documentType || TUTOR_DOCUMENT_TYPES.RESULTS).toLowerCase() === TUTOR_DOCUMENT_TYPES.RESULTS);
  const policeClearanceDocuments = documents.filter((document) => String(document?.documentType || '').toLowerCase() === TUTOR_DOCUMENT_TYPES.POLICE_CLEARANCE);

  const updateStatus = async (status) => {
    if (!uid) return;
    try {
      await setTutorVerificationStatus(uid, status);
      const refreshed = await getUserProfile(uid);
      setTutor(refreshed);
      setMessage(`Tutor verification updated to ${status}.`);
    } catch (error) {
      setMessage(error.message || 'Unable to update tutor verification.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutor Details"
        description="Review the tutor profile, uploaded documents, police clearance, and verification status."
      />

      {message ? <p className="rounded-2xl border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p> : null}

      {isLoading ? <LoadingState message="Loading tutor details..." /> : null}

      {!isLoading && !tutor ? (
        <SectionCard>
          <EmptyState title="Tutor not found" description="This tutor profile is not available." />
        </SectionCard>
      ) : null}

      {!isLoading && tutor ? (
        <>
          <SectionCard
            title={tutor.fullName || tutor.displayName || tutor.email || 'Tutor'}
            subtitle={`${tutor.email || 'No email'} - ${onboardingStatus.complete ? 'Profile complete' : onboardingStatus.message}`}
            action={(
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateStatus('verified')}
                  disabled={!onboardingStatus.complete || !hasCurrentTutorAgreement(tutor)}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus('rejected')}
                  className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600"
                >
                  Reject
                </button>
                <Link to="/app/admin/tutors" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">
                  Back
                </Link>
              </div>
            )}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Verification status</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{tutor?.tutorProfile?.verificationStatus || 'pending'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Agreement</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{hasCurrentTutorAgreement(tutor) ? 'Accepted' : 'Pending'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Onboarding</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{onboardingStatus.complete ? 'Complete' : onboardingStatus.message}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Selfie</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{tutor?.selfieUrl ? 'Uploaded' : 'Missing'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Grades to tutor</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{Array.isArray(tutor?.tutorProfile?.gradesToTutor) && tutor.tutorProfile.gradesToTutor.length ? tutor.tutorProfile.gradesToTutor.join(', ') : 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Active subjects</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{Array.isArray(tutor?.activeSubjects) && tutor.activeSubjects.length ? tutor.activeSubjects.join(', ') : 'None'}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Uploaded documents" subtitle="Result documents and police clearance submissions.">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-800">Result documents</h3>
                {resultsDocuments.length ? resultsDocuments.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
                    <p className="font-semibold text-zinc-900">{document.fileName || 'Result document'}</p>
                    <p className="mt-1 text-xs text-zinc-500">Status: {document.status || 'uploaded'}</p>
                    {document.fileUrl ? <a className="mt-2 inline-flex font-semibold text-brand hover:underline" href={document.fileUrl} target="_blank" rel="noreferrer">Open file</a> : null}
                    {Array.isArray(document.qualifiedSubjects) && document.qualifiedSubjects.length ? (
                      <p className="mt-2 text-xs text-emerald-700">{document.qualifiedSubjects.length} qualified subject(s)</p>
                    ) : null}
                  </div>
                )) : <EmptyState title="No result documents" description="The tutor has not uploaded school results yet." />}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-800">Police clearance</h3>
                {policeClearanceDocuments.length ? policeClearanceDocuments.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
                    <p className="font-semibold text-zinc-900">{document.fileName || 'Police clearance document'}</p>
                    <p className="mt-1 text-xs text-zinc-500">Status: {document.status || 'uploaded'}</p>
                    {document.fileUrl ? <a className="mt-2 inline-flex font-semibold text-brand hover:underline" href={document.fileUrl} target="_blank" rel="noreferrer">Open file</a> : null}
                  </div>
                )) : <EmptyState title="No police clearance" description="The tutor has not uploaded a police clearance document yet." />}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Tutor payout" subtitle="Banking details submitted for tutor payouts.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Bank</p>
                <p className="mt-1 font-semibold text-zinc-900">{tutor?.tutorProfile?.payout?.bankName || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Account holder</p>
                <p className="mt-1 font-semibold text-zinc-900">{tutor?.tutorProfile?.payout?.accountHolder || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Account number</p>
                <p className="mt-1 font-semibold text-zinc-900">{tutor?.tutorProfile?.payout?.accountNumber || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Bank verification</p>
                <p className="mt-1 font-semibold text-zinc-900">{tutor?.tutorProfile?.payout?.verificationStatus || 'unverified'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Checked at</p>
                <p className="mt-1 font-semibold text-zinc-900">{formatDateTime(tutor?.tutorProfile?.payout?.verificationCheckedAt)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Grades taught</p>
                <p className="mt-1 font-semibold text-zinc-900">{Array.isArray(tutor?.tutorProfile?.gradesToTutor) && tutor.tutorProfile.gradesToTutor.length ? tutor.tutorProfile.gradesToTutor.join(', ') : 'Not set'}</p>
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
