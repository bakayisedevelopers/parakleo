export const STUDENT_PROFILE_STEPS = {
  ACADEMIC: 'academic_profile',
  PAYMENT: 'payment_setup',
};

export const TUTOR_PROFILE_STEPS = {
  AGREEMENT: 'agreement',
  PROFILE: 'profile_setup',
  QUALIFICATIONS: 'qualifications',
  POLICE_CLEARANCE: 'police_clearance',
  PAYOUT: 'payout_setup',
  SUBJECTS: 'subject_selection',
};

export const TUTOR_VERIFICATION_STATUSES = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

export const PLATFORM_FEE_RATE = 0.27;
export const TUTOR_PAYOUT_RATE = 0.73;
export const BILLING_CURRENCY = 'ZAR';

export function getStudentOnboardingStatus(user) {
  const studentProfile = user?.studentProfile || {};
  const paymentMethods = Array.isArray(user?.paymentMethods) ? user.paymentMethods : [];
  const subjects = Array.isArray(user?.subjects) ? user.subjects : [];

  const hasAcademic = Boolean(
    studentProfile.grade
      && studentProfile.curriculum
      && studentProfile.discoverySource
      && subjects.length,
  );
  const hasPayment = paymentMethods.length > 0;

  if (hasAcademic && hasPayment) {
    return {
      complete: true,
      step: null,
      title: 'Student profile complete',
      message: 'You can request classes instantly.',
    };
  }

  if (!hasAcademic) {
    return {
      complete: false,
      step: STUDENT_PROFILE_STEPS.ACADEMIC,
      title: 'Complete student profile',
      message: 'Add grade, curriculum, discovery source, and subjects to continue.',
    };
  }

  return {
    complete: false,
    step: STUDENT_PROFILE_STEPS.PAYMENT,
    title: 'Add a payment method',
    message: 'Add and verify at least one card before requesting a class.',
  };
}

export function getTutorOnboardingStatus(user) {
  const tutorProfile = user?.tutorProfile || {};
  const qualifiedSubjects = Array.isArray(user?.qualifiedSubjects) ? user.qualifiedSubjects : [];
  const activeSubjects = Array.isArray(user?.activeSubjects) ? user.activeSubjects : [];
  const hasCurrentAgreement = isTutorAgreementCurrent(user?.tutorAgreement || {});
  const policeClearance = tutorProfile.policeClearance || {};
  const hasProfile = Boolean(
    user?.selfieVerified
      && user?.selfieUrl
      && Array.isArray(tutorProfile.gradesToTutor)
      && tutorProfile.gradesToTutor.length,
  );
  const hasQualification = qualifiedSubjects.length > 0;
  const hasPoliceClearance = Boolean(
    policeClearance.fileUrl
      || policeClearance.documentId
      || tutorProfile.policeClearanceSubmittedAt,
  );
  const hasPayout = Boolean(
    tutorProfile.payout?.bankName
    && tutorProfile.payout?.accountNumber
    && tutorProfile.payout?.accountHolder
    && tutorProfile.payout?.bankCode
    && tutorProfile.payout?.paystackRecipientCode
    && (tutorProfile.payout?.verificationStatus === 'verified' || tutorProfile.payout?.verified === true),
  );
  const hasSubjects = activeSubjects.length > 0;

  if (!hasCurrentAgreement) {
    return {
      complete: false,
      step: TUTOR_PROFILE_STEPS.AGREEMENT,
      title: 'Accept the Tutor Agreement',
      message: 'Please review and accept the latest Tutor Agreement to complete your tutor profile.',
    };
  }

  if (hasProfile && hasQualification && hasPoliceClearance && hasPayout && hasSubjects) {
    const verificationStatus = String(tutorProfile.verificationStatus || TUTOR_VERIFICATION_STATUSES.PENDING).toLowerCase();
    return {
      complete: true,
      verificationStatus,
      step: null,
      title: verificationStatus === TUTOR_VERIFICATION_STATUSES.VERIFIED
        ? 'Tutor profile verified'
        : 'Tutor profile complete',
      message: verificationStatus === TUTOR_VERIFICATION_STATUSES.VERIFIED
        ? 'You can receive requests now.'
        : 'Your profile is complete and waiting for admin verification before you can receive requests.',
    };
  }

  if (!hasProfile) {
    return {
      complete: false,
      step: TUTOR_PROFILE_STEPS.PROFILE,
      title: 'Complete tutor profile',
      message: 'Capture a live selfie and add the grades you teach.',
    };
  }

  if (!hasQualification) {
    return {
      complete: false,
      step: TUTOR_PROFILE_STEPS.QUALIFICATIONS,
      title: 'Upload and pass qualification check',
      message: 'Upload results so Parakleo can verify subjects with marks of at least 60%.',
    };
  }

  if (!hasPoliceClearance) {
    return {
      complete: false,
      step: TUTOR_PROFILE_STEPS.POLICE_CLEARANCE,
      title: 'Upload police clearance',
      message: 'Upload your police clearance or criminal check document to continue.',
    };
  }

  if (!hasPayout) {
    return {
      complete: false,
      step: TUTOR_PROFILE_STEPS.PAYOUT,
      title: 'Add payout details',
      message: 'Add banking details so Parakleo can send your 73% payout share.',
    };
  }

  return {
    complete: false,
    step: TUTOR_PROFILE_STEPS.SUBJECTS,
    title: 'Choose active subjects',
    message: 'Select the subjects you want active for tutor matching.',
  };
}

export function getProfileStatusByRole(user, role) {
  if (role === 'tutor') {
    return getTutorOnboardingStatus(user);
  }
  return getStudentOnboardingStatus(user);
}

export function hasCurrentTutorAgreement(user) {
  return isTutorAgreementCurrent(user?.tutorAgreement || {});
}

export function hasCompletedTutorProfile(user) {
  return getTutorOnboardingStatus(user).complete;
}

export function isTutorAgreementCurrent(tutorAgreement = {}) {
  const requiredVersion = String(tutorAgreement.requiredVersion || '1.0.1').trim();
  const acceptedVersion = String(tutorAgreement.acceptedVersion || '').trim();
  const acceptedCurrentVersion = tutorAgreement.currentVersionAccepted === true || tutorAgreement.acceptedCurrentVersion === true;
  return Boolean(
    acceptedCurrentVersion
      && requiredVersion
      && acceptedVersion
      && requiredVersion === acceptedVersion,
  );
}
