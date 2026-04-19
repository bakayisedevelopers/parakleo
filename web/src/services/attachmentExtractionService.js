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
let cachedOcrWorkerPromise = null;

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

function normalizeOcrText(rawText) {
  return String(rawText || '').replace(/\s+/g, ' ').trim();
}

function buildOcrResult(rawText) {
  const extractedText = normalizeOcrText(rawText);
  const textLength = extractedText.length;

  return {
    success: textLength > 0,
    extractedText,
    textLength,
    extractionMethod: 'ocr',
  };
}

async function getOcrWorker() {
  if (cachedOcrWorkerPromise) return cachedOcrWorkerPromise;

  cachedOcrWorkerPromise = (async () => {
    try {
      const tesseract = await loadTesseract();
      if (typeof tesseract?.createWorker !== 'function') {
        throw new Error('Tesseract createWorker API unavailable');
      }

      const worker = await tesseract.createWorker('eng', 1, {
        logger: (message) => {
          if (message?.status) {
            console.debug('[attachmentExtraction][ocr] worker', message);
          }
        },
      });

      console.debug('[attachmentExtraction][ocr] worker initialized', { language: 'eng' });
      return worker;
    } catch (error) {
      cachedOcrWorkerPromise = null;
      console.debug('[attachmentExtraction][ocr] worker initialization failed', {
        error: error?.message,
      });
      throw error;
    }
  })();

  return cachedOcrWorkerPromise;
}

async function normalizeOcrInput(input) {
  if (!input) return input;
  if (typeof HTMLCanvasElement !== 'undefined' && input instanceof HTMLCanvasElement) {
    const blob = await new Promise((resolve) => input.toBlob(resolve, 'image/png'));
    if (!blob) {
      throw new Error('Canvas conversion to Blob failed');
    }
    return blob;
  }
  return input;
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
  const worker = await getOcrWorker();
  const normalizedInput = await normalizeOcrInput(blobLike);
  const inputType = normalizedInput?.constructor?.name || typeof normalizedInput;

  console.debug('[attachmentExtraction][ocr] OCR started', {
    inputType,
  });

  try {
    const result = await worker.recognize(normalizedInput);
    const rawText = result?.data?.text || '';
    const normalizedText = normalizeOcrText(rawText);

    console.debug('[attachmentExtraction][ocr] OCR raw text', { rawText: normalizedText });
    console.debug('[attachmentExtraction][ocr] OCR text length', { textLength: normalizedText.length });
    return rawText;
  } catch (error) {
    console.debug('[attachmentExtraction][ocr] OCR failed', {
      inputType,
      error: error?.message,
    });
    throw error;
  }
}

async function extractFromImage(file) {
  try {
    const text = await runOcr(file);
    return buildOcrResult(text);
  } catch (error) {
    console.debug('[attachmentExtraction][ocr] image OCR extraction failed', {
      fileName: file?.name,
      error: error?.message,
    });
    return buildOcrResult('');
  }
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

  return buildOcrResult(pageTexts.join('\n').trim());
}

function buildExtractionResult({ file, fileType, extractionMethod, extractedText, textLength, extractionQuality, success }) {
  return {
    fileName: file?.name || 'unknown-file',
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
        extractionQuality: imageResult.success ? 'good' : 'failed',
        success: imageResult.success,
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
    const useOcr = ocrResult.success;

    return buildExtractionResult({
      file,
      fileType,
      extractionMethod: useOcr ? 'ocr' : 'fallback',
      extractedText: useOcr ? ocrResult.extractedText : '',
      textLength: useOcr ? ocrResult.textLength : 0,
      extractionQuality: useOcr ? 'poor' : 'failed',
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
    console.debug('[attachmentExtraction] extraction started', {
      fileName: file?.name,
      index,
      total: files.length,
    });

    let result;

    try {
      result = await extractSingleAttachment(file);
    } catch (error) {
      console.debug('[attachmentExtraction] extraction crashed; returning fallback', {
        fileName: file?.name,
        error: error?.message,
      });
      result = buildExtractionResult({
        file,
        fileType: detectAttachmentType(file) || 'image',
        extractionMethod: 'fallback',
        extractedText: '',
        textLength: 0,
        extractionQuality: 'failed',
        success: false,
      });
    }

    console.debug('[attachmentExtraction] extraction completed', {
      fileName: result.fileName,
      extractionMethod: result.extractionMethod,
      success: result.success,
      textLength: result.textLength,
    });

    results.push(result);
    if (typeof onProgress === 'function') {
      try {
        onProgress(result, index, files.length);
      } catch (progressError) {
        console.debug('[attachmentExtraction] progress callback failed', {
          fileName: result.fileName,
          error: progressError?.message,
        });
      }
    }
  }

  return results;
}
