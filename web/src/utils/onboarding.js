export const STUDENT_PROFILE_STEPS = {
  ACADEMIC: 'academic_profile',
  PAYMENT: 'payment_setup',
};

export const TUTOR_PROFILE_STEPS = {
  QUALIFICATIONS: 'qualifications',
  PAYOUT: 'payout_setup',
  PROFILE: 'profile_setup',
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
  const paymentMethods = user?.paymentMethods || [];

  const hasAcademic = Boolean(studentProfile.grade && studentProfile.curriculum && studentProfile.discoverySource);
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
      message: 'Add grade, curriculum, and discovery source to continue.',
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
  const hasQualification = Boolean(tutorProfile.highestGradeResultUrl && typeof tutorProfile.mathScore === 'number');
  const qualified = hasQualification && tutorProfile.mathScore >= 60;
  const hasPayout = Boolean(tutorProfile.payout?.bankName && tutorProfile.payout?.accountNumber && tutorProfile.payout?.accountHolder);
  const hasProfile = Boolean(user?.profilePhoto && tutorProfile.gradesToTutor?.length && (user?.subjects || []).length);
  if (qualified && hasPayout && hasProfile) {
    return {
      complete: true,
      verificationStatus: tutorProfile.verificationStatus || TUTOR_VERIFICATION_STATUSES.PENDING,
      step: null,
      title: 'Tutor profile complete',
      message: 'Set your online status when you are ready to teach.',
    };
  }

  if (!hasQualification || !qualified) {
    return {
      complete: false,
      step: TUTOR_PROFILE_STEPS.QUALIFICATIONS,
      title: 'Upload and pass qualification check',
      message: 'Math score must be at least 60% to tutor on Claxi.',
    };
  }

  if (!hasPayout) {
    return {
      complete: false,
      step: TUTOR_PROFILE_STEPS.PAYOUT,
      title: 'Add payout details',
      message: 'Add banking details so Claxi can send your 73% payout share.',
    };
  }

  return {
    complete: false,
    step: TUTOR_PROFILE_STEPS.PROFILE,
    title: 'Complete tutor profile',
      message: 'Add profile photo, grades, and subjects to finish setup.',
  };
}

export function getProfileStatusByRole(user, role) {
  if (role === 'tutor') {
    return getTutorOnboardingStatus(user);
  }
  return getStudentOnboardingStatus(user);
}
