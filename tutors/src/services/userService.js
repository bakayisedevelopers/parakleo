import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseClients } from '../firebase/config';

export function buildDefaultTutorProfile({ uid, email, displayName }) {
  return {
    uid,
    email,
    fullName: displayName || '',
    displayName: displayName || '',
    role: 'tutor',
    activeRole: 'tutor',
    roles: ['tutor'],
    profilePhoto: '',
    phoneNumber: '',
    onlineStatus: 'offline',
    tutorProfile: {
      biography: '',
      university: '',
      degree: '',
      teachingSubjects: [],
      academicLevels: [],
      idVerificationUrl: '',
      academicTranscriptUrl: '',
      acceptanceRate: 100,
      completionRate: 100,
      overallRating: 5.0,
      avgResponseSeconds: 15,
      cancellationRate: 0,
      completedSessionsLast24Hours: 0,
      bankingDetails: {
        bankName: '',
        accountNumber: '',
        branchCode: '',
        accountType: 'savings',
      },
    },
    agreements: {
      tutorAgreementSigned: false,
      tutorAgreementSignedAt: null,
      tutorAgreementVersion: '1.0.1',
    },
    wallet: {
      balance: 0,
      pendingPayout: 0,
      currency: 'ZAR',
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const { db } = getFirebaseClients();
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return { uid: snapshot.id, ...snapshot.data() };
}

export function subscribeToUserProfile(uid, onProfile, onError) {
  if (!uid) return () => {};
  const { db } = getFirebaseClients();
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onProfile(null);
        return;
      }
      onProfile({ uid: snapshot.id, ...snapshot.data() });
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function upsertTutorProfile(uid, profileData) {
  if (!uid) throw new Error('Cannot update profile without uid');
  const { db } = getFirebaseClients();
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { ...profileData, updatedAt: serverTimestamp() }, { merge: true });
  return getUserProfile(uid);
}

export async function updateTutorOnlineStatus(uid, onlineStatus, liveLocation = null) {
  if (!uid) return;
  const { db } = getFirebaseClients();
  const ref = doc(db, 'users', uid);
  const patch = {
    onlineStatus: onlineStatus === 'online' ? 'online' : 'offline',
    lastActiveAt: serverTimestamp(),
  };

  const latitude = Number(liveLocation?.latitude);
  const longitude = Number(liveLocation?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    patch.liveLocation = liveLocation;
    patch.location = liveLocation;
    patch['tutorProfile.liveLocation'] = liveLocation;
    patch['tutorProfile.location'] = liveLocation;
  }

  await updateDoc(ref, patch);
}

export async function deleteUserProfile(uid) {
  if (!uid) return;
  const { db } = getFirebaseClients();
  await deleteDoc(doc(db, 'users', uid));
}

export async function updateUserRatingSummary(uid, roleKey, overallScore) {
  if (!uid) return null;
  const existing = await getUserProfile(uid);
  if (!existing) return null;

  const currentStats = existing?.ratings?.[roleKey] || {};
  const totalLessons = Number(currentStats.totalLessons ?? currentStats.count ?? 0);
  const totalRatings = Number(currentStats.totalRatings ?? ((currentStats.average || 0) * totalLessons) ?? 0);
  const nextTotalLessons = totalLessons + 1;
  const nextTotalRatings = Number((totalRatings + Number(overallScore || 0)).toFixed(2));
  const nextAverage = Number((nextTotalRatings / nextTotalLessons).toFixed(2));

  const patch = {
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
  };

  const { db } = getFirebaseClients();
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, patch).catch(() => null);
  return { ...existing, ...patch };
}
