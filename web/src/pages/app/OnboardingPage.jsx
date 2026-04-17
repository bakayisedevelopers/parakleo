import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import MultiSelectDropdown from '../../components/ui/MultiSelectDropdown';
import { useAuth } from '../../hooks/useAuth';
import { updateUserProfile } from '../../services/userService';
import { uploadUserFile } from '../../services/storageService';
import { DEFAULT_SUBJECTS, SUBJECT_OPTIONS, normalizeSubjectList } from '../../constants/subjects';
import {
  getStudentOnboardingStatus,
  getTutorOnboardingStatus,
  TUTOR_VERIFICATION_STATUSES,
} from '../../utils/onboarding';
import PaymentMethodsManager from '../../components/app/PaymentMethodsManager';

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const queryRole = searchParams.get('role');
  const role = queryRole === 'tutor' ? 'tutor' : 'student';
  const [statusMessage, setStatusMessage] = useState('');
  const [isSavingTutorProfile, setIsSavingTutorProfile] = useState(false);
  const [studentSubjects, setStudentSubjects] = useState(normalizeSubjectList(user?.subjects || DEFAULT_SUBJECTS));
  const [tutorSubjects, setTutorSubjects] = useState(normalizeSubjectList(user?.subjects || DEFAULT_SUBJECTS));

  useEffect(() => {
    const nextSubjects = normalizeSubjectList(user?.subjects || DEFAULT_SUBJECTS);
    setStudentSubjects(nextSubjects);
    setTutorSubjects(nextSubjects);
  }, [user?.subjects]);

  const studentStatus = useMemo(() => getStudentOnboardingStatus(user), [user]);
  const tutorStatus = useMemo(() => getTutorOnboardingStatus(user), [user]);

  const saveStudentProfile = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const profile = await updateUserProfile(user.uid, {
      studentProfile: {
        grade: Number(formData.get('grade')) || null,
        curriculum: formData.get('curriculum')?.toString().trim() || '',
        discoverySource: formData.get('discoverySource')?.toString().trim() || '',
      },
      subjects: studentSubjects.length ? studentSubjects : DEFAULT_SUBJECTS,
    });

    setUser((prev) => ({ ...prev, ...profile }));
    setStatusMessage('Student profile details saved.');
  };

  const saveTutorProfile = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const mathScore = Number(formData.get('mathScore'));
    const profilePhotoFile = formData.get('profilePhotoFile');
    const highestGradeResultFile = formData.get('highestGradeResultFile');

    if (!(profilePhotoFile instanceof File) || !profilePhotoFile.size) {
      setStatusMessage('Please upload a profile photo file.');
      return;
    }

    if (!(highestGradeResultFile instanceof File) || !highestGradeResultFile.size) {
      setStatusMessage('Please upload your highest grade result document.');
      return;
    }

    try {
      setIsSavingTutorProfile(true);

      const [photoUpload, resultUpload] = await Promise.all([
        uploadUserFile({ userId: user.uid, file: profilePhotoFile, pathPrefix: 'tutor-profile-photos' }),
        uploadUserFile({ userId: user.uid, file: highestGradeResultFile, pathPrefix: 'tutor-grade-results' }),
      ]);

      const profile = await updateUserProfile(user.uid, {
        profilePhoto: photoUpload.downloadUrl,
        tutorProfile: {
          ...(user?.tutorProfile || {}),
          highestGradeResultUrl: resultUpload.downloadUrl,
          mathScore,
          gradesToTutor: (formData.get('gradesToTutor')?.toString() || '').split(',').map((item) => item.trim()).filter(Boolean),
          verificationStatus: mathScore >= 60 ? TUTOR_VERIFICATION_STATUSES.VERIFIED : TUTOR_VERIFICATION_STATUSES.REJECTED,
          payout: {
            bankName: formData.get('bankName')?.toString().trim() || '',
            accountNumber: formData.get('accountNumber')?.toString().trim() || '',
            accountHolder: formData.get('accountHolder')?.toString().trim() || '',
          },
        },
        subjects: tutorSubjects.length ? tutorSubjects : DEFAULT_SUBJECTS,
      });

      setUser((prev) => ({ ...prev, ...profile }));
      setStatusMessage(mathScore >= 60 ? 'Tutor profile submitted and auto-verified for MVP.' : 'Tutor profile saved, score below 60% threshold.');
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
              <FormField label="Grade" name="grade" type="number" min="1" max="12" defaultValue={user?.studentProfile?.grade ?? ''} placeholder="11" required />
              <FormField label="Curriculum" name="curriculum" defaultValue={user?.studentProfile?.curriculum || ''} placeholder="CAPS" required />
              <FormField
                label="How did you hear about us?"
                name="discoverySource"
                defaultValue={user?.studentProfile?.discoverySource || ''}
                placeholder="Instagram"
                required
              />
              <div className="md:col-span-3">
                <MultiSelectDropdown
                  label="Subjects"
                  name="studentSubjects"
                  options={SUBJECT_OPTIONS}
                  value={studentSubjects}
                  onChange={setStudentSubjects}
                  helperText="Currently only Mathematics is available."
                  required
                />
              </div>
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
            <div>
              <label className="block text-sm font-semibold text-zinc-700">Highest grade result document</label>
              <input name="highestGradeResultFile" type="file" accept=".pdf,.jpg,.jpeg,.png" required className="mt-2 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700">Profile photo</label>
              <input name="profilePhotoFile" type="file" accept="image/*" required className="mt-2 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <FormField label="Math score %" name="mathScore" type="number" defaultValue={user?.tutorProfile?.mathScore ?? ''} required />
            <FormField
              label="Grades to tutor (comma separated)"
              name="gradesToTutor"
              defaultValue={(user?.tutorProfile?.gradesToTutor || []).join(', ')}
              placeholder="Grade 8, Grade 9"
              required
            />
            <div className="md:col-span-2">
              <MultiSelectDropdown
                label="Subjects"
                name="tutorSubjects"
                options={SUBJECT_OPTIONS}
                value={tutorSubjects}
                onChange={setTutorSubjects}
                helperText="Currently only Mathematics is available."
                required
              />
            </div>
            <FormField label="Bank name" name="bankName" defaultValue={user?.tutorProfile?.payout?.bankName || ''} required />
            <FormField label="Account number" name="accountNumber" defaultValue={user?.tutorProfile?.payout?.accountNumber || ''} required />
            <FormField label="Account holder" name="accountHolder" defaultValue={user?.tutorProfile?.payout?.accountHolder || ''} required />
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
