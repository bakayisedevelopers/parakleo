import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import LiveSelfieCapture from '../../components/app/LiveSelfieCapture';
import QualifiedSubjectsManager from '../../components/app/QualifiedSubjectsManager';
import TutorDocumentsManager from '../../components/app/TutorDocumentsManager';
import { useAuth } from '../../hooks/useAuth';
import { useLiveUserProfile } from '../../hooks/useLiveUserProfile';
import { updateUserProfile } from '../../services/userService';
import {
  getStudentOnboardingStatus,
  getTutorOnboardingStatus,
  TUTOR_VERIFICATION_STATUSES,
} from '../../utils/onboarding';
import PaymentMethodsManager from '../../components/app/PaymentMethodsManager';
import { syncStudentGrowth } from '../../services/studentGrowthService';

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const { profile: liveProfile } = useLiveUserProfile(user?.uid);
  const currentUser = liveProfile || user;
  const [searchParams] = useSearchParams();
  const queryRole = searchParams.get('role');
  const role = queryRole === 'tutor' ? 'tutor' : 'student';
  const [statusMessage, setStatusMessage] = useState('');
  const [isSavingTutorProfile, setIsSavingTutorProfile] = useState(false);

  const studentStatus = useMemo(() => getStudentOnboardingStatus(currentUser), [currentUser]);
  const tutorStatus = useMemo(() => getTutorOnboardingStatus(currentUser), [currentUser]);

  const saveStudentProfile = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const profile = await updateUserProfile(user.uid, {
      studentProfile: {
        grade: Number(formData.get('grade')) || null,
        curriculum: formData.get('curriculum')?.toString().trim() || '',
        discoverySource: formData.get('discoverySource')?.toString().trim() || '',
      },
    });
    const syncedProfile = await syncStudentGrowth().catch(() => null);

    setUser((prev) => ({ ...prev, ...profile, ...(syncedProfile || {}) }));
    setStatusMessage('Student profile details saved.');
  };

  const saveTutorProfile = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!currentUser?.selfieVerified || !currentUser?.selfieUrl) {
      setStatusMessage('Please capture and save a live selfie before saving tutor setup.');
      return;
    }

    try {
      setIsSavingTutorProfile(true);

      const profile = await updateUserProfile(user.uid, {
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          gradesToTutor: (formData.get('gradesToTutor')?.toString() || '').split(',').map((item) => item.trim()).filter(Boolean),
          verificationStatus: (currentUser?.qualifiedSubjects || []).length ? TUTOR_VERIFICATION_STATUSES.VERIFIED : TUTOR_VERIFICATION_STATUSES.PENDING,
          payout: {
            bankName: formData.get('bankName')?.toString().trim() || '',
            accountNumber: formData.get('accountNumber')?.toString().trim() || '',
            accountHolder: formData.get('accountHolder')?.toString().trim() || '',
          },
        },
      });

      setUser((prev) => ({ ...prev, ...profile }));
      setStatusMessage('Tutor profile details saved.');
    } catch (error) {
      setStatusMessage(error.message || 'Unable to upload documents and save tutor profile.');
    } finally {
      setIsSavingTutorProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Complete Your Profile" description="Profile and payment completion is required before live requests and tutoring." />

      {statusMessage ? <p className="rounded-2xl border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-700">{statusMessage}</p> : null}

      {role === 'student' ? (
        <>
          <SectionCard title="Student setup" subtitle={studentStatus.message}>
            <form className="grid gap-4 md:grid-cols-3" onSubmit={saveStudentProfile}>
              <FormField label="Grade" name="grade" type="number" min="1" max="12" defaultValue={currentUser?.studentProfile?.grade ?? ''} placeholder="11" required />
              <FormField label="Curriculum" name="curriculum" defaultValue={currentUser?.studentProfile?.curriculum || ''} placeholder="CAPS" required />
              <FormField
                label="How did you hear about us?"
                name="discoverySource"
                defaultValue={currentUser?.studentProfile?.discoverySource || ''}
                placeholder="Instagram"
                required
              />
              <div className="md:col-span-3">
                <button type="submit" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">Save student profile</button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Payment methods (Paystack)">
            <PaymentMethodsManager user={user} setUser={setUser} onMessage={setStatusMessage} />
          </SectionCard>
        </>
      ) : (
        <SectionCard title="Tutor setup" subtitle={tutorStatus.message}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveTutorProfile}>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Live selfie verification</label>
              <LiveSelfieCapture user={currentUser} setUser={setUser} onMessage={setStatusMessage} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Result documents</label>
              <TutorDocumentsManager user={currentUser} onMessage={setStatusMessage} />
            </div>
            <FormField
              label="Grades to tutor (comma separated)"
              name="gradesToTutor"
              defaultValue={(currentUser?.tutorProfile?.gradesToTutor || []).join(', ')}
              placeholder="Grade 8, Grade 9"
              required
            />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Subjects you qualify to tutor</label>
              <QualifiedSubjectsManager user={currentUser} setUser={setUser} onMessage={setStatusMessage} />
            </div>
            <FormField label="Bank name" name="bankName" defaultValue={currentUser?.tutorProfile?.payout?.bankName || ''} required />
            <FormField label="Account number" name="accountNumber" defaultValue={currentUser?.tutorProfile?.payout?.accountNumber || ''} required />
            <FormField label="Account holder" name="accountHolder" defaultValue={currentUser?.tutorProfile?.payout?.accountHolder || ''} required />
            <div className="md:col-span-2">
              <button type="submit" disabled={isSavingTutorProfile} className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {isSavingTutorProfile ? 'Uploading files...' : 'Save tutor profile'}
              </button>
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  );
}
