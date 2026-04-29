import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { getFirebaseClients } from '../firebase/config';

function sanitizeFileName(fileName = '') {
  return String(fileName || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadUserFile({ userId, attachment, pathPrefix = 'uploads', objectPath: requestedObjectPath = '' }) {
  if (!attachment?.dataUrl) {
    throw new Error('No file selected.');
  }

  const { storage } = getFirebaseClients();
  const safeName = sanitizeFileName(attachment.name);
  const objectPath = requestedObjectPath || `${pathPrefix}/${userId}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, objectPath);

  await uploadString(fileRef, attachment.dataUrl, 'data_url');
  const downloadUrl = await getDownloadURL(fileRef);

  return {
    downloadUrl,
    objectPath,
    fileName: attachment.name,
    fileType: attachment.type || 'application/octet-stream',
    size: Number(attachment.size || 0),
    uploadedAt: new Date().toISOString(),
  };
}
