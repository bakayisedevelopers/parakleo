import { getFirebaseClients } from '../firebase/config';
import { DEFAULT_SUBJECTS } from '../constants/subjects';

const DEFAULT_STUDENT_FREE_MINUTES = 90;

function buildReferralCode(uid) {
  return `CLX-${String(uid || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
}

function buildDefaultProfile({ uid, email, displayName, role, referralCode, referredBy = null, pendingReferralCode = null }) {
  const normalizedRole = role || 'student';
  const safeReferralCode = String(referralCode || buildReferralCode(uid)).trim().toUpperCase();

  return {
    uid,
    email,
    fullName: displayName,
    displayName,
    role: normalizedRole,
    activeRole: normalizedRole,
    roles: normalizedRole === 'tutor' ? ['tutor'] : ['student'],
    profilePhoto: '',
    phoneNumber: '',
    subjects: DEFAULT_SUBJECTS,
    bio: '',
    availability: '',
    onlineStatus: 'offline',
    studentProfile: {
      grade: null,
      curriculum: '',
      discoverySource: '',
    },
    tutorProfile: {
      highestGradeResultUrl: '',
      mathScore: null,
      gradesToTutor: [],
      verificationStatus: 'pending',
      payout: {
        bankName: '',
        accountNumber: '',
        accountHolder: '',
      },
    },
    paymentMethods: [],
    wallet: {
      balance: 0,
      currency: 'ZAR',
      updatedAt: new Date().toISOString(),
    },
    freeMinutesRemaining: normalizedRole === 'student' ? DEFAULT_STUDENT_FREE_MINUTES : 0,
    referralCode: safeReferralCode,
    referredBy,
    pendingReferralCode: pendingReferralCode || null,
    referralRewardCount: 0,
    totalFreeMinutesEarned: normalizedRole === 'student' ? DEFAULT_STUDENT_FREE_MINUTES : 0,
    totalFreeMinutesUsed: 0,
    growth: {
      completionRequirements: {
        emailVerified: false,
        phoneVerified: false,
      },
      accountCompletionRewardProcessed: false,
      lastGrowthSyncedAt: null,
    },
  };
}

export async function upsertUserProfile({ uid, email, displayName, role, pendingReferralCode = null }) {
  const clients = await getFirebaseClients();

  const profileShape = buildDefaultProfile({ uid, email, displayName, role, pendingReferralCode });

  if (!clients) {
    return profileShape;
  }

  const { db, firestoreModule } = clients;
  const { doc, getDoc, serverTimestamp, setDoc } = firestoreModule;
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);

  await setDoc(
    userRef,
    {
      ...profileShape,
      updatedAt: serverTimestamp(),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    },
    { merge: true },
  );

  const snap = await getDoc(userRef);
  return { uid, ...snap.data() };
}

export async function updateUserProfile(uid, updates) {
  const clients = await getFirebaseClients();

  if (!clients) {
    return { uid, ...updates };
  }

  const { db, firestoreModule } = clients;
  const { doc, getDoc, serverTimestamp, setDoc } = firestoreModule;
  const userRef = doc(db, 'users', uid);

  await setDoc(
    userRef,
    {
      ...updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const snap = await getDoc(userRef);
  return { uid, ...snap.data() };
}

export async function getUserProfile(uid) {
  const clients = await getFirebaseClients();

  if (!clients) {
    return null;
  }

  const { db, firestoreModule } = clients;
  const { doc, getDoc } = firestoreModule;
  const snap = await getDoc(doc(db, 'users', uid));

  if (!snap.exists()) {
    return null;
  }

  return { uid: snap.id, ...snap.data() };
}


function resolveTutorScore(tutor = {}) {
  const rating = Number(tutor?.tutorProfile?.overallRating ?? tutor?.rating ?? 0) || 0;
  const recent24h = Number(
    tutor?.tutorProfile?.completedSessionsLast24Hours
      ?? tutor?.tutorProfile?.completedLast24h
      ?? tutor?.stats?.completedSessionsLast24Hours
      ?? 0,
  ) || 0;
  const totalSessions = Number(
    tutor?.tutorProfile?.completedSessionsTotal
      ?? tutor?.tutorProfile?.completedSessions
      ?? tutor?.stats?.completedSessionsTotal
      ?? 0,
  ) || 0;

  return {
    rating,
    recent24h,
    totalSessions,
    composite: (rating * 10000) + (recent24h * 100) + totalSessions,
  };
}

export async function getTutorCandidatesForRequest({ subject }) {
  const clients = await getFirebaseClients();

  if (!clients) {
    return [];
  }

  const { db, firestoreModule } = clients;
  const { collection, getDocs, query, where } = firestoreModule;

  const q = query(
    collection(db, 'users'),
    where('activeRole', '==', 'tutor'),
    where('onlineStatus', '==', 'online'),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((doc) => ({ uid: doc.id, ...doc.data() }))
    .filter((tutor) => {
      const tutorProfile = tutor.tutorProfile || {};
      const isVerified = tutorProfile.verificationStatus === 'verified';
      const normalizedSubjects = (tutor.subjects || []).map((item) => String(item || '').trim().toLowerCase());
      const requestSubject = String(subject || 'Mathematics').trim().toLowerCase();
      return isVerified && normalizedSubjects.includes(requestSubject) && !tutor.activeSessionId;
    })
    .sort((a, b) => resolveTutorScore(b).composite - resolveTutorScore(a).composite);
}


export async function deleteUserProfile(uid) {
  const clients = await getFirebaseClients();

  if (!clients) {
    return;
  }

  const { db, firestoreModule } = clients;
  const { deleteDoc, doc } = firestoreModule;
  await deleteDoc(doc(db, 'users', uid));
}

export async function getTutorsForAdmin() {
  const clients = await getFirebaseClients();
  if (!clients) {
    return [];
  }

  const { db, firestoreModule } = clients;
  const { collection, getDocs, query, where } = firestoreModule;
  const q = query(collection(db, 'users'), where('activeRole', '==', 'tutor'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }));
}


export async function getStudentsForAdmin() {
  const clients = await getFirebaseClients();
  if (!clients) {
    return [];
  }

  const { db, firestoreModule } = clients;
  const { collection, getDocs, query, where } = firestoreModule;
  const q = query(collection(db, 'users'), where('activeRole', '==', 'student'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }));
}

export async function setTutorVerificationStatus(uid, verificationStatus) {
  const existing = await getUserProfile(uid);
  return updateUserProfile(uid, {
    tutorProfile: {
      ...(existing?.tutorProfile || {}),
      verificationStatus,
    },
  });
}

export async function updateUserRatingSummary(uid, roleKey, overallScore) {
  const existing = await getUserProfile(uid);
  if (!existing) return null;

  const currentStats = existing?.ratings?.[roleKey] || {};
  const totalLessons = Number(currentStats.totalLessons ?? currentStats.count ?? 0);
  const totalRatings = Number(currentStats.totalRatings ?? ((currentStats.average || 0) * totalLessons) ?? 0);
  const nextTotalLessons = totalLessons + 1;
  const nextTotalRatings = Number((totalRatings + Number(overallScore || 0)).toFixed(2));
  const nextAverage = Number((nextTotalRatings / nextTotalLessons).toFixed(2));

  return updateUserProfile(uid, {
    ratings: {
      ...(existing.ratings || {}),
      [roleKey]: {
        count: nextTotalLessons,
        totalLessons: nextTotalLessons,
        totalRatings: nextTotalRatings,
        average: nextAverage,
        updatedAt: Date.now(),
      },
    },
    ...(roleKey === 'asTutor'
      ? {
          tutorProfile: {
            ...(existing.tutorProfile || {}),
            overallRating: nextAverage,
          },
        }
      : {}),
  });
}
