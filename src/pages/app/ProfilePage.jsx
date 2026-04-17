import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SectionCard from '../../components/ui/SectionCard';
import PageHeader from '../../components/ui/PageHeader';
import FormField from '../../components/ui/FormField';
import MultiSelectDropdown from '../../components/ui/MultiSelectDropdown';
import { useAuth } from '../../hooks/useAuth';
import { getStudentOnboardingStatus, getTutorOnboardingStatus } from '../../utils/onboarding';
import { getUserProfile, updateUserProfile } from '../../services/userService';
import { DEFAULT_SUBJECTS, SUBJECT_OPTIONS, normalizeSubjectList } from '../../constants/subjects';

export default function ProfilePage() {
  const { user, logout, deleteAccount, setUser } = useAuth();
  const navigate = useNavigate();
  const studentStatus = getStudentOnboardingStatus(user);
  const tutorStatus = getTutorOnboardingStatus(user);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    bio: '',
    subjects: DEFAULT_SUBJECTS,
    availability: '',
  });

  useEffect(() => {
    if (!user?.uid) return;

    getUserProfile(user.uid).then((profile) => {
      const profileData = profile || user;
      setForm({
        fullName: profileData.fullName || profileData.displayName || '',
        phoneNumber: profileData.phoneNumber || '',
        bio: profileData.bio || '',
        subjects: normalizeSubjectList(profileData.subjects || DEFAULT_SUBJECTS),
        availability: profileData.availability || '',
      });
    });
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const removeAccount = async () => {
    if (confirmText !== 'DELETE') {
      setMessage('Type DELETE to confirm account deletion.');
      return;
    }

    try {
      setIsDeleting(true);
      await deleteAccount(user);
      setUser(null);
      navigate('/');
    } catch (error) {
      setMessage(error.message || 'Unable to delete account. You may need to sign in again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;

    setIsSaving(true);
    setMessage('');
    const profile = await updateUserProfile(user.uid, {
      fullName: form.fullName,
      displayName: form.fullName,
      phoneNumber: form.phoneNumber,
      bio: form.bio,
      availability: form.availability,
      subjects: normalizeSubjectList(form.subjects).length ? normalizeSubjectList(form.subjects) : DEFAULT_SUBJECTS,
    });

    setUser((prev) => ({ ...prev, ...profile }));
    setMessage('Profile details saved.');
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & Settings" description="Manage your account, profile details, and onboarding progress in one place." />

      {!studentStatus.complete || (user?.roles || []).includes('tutor') && !tutorStatus.complete ? (
        <SectionCard title="Complete profile">
          <p className="text-sm text-zinc-700">Finish required onboarding details before requesting classes or teaching online.</p>
          <Link to={`/app/onboarding?role=${(user?.activeRole || user?.role || 'student').toLowerCase()}`} className="mt-3 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
            Open complete profile
          </Link>
        </SectionCard>
      ) : null}

      <SectionCard>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Full name" name="fullName" value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} required />
            <FormField label="Phone number" name="phoneNumber" value={form.phoneNumber} onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
          </div>
          <FormField label="Bio" name="bio" as="textarea" rows={3} value={form.bio} onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))} />
          <MultiSelectDropdown
            label="Subjects"
            name="subjects"
            options={SUBJECT_OPTIONS}
            value={form.subjects}
            onChange={(subjects) => setForm((prev) => ({ ...prev, subjects }))}
            helperText="Currently only Mathematics is available."
          />
          {(user?.activeRole || user?.role) === 'tutor' ? (
            <>
              <FormField label="Availability" name="availability" value={form.availability} onChange={(event) => setForm((prev) => ({ ...prev, availability: event.target.value }))} placeholder="Weekdays after 5pm" />
            </>
          ) : null}

          <button type="submit" disabled={isSaving} className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </SectionCard>

      <SectionCard action={<button type="button" onClick={handleLogout} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">Log out</button>}>
        <dl className="grid gap-6 sm:grid-cols-2 text-zinc-800">
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt><dd className="mt-1 text-lg font-semibold">{user?.email}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Role</dt><dd className="mt-1 text-lg font-semibold capitalize">{user?.activeRole || user?.role}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Student onboarding</dt><dd className="mt-1 text-sm">{studentStatus.complete ? 'Complete' : studentStatus.message}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Tutor onboarding</dt><dd className="mt-1 text-sm">{tutorStatus.complete ? 'Complete' : tutorStatus.message}</dd></div>
        </dl>
      </SectionCard>

      {(user?.activeRole || user?.role) === 'student' ? (
        <SectionCard title="Free minutes & referrals" subtitle="Share your code to earn +30 free minutes when a referred student completes signup and verifies email.">
          <div className="space-y-2 text-sm text-zinc-700">
            <p><span className="font-semibold">Free minutes remaining:</span> {Number(user?.freeMinutesRemaining || 0).toFixed(2)} min</p>
            <p><span className="font-semibold">Referral code:</span> {user?.referralCode || 'Not assigned yet'}</p>
            <p className="text-xs text-zinc-500">
              Share link: {`${window.location.origin}/signup?ref=${encodeURIComponent(user?.referralCode || '')}`}
            </p>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Delete account" subtitle="This permanently removes your profile and access.">
        <div className="space-y-3">
          <p className="text-sm text-rose-600">Type DELETE below to confirm permanent account deletion.</p>
          <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className="w-full max-w-sm rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900" placeholder="Type DELETE" />
          <button type="button" onClick={removeAccount} disabled={isDeleting} className="rounded-2xl border border-rose-500/40 px-4 py-2 text-sm font-bold text-rose-600 disabled:opacity-50">
            {isDeleting ? 'Deleting account...' : 'Delete my account'}
          </button>
          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}
