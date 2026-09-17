import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseClients } from '../firebase/config';

export const TUTOR_DOCUMENT_TYPES = {
  RESULTS: 'results',
  POLICE_CLEARANCE: 'police_clearance',
  ID_DOCUMENT: 'id_document',
};

export function normalizeDocumentStatus(status) {
  const normalized = String(status || '').toUpperCase();
  return ['UPLOADED', 'PROCESSING', 'VERIFIED', 'FAILED'].includes(normalized) ? normalized : 'UPLOADED';
}

function sanitizeFileName(fileName = 'document') {
  return String(fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadTutorResultsDocument({ uid, asset }) {
  if (!uid) throw new Error('Missing tutor id.');
  if (!asset?.uri) throw new Error('Select a results document to upload.');

  const { db, storage } = getFirebaseClients();
  const docRef = doc(collection(db, 'tutorDocuments'));
  const fileName = asset.name || `results-${Date.now()}.pdf`;
  const safeName = sanitizeFileName(fileName);
  const contentType = asset.mimeType || 'application/octet-stream';
  const filePath = `tutorDocuments/${uid}/${docRef.id}/${safeName}`;
  const storageRef = ref(storage, filePath);

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  await uploadBytes(storageRef, blob, {
    contentType,
    cacheControl: 'private,max-age=3600',
  });

  const fileUrl = await getDownloadURL(storageRef);
  const record = {
    id: docRef.id,
    uid,
    documentType: TUTOR_DOCUMENT_TYPES.RESULTS,
    fileName,
    fileUrl,
    filePath,
    contentType,
    status: 'UPLOADED',
    extractedText: '',
    extractedSubjects: [],
    qualifiedSubjects: [],
    error: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, record);

  // Keep tutor profile in sync with document submission
  const userRef = doc(db, 'users', uid);
  await setDoc(
    userRef,
    {
      tutorProfile: {
        highestGradeResultUrl: fileUrl,
        academicTranscriptUrl: fileUrl,
        resultsDocumentSubmittedAt: new Date().toISOString(),
        requiredDocuments: {
          results: {
            documentId: docRef.id,
            fileName,
            fileUrl,
            filePath,
            contentType,
            status: 'submitted',
            updatedAt: new Date().toISOString(),
          },
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch(() => null);

  return { ...record, createdAt: Date.now(), updatedAt: Date.now() };
}

export async function retryTutorResultsDocument({ documentId }) {
  if (!documentId) throw new Error('Missing results document id.');

  const { db } = getFirebaseClients();
  await updateDoc(doc(db, 'tutorDocuments', documentId), {
    status: 'UPLOADED',
    error: null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTutorResultsDocument({ documentId, filePath }) {
  if (!documentId) throw new Error('Missing results document id.');

  const { db, storage } = getFirebaseClients();

  if (filePath) {
    try {
      await deleteObject(ref(storage, filePath));
    } catch (error) {
      if (error?.code !== 'storage/object-not-found') throw error;
    }
  }

  await deleteDoc(doc(db, 'tutorDocuments', documentId));
}

async function uploadTutorStorageFile({ uid, asset, directory, defaultFileName }) {
  if (!uid) throw new Error('Missing tutor id.');
  if (!asset?.uri) throw new Error('Select a document or image to upload.');

  const { storage } = getFirebaseClients();
  const fileName = asset.name || defaultFileName;
  const safeName = sanitizeFileName(fileName);
  const contentType = asset.mimeType || 'application/octet-stream';
  const filePath = `${directory}/${uid}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, filePath);
  const response = await fetch(asset.uri);
  const blob = await response.blob();

  await uploadBytes(storageRef, blob, {
    contentType,
    cacheControl: 'private,max-age=3600',
  });

  return {
    fileName,
    filePath,
    fileUrl: await getDownloadURL(storageRef),
    contentType,
  };
}

export async function uploadTutorPoliceClearanceDocument({ uid, asset }) {
  if (!uid) throw new Error('Missing tutor id.');
  if (!asset?.uri) throw new Error('Select a police clearance document to upload.');

  const { db, storage } = getFirebaseClients();
  const docRef = doc(collection(db, 'tutorDocuments'));
  const fileName = asset.name || `police-clearance-${Date.now()}.pdf`;
  const safeName = sanitizeFileName(fileName);
  const contentType = asset.mimeType || 'application/pdf';
  const filePath = `tutorPoliceClearance/${uid}/${docRef.id}-${safeName}`;
  const storageRef = ref(storage, filePath);

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  await uploadBytes(storageRef, blob, {
    contentType,
    cacheControl: 'private,max-age=3600',
  });

  const fileUrl = await getDownloadURL(storageRef);
  const record = {
    id: docRef.id,
    uid,
    documentType: TUTOR_DOCUMENT_TYPES.POLICE_CLEARANCE,
    fileName,
    fileUrl,
    filePath,
    contentType,
    status: 'UPLOADED',
    error: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, record);

  const userRef = doc(db, 'users', uid);
  await setDoc(
    userRef,
    {
      tutorProfile: {
        policeClearance: {
          documentId: docRef.id,
          fileUrl,
          filePath,
          fileName,
          contentType,
          status: 'UPLOADED',
        },
        policeClearanceSubmittedAt: new Date().toISOString(),
        requiredDocuments: {
          police_clearance: {
            documentId: docRef.id,
            fileName,
            fileUrl,
            filePath,
            contentType,
            status: 'submitted',
            updatedAt: new Date().toISOString(),
          },
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch(() => null);

  return { ...record, createdAt: Date.now(), updatedAt: Date.now() };
}

export async function uploadTutorIdDocument({ uid, asset }) {
  if (!uid) throw new Error('Missing tutor id.');
  if (!asset?.uri) throw new Error('Select an ID document to upload.');

  const { db, storage } = getFirebaseClients();
  const docRef = doc(collection(db, 'tutorDocuments'));
  const fileName = asset.name || `id-document-${Date.now()}.pdf`;
  const safeName = sanitizeFileName(fileName);
  const contentType = asset.mimeType || 'application/pdf';
  const filePath = `tutorDocuments/${uid}/${docRef.id}/${safeName}`;
  const storageRef = ref(storage, filePath);

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  await uploadBytes(storageRef, blob, {
    contentType,
    cacheControl: 'private,max-age=3600',
  });

  const fileUrl = await getDownloadURL(storageRef);
  const record = {
    id: docRef.id,
    uid,
    documentType: TUTOR_DOCUMENT_TYPES.ID_DOCUMENT,
    fileName,
    fileUrl,
    filePath,
    contentType,
    status: 'UPLOADED',
    error: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, record);

  const userRef = doc(db, 'users', uid);
  await setDoc(
    userRef,
    {
      tutorProfile: {
        idVerificationUrl: fileUrl,
        idDocument: {
          documentId: docRef.id,
          fileUrl,
          filePath,
          fileName,
          contentType,
          status: 'UPLOADED',
        },
        idDocumentSubmittedAt: new Date().toISOString(),
        requiredDocuments: {
          id_document: {
            documentId: docRef.id,
            fileName,
            fileUrl,
            filePath,
            contentType,
            status: 'submitted',
            updatedAt: new Date().toISOString(),
          },
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch(() => null);

  return { ...record, createdAt: Date.now(), updatedAt: Date.now() };
}

export async function uploadTutorSelfie({ uid, asset }) {
  return uploadTutorStorageFile({
    uid,
    asset,
    directory: 'tutorSelfies',
    defaultFileName: `selfie-${Date.now()}.jpg`,
  });
}

export function subscribeToAllTutorDocuments(uid, callback) {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const documentsQuery = query(
    collection(db, 'tutorDocuments'),
    where('uid', '==', uid),
  );

  return onSnapshot(
    documentsQuery,
    (snapshot) => {
      const documents = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const aTime = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
          const bTime = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });
      callback(documents);
    },
    () => callback([]),
  );
}

export function subscribeToTutorResultsDocuments(uid, callback) {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const { db } = getFirebaseClients();
  const documentsQuery = query(
    collection(db, 'tutorDocuments'),
    where('uid', '==', uid),
    where('documentType', '==', TUTOR_DOCUMENT_TYPES.RESULTS),
  );

  return onSnapshot(
    documentsQuery,
    (snapshot) => {
      const documents = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const aTime = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
          const bTime = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });
      callback(documents);
    },
    () => callback([]),
  );
}
