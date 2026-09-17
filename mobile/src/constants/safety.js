export const LEARNER_TYPES = {
  ADULT: 'adult',
  MINOR: 'minor',
};

export const GUARDIAN_RELATIONSHIPS = [
  'Parent',
  'Legal Guardian',
  'Family Member',
  'Host / Caregiver',
  'Other',
];

export const GENDER_OPTIONS = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

/**
 * Builds a bounded safety snapshot for request creation and live tracking.
 * Adheres to data minimization: only packages what is necessary for tutor safety
 * and session dispatch, avoiding excessive private data.
 */
export function buildSafetySnapshot(user, overrides = {}) {
  const studentProfile = user?.studentProfile || {};
  const safety = studentProfile?.safety || user?.safety || {};
  const isMinor = safety.learnerType === 'minor' || Boolean(safety.isMinor);
  const guardian = safety.guardian || {};
  const preferences = safety.preferences || {};

  const preferSameGenderTutor = overrides.preferSameGenderTutor !== undefined
    ? Boolean(overrides.preferSameGenderTutor)
    : Boolean(preferences.preferSameGenderTutor);

  const preferPublicMeetingPlace = overrides.preferPublicMeetingPlace !== undefined
    ? Boolean(overrides.preferPublicMeetingPlace)
    : Boolean(preferences.preferPublicMeetingPlace);

  const studentGender = String(
    overrides.studentGender || user?.gender || safety.gender || studentProfile.gender || ''
  ).trim().toLowerCase();

  return {
    learnerType: isMinor ? 'minor' : 'adult',
    isMinor,
    guardianPresenceRequired: isMinor ? true : Boolean(preferences.guardianPresenceRequired),
    guardianName: isMinor ? String(guardian.name || '').trim() : '',
    guardianRelationship: isMinor ? String(guardian.relationship || '').trim() : '',
    guardianPhone: isMinor ? String(guardian.phoneNumber || '').trim() : '',
    preferSameGenderTutor,
    preferPublicMeetingPlace,
    studentGender,
  };
}
