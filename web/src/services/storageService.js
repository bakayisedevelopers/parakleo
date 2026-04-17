import { getFirebaseClients } from '../firebase/config';

export async function uploadUserFile({ userId, file, pathPrefix = 'uploads' }) {
  if (!file) {
    throw new Error('No file selected.');
  }

  const clients = await getFirebaseClients();
  if (!clients?.storage || !clients?.storageModule) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${pathPrefix}/${userId}/${Date.now()}-${safeName}`;
    return { downloadUrl: '', objectPath };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${pathPrefix}/${userId}/${Date.now()}-${safeName}`;
  const fileRef = clients.storageModule.ref(clients.storage, objectPath);

  await clients.storageModule.uploadBytes(fileRef, file, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: 'public,max-age=3600',
  });

  const downloadUrl = await clients.storageModule.getDownloadURL(fileRef);
  return { downloadUrl, objectPath };
}
