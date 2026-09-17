export const STUDENT_PROFILE_STEPS = {
  ACADEMIC: 'academic_profile',
  SAFETY: 'safety_profile',
  PAYMENT: 'payment_setup',
};

export function getStudentOnboardingStatus(user) {
  const studentProfile = user?.studentProfile || {};
  const paymentMethods = Array.isArray(user?.paymentMethods) ? user.paymentMethods : [];
  const subjects = Array.isArray(user?.subjects) ? user.subjects : [];
  const safety = studentProfile?.safety || user?.safety || {};

  const hasAcademic = Boolean(
    studentProfile.grade
      && studentProfile.curriculum
      && studentProfile.discoverySource
      && subjects.length,
  );

  const isMinor = safety.learnerType === 'minor' || Boolean(safety.isMinor);
  const isAdult = safety.learnerType === 'adult';
  const hasGuardianConsent = Boolean(
    safety.guardian?.name
      && safety.guardian?.relationship
      && safety.guardian?.phoneNumber
      && safety.guardian?.consentAcceptedAt,
  );

  const hasSafety = isAdult || (isMinor && hasGuardianConsent);
  const hasPayment = paymentMethods.length > 0 || user?.paymentPreferences?.defaultCash === true;

  if (hasAcademic && hasSafety && hasPayment) {
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

  if (!hasSafety) {
    return {
      complete: false,
      step: STUDENT_PROFILE_STEPS.SAFETY,
      title: 'Safety & Guardian Setup',
      message: isMinor
        ? 'Complete parent/guardian details and in-person consent to continue.'
        : 'Confirm learner safety profile and preferences to continue.',
    };
  }

  return {
    complete: false,
    step: STUDENT_PROFILE_STEPS.PAYMENT,
    title: 'Add a payment method',
    message: 'Add and verify at least one card before requesting a class.',
  };
}

