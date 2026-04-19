const MIN_TEXT_LENGTH = 30;
const MIN_READABLE_WORDS = 4;
const READABLE_WORD_PATTERN = /[A-Za-z]{2,}/g;
const GARBAGE_CHAR_PATTERN = /[^\w\s.,;:!?()\[\]{}'"\-/%]/g;

const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tif', '.tiff'];
const PDFJS_CDN_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER_CDN_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const TESSERACT_CDN_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';

let cachedPdfJs = null;
let cachedTesseract = null;

function getFileExtension(fileName = '') {
  const normalizedName = String(fileName || '').toLowerCase();
  const extensionIndex = normalizedName.lastIndexOf('.');
  return extensionIndex >= 0 ? normalizedName.slice(extensionIndex) : '';
}

async function loadPdfJs() {
  if (cachedPdfJs) return cachedPdfJs;
  cachedPdfJs = await import(/* @vite-ignore */ PDFJS_CDN_URL);
  cachedPdfJs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
  return cachedPdfJs;
}

async function loadTesseract() {
  if (cachedTesseract) return cachedTesseract;
  cachedTesseract = await import(/* @vite-ignore */ TESSERACT_CDN_URL);
  return cachedTesseract;
}

export function detectAttachmentType(file) {
  const mimeType = String(file?.type || '').toLowerCase();
  const extension = getFileExtension(file?.name || '');

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    return 'pdf';
  }

  if (mimeType.startsWith('image/') || SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
    return 'image';
  }

  return null;
}

export function evaluateExtractionQuality(rawText) {
  const extractedText = String(rawText || '').replace(/\s+/g, ' ').trim();
  const textLength = extractedText.length;

  if (!textLength) {
    return {
      extractedText,
      textLength,
      extractionQuality: 'failed',
      isUsable: false,
    };
  }

  const readableWords = extractedText.match(READABLE_WORD_PATTERN) || [];
  const garbageChars = extractedText.match(GARBAGE_CHAR_PATTERN) || [];
  const garbageRatio = textLength ? garbageChars.length / textLength : 1;

  const passesQuality = textLength >= MIN_TEXT_LENGTH
    && readableWords.length >= MIN_READABLE_WORDS
    && garbageRatio <= 0.35;

  return {
    extractedText,
    textLength,
    extractionQuality: passesQuality ? 'good' : 'poor',
    isUsable: passesQuality,
  };
}

async function runOcr(blobLike) {
  const tesseract = await loadTesseract();
  const result = await tesseract.recognize(blobLike, 'eng');
  return result?.data?.text || '';
}

async function extractFromImage(file) {
  const text = await runOcr(file);
  return evaluateExtractionQuality(text);
}

async function extractPdfDigitalText(file) {
  const pdfjs = await loadPdfJs();
  const pdfData = await file.arrayBuffer();
  const pdfDocument = await pdfjs.getDocument({ data: pdfData }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items || [])
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(pageText);
  }

  return evaluateExtractionQuality(pageTexts.join('\n').trim());
}

async function renderPdfPageToCanvas(page, scale = 1.75) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function extractPdfWithOcr(file) {
  const pdfjs = await loadPdfJs();
  const pdfData = await file.arrayBuffer();
  const pdfDocument = await pdfjs.getDocument({ data: pdfData }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const canvas = await renderPdfPageToCanvas(page);
    const pageText = await runOcr(canvas);
    pageTexts.push(pageText);
  }

  return evaluateExtractionQuality(pageTexts.join('\n').trim());
}

function buildExtractionResult({ file, fileType, extractionMethod, extractedText, textLength, extractionQuality, success }) {
  return {
    fileName: file.name,
    fileType,
    extractionMethod,
    success,
    extractedText,
    textLength,
    extractionQuality,
  };
}

export async function extractSingleAttachment(file) {
  const fileType = detectAttachmentType(file);
  console.debug('[attachmentExtraction] file type detected', {
    fileName: file?.name,
    mimeType: file?.type,
    fileType,
  });

  if (!fileType) {
    return buildExtractionResult({
      file,
      fileType: 'image',
      extractionMethod: 'fallback',
      extractedText: '',
      textLength: 0,
      extractionQuality: 'failed',
      success: false,
    });
  }

  if (fileType === 'image') {
    console.debug('[attachmentExtraction] extraction path chosen', { fileName: file.name, path: 'image->ocr' });
    try {
      const imageResult = await extractFromImage(file);
      return buildExtractionResult({
        file,
        fileType,
        extractionMethod: 'ocr',
        extractedText: imageResult.extractedText,
        textLength: imageResult.textLength,
        extractionQuality: imageResult.extractionQuality,
        success: imageResult.isUsable,
      });
    } catch (error) {
      console.debug('[attachmentExtraction] image OCR failed', { fileName: file.name, error: error?.message });
      return buildExtractionResult({
        file,
        fileType,
        extractionMethod: 'fallback',
        extractedText: '',
        textLength: 0,
        extractionQuality: 'failed',
        success: false,
      });
    }
  }

  console.debug('[attachmentExtraction] extraction path chosen', { fileName: file.name, path: 'pdf->digital-first' });

  try {
    const pdfResult = await extractPdfDigitalText(file);

    if (pdfResult.isUsable) {
      return buildExtractionResult({
        file,
        fileType,
        extractionMethod: 'pdf',
        extractedText: pdfResult.extractedText,
        textLength: pdfResult.textLength,
        extractionQuality: pdfResult.extractionQuality,
        success: true,
      });
    }

    console.debug('[attachmentExtraction] pdf text poor; running OCR fallback', {
      fileName: file.name,
      digitalTextLength: pdfResult.textLength,
    });

    const ocrResult = await extractPdfWithOcr(file);
    const useOcr = ocrResult.isUsable;

    return buildExtractionResult({
      file,
      fileType,
      extractionMethod: useOcr ? 'ocr' : 'fallback',
      extractedText: useOcr ? ocrResult.extractedText : '',
      textLength: useOcr ? ocrResult.textLength : 0,
      extractionQuality: ocrResult.extractionQuality,
      success: useOcr,
    });
  } catch (error) {
    console.debug('[attachmentExtraction] pdf extraction failed', { fileName: file.name, error: error?.message });
    return buildExtractionResult({
      file,
      fileType,
      extractionMethod: 'fallback',
      extractedText: '',
      textLength: 0,
      extractionQuality: 'failed',
      success: false,
    });
  }
}

export async function extractAttachments(files = [], onProgress) {
  const results = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const result = await extractSingleAttachment(file);

    console.debug('[attachmentExtraction] extraction completed', {
      fileName: result.fileName,
      extractionMethod: result.extractionMethod,
      success: result.success,
      textLength: result.textLength,
    });

    results.push(result);
    if (typeof onProgress === 'function') {
      onProgress(result, index, files.length);
    }
  }

  return results;
}
