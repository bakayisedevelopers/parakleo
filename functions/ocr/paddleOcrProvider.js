const { convertPdfToImages } = require('../aiSubjectExtraction');
const { extractStudentAttachmentWithGemini25Flash } = require('../geminiExtraction');

function getTimeoutMs(value, fallback) {
  const numeric = Number(value || fallback);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(120000, Math.max(3000, Math.round(numeric)));
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function callPaddleOcrService({ serviceUrl, apiKey = '', timeoutMs = 30000, imageBase64 = '', mimeType = '', fileName = '' }) {
  const normalizedUrl = String(serviceUrl || '').replace(/\/+$/, '');
  if (!normalizedUrl) {
    throw new Error('Paddle OCR service URL is not configured.');
  }

  const startedAt = Date.now();
  const response = await withTimeout(fetch(`${normalizedUrl}/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify({
      imageBase64,
      mimeType,
      fileName,
    }),
  }), timeoutMs, 'Paddle OCR service');

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail || payload?.message || `HTTP ${response.status}`;
    throw new Error(`Paddle OCR service failed: ${detail}`);
  }

  return {
    ...payload,
    elapsedMs: Number(payload?.elapsedMs || (Date.now() - startedAt)),
  };
}

function normalizePageQuestionsToText(questions = []) {
  return questions
    .map((question = {}) => {
      const questionNumber = String(question.questionNumber || '').trim();
      const text = String(question.text || '').trim();
      const options = Array.isArray(question.options) ? question.options : [];
      const optionsText = options
        .map((option = {}) => {
          const label = String(option.label || '').trim();
          const value = String(option.text || '').trim();
          return `${label} ${value}`.trim();
        })
        .filter(Boolean)
        .join('\n');

      const prefix = questionNumber ? `Question ${questionNumber}` : 'Question';
      const merged = [text, optionsText].filter(Boolean).join('\n');
      return `${prefix}\n${merged}`.trim();
    })
    .filter(Boolean);
}

function buildFallbackTextFromParsed(parsed = {}, page = {}) {
  const subject = String(parsed?.subject || '').trim();
  const topics = Array.isArray(parsed?.topics) ? parsed.topics.map((value) => String(value || '').trim()).filter(Boolean) : [];
  const warnings = Array.isArray(parsed?.warnings) ? parsed.warnings.map((value) => String(value || '').trim()).filter(Boolean) : [];
  const pageWarnings = Array.isArray(page?.warnings) ? page.warnings.map((value) => String(value || '').trim()).filter(Boolean) : [];

  const fragments = [];
  if (subject && subject.toLowerCase() !== 'unknown') fragments.push(`Subject: ${subject}`);
  if (topics.length) fragments.push(`Topics: ${topics.join(', ')}`);
  if (warnings.length) fragments.push(`Warnings: ${warnings.join(' | ')}`);
  if (pageWarnings.length) fragments.push(`Page warnings: ${pageWarnings.join(' | ')}`);
  return fragments.join('\n').trim();
}

async function geminiOcrFallback({ imageBuffer, mimeType = '', fileName = '', aiConfig = {}, timeoutMs = 45000 }) {
  const isPdf = String(mimeType || '').toLowerCase() === 'application/pdf' || (Buffer.isBuffer(imageBuffer) && imageBuffer.slice(0, 5).toString('utf8') === '%PDF-');
  const imageBuffers = await convertPdfToImages(imageBuffer, { firebaseConfig: aiConfig }).catch(() => [imageBuffer]);
  const limited = imageBuffers.slice(0, 5);
  const images = limited.map((buffer) => ({
    mimeType: 'image/png',
    base64: buffer.toString('base64'),
  }));

  const result = await withTimeout(
    extractStudentAttachmentWithGemini25Flash({
      images,
      firebaseConfig: aiConfig,
      model: 'gemini-2.5-flash',
    }),
    getTimeoutMs(timeoutMs, 45000),
    'Gemini OCR fallback',
  );

  const parsed = result?.parsedContent || {};
  const rawOutput = String(result?.rawOutput || '').trim();
  const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
  const pageOutputs = pages.map((page = {}, index) => {
    const questions = Array.isArray(page.questions) ? page.questions : [];
    const questionText = normalizePageQuestionsToText(questions).join('\n\n').trim();
    const pageText = questionText || buildFallbackTextFromParsed(parsed, page);
    return {
      pageNumber: Number(page.pageNumber || index + 1),
      extractionMethod: 'gemini_fallback',
      text: pageText,
      extractedText: pageText,
      textLength: pageText.length,
      extractionQuality: pageText ? 'good' : 'failed',
      success: Boolean(pageText),
      status: pageText ? 'complete' : 'failed',
      visualRegions: questions.flatMap((q = {}) => (Array.isArray(q.visualRegions) ? q.visualRegions : [])),
    };
  });

  const extractedText = pageOutputs.map((page) => page.extractedText).filter(Boolean).join('\n\n').trim();
  const synthesizedText = extractedText || buildFallbackTextFromParsed(parsed, {}) || rawOutput;
  const failedPageCount = pageOutputs.filter((page) => !page.success).length;

  return {
    success: Boolean(synthesizedText),
    extractedText: synthesizedText,
    text: synthesizedText,
    textLength: synthesizedText.length,
    pages: pageOutputs,
    failedPageCount,
    partialSuccess: Boolean(failedPageCount > 0 && synthesizedText),
    scannedPdfDetected: isPdf,
    ocrStatus: isPdf
      ? (failedPageCount ? (synthesizedText ? 'partial' : 'failed') : 'complete')
      : (synthesizedText ? 'complete' : 'failed'),
    extractedImages: [],
    confidence: Number(parsed.subjectConfidence || 0.5),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    provider: 'gemini-2.5-flash-fallback',
    fileType: isPdf ? 'pdf' : 'image',
    fileName,
  };
}

module.exports = {
  callPaddleOcrService,
  geminiOcrFallback,
  getTimeoutMs,
};
