import { getFirebaseClients } from '../firebase/config';

const IMAGE_OCR_ENDPOINT = import.meta.env.VITE_IMAGE_OCR_ENDPOINT || '/image-ocr';

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const [, base64 = ''] = result.split(',', 2);
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Unable to read image for OCR.'));
    reader.readAsDataURL(file);
  });
}

export async function extractImageTextWithVision(file) {
  const clients = await getFirebaseClients();
  const idToken = await clients?.auth?.currentUser?.getIdToken?.();

  if (!idToken) {
    throw new Error('You must be signed in before extracting image text.');
  }

  const imageBase64 = await toBase64(file);

  console.debug('[attachmentExtraction][ocr] google-vision OCR invocation', {
    fileName: file?.name,
    mimeType: file?.type,
    source: 'image-base64',
  });

  const response = await fetch(IMAGE_OCR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      imageBase64,
      mimeType: file?.type || 'application/octet-stream',
      fileName: file?.name || 'unknown-image',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload || payload.success !== true) {
    throw new Error(payload?.message || 'Unable to extract text from image right now.');
  }

  return {
    success: Boolean(payload.success),
    extractedText: String(payload.extractedText || ''),
    textLength: Number(payload.textLength || 0),
    extractionMethod: String(payload.extractionMethod || 'ocr'),
    provider: String(payload.provider || 'paddleocr_ppstructure'),
  };
}
