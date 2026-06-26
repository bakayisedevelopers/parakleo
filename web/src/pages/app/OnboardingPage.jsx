import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import LiveSelfieCapture from '../../components/app/LiveSelfieCapture';
import QualifiedSubjectsManager from '../../components/app/QualifiedSubjectsManager';
import TutorDocumentsManager from '../../components/app/TutorDocumentsManager';
import StudentSubjectPicker from '../../components/app/StudentSubjectPicker';
import SelectField from '../../components/ui/SelectField';
import PaymentMethodsManager from '../../components/app/PaymentMethodsManager';
import { useAuth } from '../../hooks/useAuth';
import { useLiveUserProfile } from '../../hooks/useLiveUserProfile';
import { updateUserProfile } from '../../services/userService';
import { listTutorPayoutBanks, verifyTutorPayoutAccount } from '../../services/tutorPayoutService';
import {
  getStudentOnboardingStatus,
  getTutorOnboardingStatus,
  hasCurrentTutorAgreement,
  STUDENT_PROFILE_STEPS,
  TUTOR_PROFILE_STEPS,
} from '../../utils/onboarding';
import { syncStudentGrowth } from '../../services/studentGrowthService';
import { normalizeSubjectList } from '../../constants/subjects';

const PAYOUT_ACCOUNT_TYPE_OPTIONS = [
  { value: 'personal', label: 'Personal' },
];

const PAYOUT_DOCUMENT_TYPE_OPTIONS = [
  { value: 'identityNumber', label: 'South African ID number' },
  { value: 'passportNumber', label: 'Passport number' },
];

function buildNextOnboardingProgress(currentProgress = {}, nextStep = null, complete = false) {
  return {
    ...currentProgress,
    currentStep: complete ? null : nextStep,
    complete,
    updatedAt: new Date().toISOString(),
  };
}

function stepRailClass(isActive, isComplete) {
  if (isActive) return 'border-brand bg-brand text-white';
  if (isComplete) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-zinc-200 bg-white text-zinc-500';
}

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const { profile: liveProfile } = useLiveUserProfile(user?.uid);
  const currentUser = liveProfile || user;
  const [searchParams] = useSearchParams();
  const queryRole = searchParams.get('role');
  const role = queryRole === 'tutor' ? 'tutor' : 'student';
  const [statusMessage, setStatusMessage] = useState('');
  const [isSavingTutorPayout, setIsSavingTutorPayout] = useState(false);
  const [tutorGradesToTutor, setTutorGradesToTutor] = useState(currentUser?.tutorProfile?.gradesToTutor?.join(', ') || '');
  const [studentGrade, setStudentGrade] = useState(String(currentUser?.studentProfile?.grade || ''));
  const [studentCurriculum, setStudentCurriculum] = useState(currentUser?.studentProfile?.curriculum || '');
  const [studentDiscoverySource, setStudentDiscoverySource] = useState(currentUser?.studentProfile?.discoverySource || '');
  const [studentSubjects, setStudentSubjects] = useState(normalizeSubjectList(currentUser?.subjects || []));
  const [payoutBanks, setPayoutBanks] = useState([]);
  const [selectedPayoutBankCode, setSelectedPayoutBankCode] = useState(currentUser?.tutorProfile?.payout?.bankCode || '');
  const [payoutDocumentType, setPayoutDocumentType] = useState(currentUser?.tutorProfile?.payout?.documentType || 'identityNumber');

  const studentStatus = useMemo(() => getStudentOnboardingStatus(currentUser), [currentUser]);
  const tutorStatus = useMemo(() => getTutorOnboardingStatus(currentUser), [currentUser]);
  const activeStatus = role === 'tutor' ? tutorStatus : studentStatus;
  const activeStep = activeStatus.step;

  const selectedPayoutBank = payoutBanks.find((bank) => bank.code === selectedPayoutBankCode)
    || (currentUser?.tutorProfile?.payout?.bankCode === selectedPayoutBankCode
      ? {
        name: currentUser?.tutorProfile?.payout?.bankName || '',
        code: selectedPayoutBankCode,
      }
      : null);
  const payoutDocumentNumberLabel = payoutDocumentType === 'passportNumber' ? 'Passport number' : 'South African ID number';
  const payoutVerificationState = String(currentUser?.tutorProfile?.payout?.verificationStatus || '').trim().toLowerCase();
  const payoutVerificationMessage = currentUser?.tutorProfile?.payout?.verificationMessage || '';
  const tutorAgreementAccepted = hasCurrentTutorAgreement(currentUser);

  useEffect(() => {
    setTutorGradesToTutor(currentUser?.tutorProfile?.gradesToTutor?.join(', ') || '');
    setStudentGrade(String(currentUser?.studentProfile?.grade || ''));
    setStudentCurriculum(currentUser?.studentProfile?.curriculum || '');
    setStudentDiscoverySource(currentUser?.studentProfile?.discoverySource || '');
    setStudentSubjects(normalizeSubjectList(currentUser?.subjects || []));
    setPayoutDocumentType(currentUser?.tutorProfile?.payout?.documentType || 'identityNumber');
  }, [
    currentUser?.studentProfile?.curriculum,
    currentUser?.studentProfile?.discoverySource,
    currentUser?.studentProfile?.grade,
    currentUser?.tutorProfile?.gradesToTutor,
    currentUser?.tutorProfile?.payout?.documentType,
    currentUser?.subjects,
  ]);

  useEffect(() => {
    if (role !== 'tutor' || !user?.uid) return undefined;

    let cancelled = false;
    listTutorPayoutBanks()
      .then((banks) => {
        if (cancelled) return;
        setPayoutBanks(banks);
        if (!selectedPayoutBankCode && banks[0]?.code) {
          setSelectedPayoutBankCode(banks[0].code);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusMessage(error.message || 'Unable to load payout banks.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [role, selectedPayoutBankCode, user?.uid]);

  useEffect(() => {
    if (role !== 'tutor') return;
    if (selectedPayoutBankCode) return;
    const existingBankCode = String(currentUser?.tutorProfile?.payout?.bankCode || '').trim();
    if (existingBankCode) {
      setSelectedPayoutBankCode(existingBankCode);
    }
  }, [currentUser?.tutorProfile?.payout?.bankCode, role, selectedPayoutBankCode]);

  useEffect(() => {
    if (!user?.uid) return;

    const existingProgress = currentUser?.onboardingProgress?.[role] || {};
    const desiredStep = activeStatus.complete ? null : activeStep;
    if (String(existingProgress.currentStep || '') === String(desiredStep || '')
      && Boolean(existingProgress.complete) === Boolean(activeStatus.complete)) {
      return;
    }

    const nextProgress = {
      ...(currentUser?.onboardingProgress || {}),
      [role]: buildNextOnboardingProgress(existingProgress, desiredStep, activeStatus.complete),
    };

    updateUserProfile(user.uid, { onboardingProgress: nextProgress })
      .then((profile) => setUser((prev) => ({ ...prev, ...profile })))
      .catch(() => null);
  }, [activeStep, activeStatus.complete, currentUser, role, setUser, user?.uid]);

  const saveStudentProfile = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;

    try {
      const profile = await updateUserProfile(user.uid, {
        studentProfile: {
          grade: Number(studentGrade) || null,
          curriculum: studentCurriculum.trim(),
          discoverySource: studentDiscoverySource.trim(),
        },
        subjects: studentSubjects,
      });
      const syncedProfile = await syncStudentGrowth().catch(() => null);

      setUser((prev) => ({ ...prev, ...profile, ...(syncedProfile || {}) }));
      setStatusMessage('Student profile details saved.');
    } catch (error) {
      setStatusMessage(error.message || 'Unable to save student profile.');
    }
  };

  const saveTutorProfileDetails = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;

    if (!currentUser?.selfieVerified || !currentUser?.selfieUrl) {
      setStatusMessage('Please capture and save a live selfie before saving tutor setup.');
      return;
    }

    try {
      const gradesToTutor = (tutorGradesToTutor || '').split(',').map((item) => item.trim()).filter(Boolean);
      const profile = await updateUserProfile(user.uid, {
        tutorProfile: {
          ...(currentUser?.tutorProfile || {}),
          gradesToTutor,
        },
      });
      setUser((prev) => ({ ...prev, ...profile }));
      setStatusMessage('Tutor profile details saved.');
    } catch (error) {
      setStatusMessage(error.message || 'Unable to save tutor profile.');
    }
  };

  const saveTutorPayout = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;

    const formData = new FormData(event.currentTarget);
    try {
      setIsSavingTutorPayout(true);
      setStatusMessage('Saving tutor payout details...');

      const existingTutorProfile = currentUser?.tutorProfile || {};
      const existingPayout = existingTutorProfile?.payout || {};
      const payoutInput = {
        bankName: selectedPayoutBank?.name || existingPayout.bankName || '',
        bankCode: selectedPayoutBank?.code || existingPayout.bankCode || '',
        accountNumber: formData.get('accountNumber')?.toString().trim() || '',
        accountHolder: formData.get('accountHolder')?.toString().trim() || '',
        accountType: formData.get('accountType')?.toString().trim() || 'personal',
        documentType: payoutDocumentType,
        documentNumber: formData.get('documentNumber')?.toString().trim() || '',
      };

      const profile = await updateUserProfile(user.uid, {
        tutorProfile: {
          ...existingTutorProfile,
          payout: {
            ...existingPayout,
            ...payoutInput,
            verified: false,
            verificationStatus: 'pending',
            verificationMessage: 'Verification in progress.',
            verificationCheckedAt: new Date().toISOString(),
          },
        },
      });

      setUser((prev) => ({ ...prev, ...profile }));

      if (!payoutInput.bankCode || !payoutInput.bankName) {
        const profileWithoutBankVerification = await updateUserProfile(user.uid, {
          tutorProfile: {
            ...((profile?.tutorProfile) || existingTutorProfile),
            payout: {
              ...((((profile?.tutorProfile) || existingTutorProfile)?.payout) || {}),
              verificationStatus: 'unverified',
              verificationMessage: 'Select a bank and re-save to verify payout details.',
              verificationCheckedAt: new Date().toISOString(),
            },
          },
        });
        setUser((prev) => ({ ...prev, ...profileWithoutBankVerification }));
        setStatusMessage('Tutor profile and bank details saved. Select a payout bank to run verification.');
        return;
      }

      setStatusMessage('Tutor profile and bank details saved. Verifying payout account details...');

      try {
        const verifiedPayout = await verifyTutorPayoutAccount(payoutInput);
        const profileWithPayout = await updateUserProfile(user.uid, {
          tutorProfile: {
            ...(profile?.tutorProfile || existingTutorProfile),
            payout: {
              ...verifiedPayout,
              verificationStatus: verifiedPayout?.verified ? 'verified' : 'unverified',
              verificationMessage: verifiedPayout?.validationMessage || 'Payout details verified successfully.',
              verificationCheckedAt: new Date().toISOString(),
            },
          },
        });
        setUser((prev) => ({ ...prev, ...profileWithPayout }));
        setStatusMessage('Tutor profile and bank details saved. Payout account verified.');
      } catch (verificationError) {
        const profileWithVerificationFailure = await updateUserProfile(user.uid, {
          tutorProfile: {
            ...(profile?.tutorProfile || existingTutorProfile),
            payout: {
              ...((((profile?.tutorProfile) || existingTutorProfile)?.payout) || {}),
              verified: false,
              verificationStatus: 'unverified',
              verificationMessage: verificationError.message || 'Unable to verify payout account.',
              verificationCheckedAt: new Date().toISOString(),
            },
          },
        });
        setUser((prev) => ({ ...prev, ...profileWithVerificationFailure }));
        setStatusMessage(
          verificationError.message
            || 'Tutor profile and banking details saved, but verification failed.',
        );
      }
    } catch (error) {
      setStatusMessage(error.message || 'Unable to save tutor payout details.');
    } finally {
      setIsSavingTutorPayout(false);
    }
  };

  const stepLabels = role === 'tutor'
    ? [
      { key: TUTOR_PROFILE_STEPS.AGREEMENT, label: 'Agreement' },
      { key: TUTOR_PROFILE_STEPS.PROFILE, label: 'Profile' },
      { key: TUTOR_PROFILE_STEPS.QUALIFICATIONS, label: 'Results' },
      { key: TUTOR_PROFILE_STEPS.POLICE_CLEARANCE, label: 'Clearance' },
      { key: TUTOR_PROFILE_STEPS.PAYOUT, label: 'Payout' },
      { key: TUTOR_PROFILE_STEPS.SUBJECTS, label: 'Subjects' },
    ]
    : [
      { key: STUDENT_PROFILE_STEPS.ACADEMIC, label: 'Profile' },
      { key: STUDENT_PROFILE_STEPS.PAYMENT, label: 'Payment' },
    ];
  const currentStepIndex = stepLabels.findIndex((step) => step.key === activeStep);

  const renderStudentStep = () => {
    if (activeStep === STUDENT_PROFILE_STEPS.PAYMENT) {
      return (
        <SectionCard
          title="Step 2 of 2: Payment methods"
          subtitle={studentStatus.message}
        >
          <PaymentMethodsManager user={currentUser} setUser={setUser} onMessage={setStatusMessage} />
        </SectionCard>
      );
    }

    return (
      <SectionCard
        title="Step 1 of 2: Student profile"
        subtitle={studentStatus.message}
      >
        <form className="grid gap-4 md:grid-cols-3" onSubmit={saveStudentProfile}>
          <FormField
            label="Grade"
            name="grade"
            type="number"
            min="1"
            max="12"
            value={studentGrade}
            onChange={(event) => setStudentGrade(event.target.value)}
            placeholder="11"
            required
          />
          <FormField
            label="Curriculum"
            name="curriculum"
            value={studentCurriculum}
            onChange={(event) => setStudentCurriculum(event.target.value)}
            placeholder="CAPS"
            required
          />
          <FormField
            label="How did you hear about us?"
            name="discoverySource"
            value={studentDiscoverySource}
            onChange={(event) => setStudentDiscoverySource(event.target.value)}
            placeholder="Instagram"
            required
          />
          <div className="md:col-span-3">
            <label className="mb-2 block text-sm font-semibold text-zinc-700">Subjects</label>
            <StudentSubjectPicker value={studentSubjects} onChange={setStudentSubjects} />
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">
              Save student profile
            </button>
            <p className="text-xs text-zinc-500">
              This step also unlocks the payment setup stage.
            </p>
          </div>
        </form>
      </SectionCard>
    );
  };

  const renderTutorStep = () => {
    if (activeStep === TUTOR_PROFILE_STEPS.AGREEMENT) {
      return (
        <SectionCard
          title="Step 1 of 6: Tutor agreement"
          subtitle={tutorStatus.message}
        >
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Please review and accept the latest Tutor Agreement to continue.
            {' '}
            <Link className="font-semibold underline" to="/app/tutor/agreement">Open agreement</Link>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-zinc-700 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Current version</p>
              <p className="mt-1 font-semibold text-zinc-900">{currentUser?.tutorAgreement?.requiredVersion || '1.0.1'}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Accepted version</p>
              <p className="mt-1 font-semibold text-zinc-900">{currentUser?.tutorAgreement?.acceptedVersion || 'Not accepted yet'}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
              <p className="mt-1 font-semibold text-zinc-900">{tutorAgreementAccepted ? 'Signed' : 'Action required'}</p>
            </div>
          </div>
        </SectionCard>
      );
    }

    if (activeStep === TUTOR_PROFILE_STEPS.PROFILE) {
      return (
        <SectionCard
          title="Step 2 of 6: Tutor profile"
          subtitle={tutorStatus.message}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-zinc-800">Live selfie</h3>
              <LiveSelfieCapture user={currentUser} setUser={setUser} onMessage={setStatusMessage} />
            </div>
            <form className="space-y-4" onSubmit={saveTutorProfileDetails}>
              <FormField
                label="Grades to tutor (comma separated)"
                name="gradesToTutor"
                value={tutorGradesToTutor}
                onChange={(event) => setTutorGradesToTutor(event.target.value)}
                placeholder="Grade 8, Grade 9"
                required
              />
              <button type="submit" className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white">
                Save tutor profile
              </button>
              <p className="text-xs text-zinc-500">
                This stage needs a saved selfie before you can continue.
              </p>
            </form>
          </div>
        </SectionCard>
      );
    }

    if (activeStep === TUTOR_PROFILE_STEPS.QUALIFICATIONS) {
      return (
        <SectionCard
          title="Step 3 of 6: Result documents"
          subtitle={tutorStatus.message}
        >
          <TutorDocumentsManager
            user={currentUser}
            onMessage={setStatusMessage}
          />
        </SectionCard>
      );
    }

    if (activeStep === TUTOR_PROFILE_STEPS.POLICE_CLEARANCE) {
      return (
        <SectionCard
          title="Step 4 of 6: Police clearance"
          subtitle={tutorStatus.message}
        >
          <TutorDocumentsManager
            user={currentUser}
            onMessage={setStatusMessage}
            documentType="police_clearance"
            title="Police clearance"
            subtitle="PDF, JPG, JPEG, or PNG. Upload your police clearance or criminal check document."
            uploadLabel="Upload police clearance"
            emptyMessage="Upload a police clearance or criminal check document so admin can verify your profile."
            allowRetry={false}
          />
        </SectionCard>
      );
    }

    if (activeStep === TUTOR_PROFILE_STEPS.PAYOUT) {
      return (
        <SectionCard
          title="Step 5 of 6: Payout details"
          subtitle={tutorStatus.message}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveTutorPayout}>
            <SelectField
              label="Bank"
              name="bankCode"
              value={selectedPayoutBankCode}
              onChange={(event) => setSelectedPayoutBankCode(event.target.value)}
              options={[
                { value: '', label: payoutBanks.length ? 'Select bank' : 'Loading banks...' },
                ...payoutBanks.map((bank) => ({ value: bank.code, label: bank.name })),
              ]}
              required
            />
            <FormField label="Account number" name="accountNumber" defaultValue={currentUser?.tutorProfile?.payout?.accountNumber || ''} required />
            <FormField label="Account holder" name="accountHolder" defaultValue={currentUser?.tutorProfile?.payout?.accountHolder || ''} required />
            <SelectField label="Account type" name="accountType" defaultValue={currentUser?.tutorProfile?.payout?.accountType || 'personal'} options={PAYOUT_ACCOUNT_TYPE_OPTIONS} required />
            <SelectField
              label="Verification document"
              name="documentType"
              value={payoutDocumentType}
              onChange={(event) => setPayoutDocumentType(event.target.value)}
              options={PAYOUT_DOCUMENT_TYPE_OPTIONS}
              required
            />
            <FormField label={payoutDocumentNumberLabel} name="documentNumber" defaultValue={currentUser?.tutorProfile?.payout?.documentNumber || ''} required />
            <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <span className="font-semibold">Payout verification status:</span>{' '}
              {payoutVerificationState === 'verified' ? 'Verified' : (payoutVerificationState || 'unverified')}
              {payoutVerificationMessage ? (
                <p className="mt-1 text-xs text-zinc-600">{payoutVerificationMessage}</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={isSavingTutorPayout} className="rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {isSavingTutorPayout ? 'Verifying payout details...' : 'Save tutor payout'}
              </button>
            </div>
          </form>
        </SectionCard>
      );
    }

    return (
      <SectionCard
        title="Step 6 of 6: Active subjects"
        subtitle={tutorStatus.message}
      >
        <QualifiedSubjectsManager user={currentUser} setUser={setUser} onMessage={setStatusMessage} />
      </SectionCard>
    );
  };

  const renderCurrentRoleStep = () => (role === 'tutor' ? renderTutorStep() : renderStudentStep());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complete Your Profile"
        description={role === 'tutor'
          ? 'Finish tutor onboarding in order. Your profile will be reviewed by an admin before you can receive requests.'
          : 'Finish student onboarding in order. Once complete, you can request classes immediately.'}
      />

      {statusMessage ? <p className="rounded-2xl border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-700">{statusMessage}</p> : null}

      <SectionCard
        title="Onboarding progress"
        subtitle={activeStatus.message}
      >
        <div className="flex flex-wrap gap-2">
          {stepLabels.map((step, index) => (
            <span
              key={step.key}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${stepRailClass(step.key === activeStep, index < currentStepIndex || activeStatus.complete)}`}
            >
              <span>{index + 1}.</span>
              <span>{step.label}</span>
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">
            {activeStatus.complete
              ? role === 'tutor'
                ? (tutorStatus.verificationStatus === 'verified' ? 'Tutor profile verified' : 'Tutor profile complete, pending admin verification')
                : 'Student profile complete'
              : activeStatus.title}
          </p>
          <p className="mt-1">
            {activeStatus.complete
              ? role === 'tutor'
                ? 'You can use the dashboard, but tutors only receive requests after admin verification.'
                : 'You can request classes right away.'
              : activeStatus.message}
          </p>
        </div>
      </SectionCard>

      {renderCurrentRoleStep()}
    </div>
  );
}
