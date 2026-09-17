import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseClients, getFunctionEndpoint } from '../firebase/config';

export const LEGAL_ENTITY_NAME = 'Parakleo, operated by Jabu Msiza';
export const TUTOR_AGREEMENT_DOCUMENT_ID = 'tutor_agreement';
export const TUTOR_AGREEMENT_DEFAULT_VERSION = '1.1.0';

export const DEFAULT_TUTOR_AGREEMENT_CLAUSES = [
  {
    title: '1. Independent Contractor Status',
    content: 'The tutor is an independent contractor and not an employee, partner, agent, or representative of Parakleo. The tutor is responsible for all personal taxes, statutory obligations, and registrations arising from tutoring earnings. Parakleo does not guarantee minimum income or session volumes.',
  },
  {
    title: '2. Tutor Eligibility & Profile Accuracy',
    content: 'The tutor confirms they are at least 18 years of age and must provide accurate identity, academic qualifications, and verified banking details. Misrepresentation or false credentials will result in immediate termination.',
  },
  {
    title: '3. Professional Conduct & Student Safety',
    content: 'The tutor must behave professionally and communicate respectfully. When working with minors, tutors must maintain strict professional boundaries. Harassment, abuse, inappropriate off-platform contact, or exploitation is strictly prohibited.',
  },
  {
    title: '4. Platform Integrity & Direct Payments',
    content: 'All accepted sessions must be conducted on Parakleo. Tutors may not solicit students to move off-platform or request direct payments outside Parakleo.',
  },
  {
    title: '5. Data Protection (POPIA) & Confidentiality',
    content: 'Tutors must protect student personal data and coursework under the Protection of Personal Information Act (POPIA). Tutors may not download, sell, or share student documents.',
  },
  {
    title: '6. Payouts, Surcharges & Platform Fees',
    content: 'Standard tutor payout is calculated at 73% of billable lesson time plus 100% of approved in-person travel fees (R40 base up to 10 km, R4/km beyond 10 km). For first-time student promotional lessons (25% discount capped at R50), the tutor receives 75% of the discounted total amount paid and settled by the student, inclusive of all travel and lesson compensation. Payouts are disbursed to the tutor verified South African bank account.',
  },
  {
    title: '7. Suspension & Termination',
    content: 'Parakleo reserves the right to restrict or terminate tutor platform access for breach of educational standards, safety policies, student complaints, or code of conduct violations.',
  },
];

export async function getTutorAgreementBundle() {
  const { auth, db } = getFirebaseClients();
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    return {
      activeVersion: { version: TUTOR_AGREEMENT_DEFAULT_VERSION, clauses: DEFAULT_TUTOR_AGREEMENT_CLAUSES },
      document: { id: TUTOR_AGREEMENT_DOCUMENT_ID, currentVersion: TUTOR_AGREEMENT_DEFAULT_VERSION },
      acceptances: [],
      user: null,
    };
  }

  try {
    const token = await currentUser.getIdToken();
    const endpoint = getFunctionEndpoint('getTutorAgreement');
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result?.success) {
      return result;
    }
  } catch (err) {
    // fallback to direct Firestore reads
  }

  const [userSnap, acceptancesSnap] = await Promise.all([
    getDoc(doc(db, 'users', currentUser.uid)),
    getDocs(query(collection(db, 'userAgreementAcceptances'), where('userId', '==', currentUser.uid))),
  ]);

  const user = userSnap.exists() ? { uid: userSnap.id, ...userSnap.data() } : null;
  const acceptances = (acceptancesSnap.docs || [])
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.documentId === TUTOR_AGREEMENT_DOCUMENT_ID);

  return {
    document: { id: TUTOR_AGREEMENT_DOCUMENT_ID, currentVersion: TUTOR_AGREEMENT_DEFAULT_VERSION },
    activeVersion: { version: TUTOR_AGREEMENT_DEFAULT_VERSION, clauses: DEFAULT_TUTOR_AGREEMENT_CLAUSES },
    acceptances,
    user,
  };
}

export async function acceptTutorAgreement({ typedSignatureName, checkboxAccepted = true }) {
  const { auth, db } = getFirebaseClients();
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error('You must be signed in before accepting the Tutor Agreement.');
  }

  const token = await currentUser.getIdToken();

  // Try Cloud Function endpoint first
  try {
    const endpoint = getFunctionEndpoint('acceptTutorAgreement');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        typedSignatureName,
        checkboxAccepted,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok && result?.success) {
      return result;
    }
  } catch (err) {
    console.warn('Cloud Function acceptTutorAgreement fallback:', err?.message);
  }

  // Direct Firestore persistence
  const acceptanceId = `acceptance_${currentUser.uid}_${Date.now()}`;
  const acceptanceRecord = {
    id: acceptanceId,
    userId: currentUser.uid,
    documentId: TUTOR_AGREEMENT_DOCUMENT_ID,
    version: TUTOR_AGREEMENT_DEFAULT_VERSION,
    typedSignatureName: typedSignatureName.trim(),
    checkboxAccepted: Boolean(checkboxAccepted),
    acceptedAt: serverTimestamp(),
    legalEntity: LEGAL_ENTITY_NAME,
    userAgent: 'Parakleo Mobile Tutor App',
  };

  await setDoc(doc(db, 'userAgreementAcceptances', acceptanceId), acceptanceRecord);

  const agreementUpdate = {
    tutorAgreement: {
      acceptedVersion: TUTOR_AGREEMENT_DEFAULT_VERSION,
      acceptedAt: new Date().toISOString(),
      acceptedCurrentVersion: true,
      currentVersionAccepted: true,
      requiredVersion: TUTOR_AGREEMENT_DEFAULT_VERSION,
      typedSignatureName: typedSignatureName.trim(),
    },
    agreements: {
      tutorAgreementSigned: true,
      tutorAgreementSignedAt: new Date().toISOString(),
      tutorAgreementVersion: TUTOR_AGREEMENT_DEFAULT_VERSION,
      typedSignatureName: typedSignatureName.trim(),
    },
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'users', currentUser.uid), agreementUpdate);

  return { success: true, acceptance: acceptanceRecord, userUpdates: agreementUpdate };
}
