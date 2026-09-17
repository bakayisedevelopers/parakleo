export function isTutorAgreementCurrent(user = {}) {
  const agreements = user?.agreements || user || {};
  const tutorAgreement = user?.tutorAgreement || {};
  const requiredVersion = String(tutorAgreement.requiredVersion || '').trim();
  const acceptedVersion = String(tutorAgreement.acceptedVersion || '').trim();
  const acceptedCurrentVersion = tutorAgreement.currentVersionAccepted === true
    || tutorAgreement.acceptedCurrentVersion === true;

  return Boolean(
    agreements?.tutorAgreementSigned
      || (acceptedCurrentVersion && acceptedVersion && (!requiredVersion || requiredVersion === acceptedVersion)),
  );
}

export function getTutorOnboardingStatus(user = {}) {
  const tutorProfile = user?.tutorProfile || {};
  const agreements = user?.agreements || {};
  const payout =
    (tutorProfile?.payout?.accountNumber ? tutorProfile.payout : null) ||
    (tutorProfile?.bankingDetails?.accountNumber ? tutorProfile.bankingDetails : null) ||
    (user?.payout?.accountNumber ? user.payout : null) ||
    (user?.bankingDetails?.accountNumber ? user.bankingDetails : null) ||
    tutorProfile?.payout ||
    tutorProfile?.bankingDetails ||
    user?.payout ||
    user?.bankingDetails ||
    {};
  const policeClearance = tutorProfile?.policeClearance || {};
  const activeSubjects = Array.isArray(user?.activeSubjects) ? user.activeSubjects : [];
  const hasSelfie = Boolean(String(user?.selfieUrl || user?.profilePhoto || '').trim());

  const hasPersonalDetails = Boolean(
    (user?.fullName || user?.displayName) &&
    (user?.phoneNumber || user?.phone || tutorProfile?.phone) &&
    hasSelfie
  );

  const hasSubjects = Boolean(
    (Array.isArray(tutorProfile?.teachingSubjects) && tutorProfile.teachingSubjects.length > 0) ||
    activeSubjects.length > 0
  );

  const idDocument = tutorProfile?.idDocument || {};
  const hasPoliceClearance = Boolean(
    policeClearance?.fileUrl ||
    policeClearance?.documentId ||
    tutorProfile?.policeClearanceSubmittedAt ||
    tutorProfile?.policeClearanceRef
  );

  const hasRightToWork = Boolean(
    idDocument?.fileUrl ||
    idDocument?.documentId ||
    tutorProfile?.idVerificationUrl ||
    tutorProfile?.idDocumentSubmittedAt
  );

  const hasPayout = Boolean(
    payout?.bankName &&
    payout?.accountNumber &&
    payout?.accountHolder &&
    (payout?.verificationStatus === 'verified' || payout?.verified === true || payout?.status === 'verified' || Boolean(payout?.bankCode))
  );

  const hasAgreementSigned = isTutorAgreementCurrent(user);

  const complete = Boolean(
    hasAgreementSigned &&
    hasPersonalDetails &&
    hasSubjects &&
    hasPoliceClearance &&
    hasRightToWork &&
    hasPayout
  );

  const firstMissingStep = !hasAgreementSigned
    ? 'agreement'
    : !hasPersonalDetails
      ? 'profile'
      : !hasSubjects
        ? 'subjects'
        : (!hasPoliceClearance || !hasRightToWork)
          ? 'clearance'
          : !hasPayout
            ? 'payout'
            : 'complete';

  const message = complete
    ? 'Tutor onboarding is complete.'
    : {
        agreement: 'Sign the tutor agreement to continue profile completion.',
        profile: 'Add your personal and teaching background details.',
        subjects: 'Select the subjects you are qualified to tutor.',
        clearance: !hasPoliceClearance && !hasRightToWork
          ? 'Submit your police clearance and official ID or passport.'
          : !hasPoliceClearance
            ? 'Submit your police clearance certificate.'
            : 'Submit your South African ID or passport for right-to-work verification.',
        payout: 'Add and verify your payout banking details.',
      }[firstMissingStep];

  return {
    complete,
    hasPersonalDetails,
    hasSubjects,
    hasPoliceClearance,
    hasRightToWork,
    hasPayout,
    hasAgreementSigned,
    hasSelfie,
    needsAgreement: !hasAgreementSigned,
    needsProfile: !hasPersonalDetails || !hasSubjects || !hasPoliceClearance || !hasRightToWork || !hasPayout,
    firstMissingStep,
    message,
  };
}
