/**
 * Tutor Mobile Safety Constants and Helpers (REQ-011)
 */

export function extractSafetySnapshot(requestOrSession = {}) {
  const snapshot = requestOrSession?.safetySnapshot || {};
  const isMinor = Boolean(
    snapshot.isMinor ||
    requestOrSession?.isMinor ||
    snapshot.learnerType === 'minor' ||
    requestOrSession?.learnerType === 'minor'
  );

  const guardianPresenceRequired = Boolean(
    snapshot.guardianPresenceRequired ||
    requestOrSession?.guardianPresenceRequired ||
    isMinor
  );

  const preferPublicMeetingPlace = Boolean(
    snapshot.preferPublicMeetingPlace ||
    requestOrSession?.preferPublicMeetingPlace
  );

  const preferSameGenderTutor = Boolean(
    snapshot.preferSameGenderTutor ||
    requestOrSession?.preferSameGenderTutor
  );

  const guardianName = String(snapshot.guardianName || requestOrSession?.guardianName || '').trim();
  const guardianPhone = String(snapshot.guardianPhone || requestOrSession?.guardianPhone || '').trim();
  const guardianRelationship = String(snapshot.guardianRelationship || requestOrSession?.guardianRelationship || '').trim();

  return {
    isMinor,
    guardianPresenceRequired,
    preferPublicMeetingPlace,
    preferSameGenderTutor,
    guardianName,
    guardianPhone,
    guardianRelationship,
    studentGender: String(snapshot.studentGender || requestOrSession?.studentGender || '').trim().toLowerCase(),
  };
}
