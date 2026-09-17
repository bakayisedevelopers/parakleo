import { getDownloadURL, ref, uploadBytes, uploadString } from 'firebase/storage';
import { getFirebaseClients } from '../firebase/config';

function sanitizeFileName(fileName = '') {
  return String(fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadUserDocument({ userId, fileUri, fileName, mimeType = 'application/pdf', pathPrefix = 'tutor_documents' }) {
  if (!userId || !fileUri) {
    throw new Error('User ID and file URI are required for upload.');
  }

  const { storage } = getFirebaseClients();
  const safeName = sanitizeFileName(fileName || `doc_${Date.now()}`);
  const objectPath = `${pathPrefix}/${userId}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, objectPath);

  const response = await fetch(fileUri);
  const blob = await response.blob();

  await uploadBytes(storageRef, blob, {
    contentType: mimeType,
    cacheControl: 'public,max-age=3600',
  });

  const downloadUrl = await getDownloadURL(storageRef);

  return {
    downloadUrl,
    objectPath,
    fileName: safeName,
    mimeType,
    uploadedAt: new Date().toISOString(),
  };
}
