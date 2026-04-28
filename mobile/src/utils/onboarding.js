export const STUDENT_PROFILE_STEPS = {
  ACADEMIC: 'academic_profile',
  PAYMENT: 'payment_setup',
};

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
