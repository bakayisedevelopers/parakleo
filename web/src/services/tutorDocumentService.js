import { getFirebaseClients } from '../firebase/config';
import { normalizeSubjectList } from '../constants/subjects';

const DOCUMENT_STATUSES = new Set(['UPLOADED', 'PROCESSING', 'VERIFIED', 'FAILED']);

function sanitizeFileName(fileName = 'document') {
  return String(fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadTutorDocument({ uid, file }) {
  if (!uid) throw new Error('Missing tutor id.');
  if (!file) throw new Error('No document selected.');

  const clients = await getFirebaseClients();
  if (!clients?.storage || !clients?.db) {
    return null;
  }

  const { db, storage, firestoreModule, storageModule } = clients;
  const { collection, doc, serverTimestamp, setDoc } = firestoreModule;
  const docRef = doc(collection(db, 'tutorDocuments'));
  const safeName = sanitizeFileName(file.name);
  const filePath = `tutorDocuments/${uid}/${docRef.id}/${safeName}`;
  const fileRef = storageModule.ref(storage, filePath);

  await storageModule.uploadBytes(fileRef, file, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: 'private,max-age=3600',
  });

  const fileUrl = await storageModule.getDownloadURL(fileRef);
  const record = {
    id: docRef.id,
    uid,
    fileName: file.name,
    fileUrl,
    filePath,
    contentType: file.type || 'application/octet-stream',
    status: 'UPLOADED',
    extractedText: '',
    extractedSubjects: [],
    qualifiedSubjects: [],
    error: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, record);
  return { ...record, createdAt: Date.now(), updatedAt: Date.now() };
}

export function subscribeToTutorDocuments(uid, callback) {
  let unsubscribe = null;

  getFirebaseClients().then((clients) => {
    if (!uid || !clients) {
      callback([]);
      return;
    }

    const { db, firestoreModule } = clients;
    const { collection, onSnapshot, query, where } = firestoreModule;
    const documentsQuery = query(
      collection(db, 'tutorDocuments'),
      where('uid', '==', uid),
    );

    unsubscribe = onSnapshot(
      documentsQuery,
      (snapshot) => callback(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const aTime = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const bTime = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        })),
      () => callback([]),
    );
  });

  return () => unsubscribe?.();
}

export async function updateTutorActiveSubjects(uid, activeSubjects, qualifiedSubjects = []) {
  if (!uid) throw new Error('Missing tutor id.');

  const allowedSubjects = new Set(
    (qualifiedSubjects || [])
      .map((item) => item?.subject || item)
      .filter(Boolean),
  );
  const safeSubjects = normalizeSubjectList(activeSubjects).filter((subject) => allowedSubjects.has(subject));

  const clients = await getFirebaseClients();
  if (!clients) {
    return { activeSubjects: safeSubjects, subjects: safeSubjects };
  }

  const { db, firestoreModule } = clients;
  const { doc, serverTimestamp, updateDoc } = firestoreModule;
  await updateDoc(doc(db, 'users', uid), {
    activeSubjects: safeSubjects,
    subjects: safeSubjects,
    updatedAt: serverTimestamp(),
  });

  return { activeSubjects: safeSubjects, subjects: safeSubjects };
}

export function normalizeDocumentStatus(status) {
  const normalized = String(status || '').toUpperCase();
  return DOCUMENT_STATUSES.has(normalized) ? normalized : 'UPLOADED';
}

export async function retryTutorDocument(documentId) {
  if (!documentId) throw new Error('Missing document id.');

  const clients = await getFirebaseClients();
  if (!clients) {
    return { id: documentId, status: 'UPLOADED' };
  }

  const { db, firestoreModule } = clients;
  const { doc, serverTimestamp, updateDoc } = firestoreModule;

  await updateDoc(doc(db, 'tutorDocuments', documentId), {
    status: 'UPLOADED',
    error: null,
    updatedAt: serverTimestamp(),
  });

  return { id: documentId, status: 'UPLOADED' };
}
