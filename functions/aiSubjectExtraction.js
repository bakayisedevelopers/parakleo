const { initializeApp, getApp, getApps } = require('firebase/app');
const { getAI, getGenerativeModel, GoogleAIBackend } = require('firebase/ai');
const { pdfToPng } = require('pdf-to-png-converter');
const { normalizeSubjectName } = require('./subjectExtraction');

const MAX_PDF_PAGES = 5;
const MAX_IMAGE_BYTES = 19 * 1024 * 1024;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_CLASSIFICATION_INPUT_CHARS = 6000;
const DEFAULT_GEMINI_TIMEOUT_MS = 45 * 1000;

function getGeminiConfig() {
  return {
    model: process.env.GEMINI_MODEL || process.env.FIREBASE_AI_MODEL || DEFAULT_GEMINI_MODEL,
    backend: 'firebase-ai-logic-google-ai',
  };
}

function getFirebaseAiConfig(overrides = {}) {
  const config = {
    apiKey: overrides.apiKey || overrides.FIREBASE_API_KEY || overrides.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: overrides.authDomain || overrides.FIREBASE_AUTH_DOMAIN || overrides.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: overrides.projectId || overrides.FIREBASE_PROJECT_ID || overrides.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: overrides.storageBucket || overrides.FIREBASE_STORAGE_BUCKET || overrides.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: overrides.messagingSenderId || overrides.FIREBASE_MESSAGING_SENDER_ID || overrides.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: overrides.appId || overrides.FIREBASE_APP_ID || overrides.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
  };

  const missing = ['apiKey', 'projectId', 'appId'].filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`CLAXI_AI_KEYS is missing Firebase AI Logic config field(s): ${missing.join(', ')}`);
  }

  return config;
}

function getFirebaseAiModel(options = {}) {
  const firebaseConfig = getFirebaseAiConfig(options.firebaseConfig || {});
  const appName = `claxi-ai-${firebaseConfig.projectId}`;
  const app = getApps().some((candidate) => candidate.name === appName)
    ? getApp(appName)
    : initializeApp(firebaseConfig, appName);
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  return getGenerativeModel(ai, {
    model: options.model || getGeminiConfig().model,
    generationConfig: options.generationConfig,
  });
}

function getGeminiTimeoutMs() {
  const numeric = Number(process.env.GEMINI_TIMEOUT_MS || DEFAULT_GEMINI_TIMEOUT_MS);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_GEMINI_TIMEOUT_MS;
  return Math.min(120000, Math.max(5000, Math.round(numeric)));
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.slice(0, 5).toString('utf8') === '%PDF-';
}

function getImageMimeType(buffer) {
  if (!Buffer.isBuffer(buffer)) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return 'image/png';
}

function assertImageSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Document image conversion produced an empty image.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Document image is too large for AI processing.');
  }
}

async function convertPdfToImages(buffer) {
  if (!isPdfBuffer(buffer)) {
    assertImageSize(buffer);
    return [buffer];
  }

  const pagesToProcess = Array.from({ length: MAX_PDF_PAGES }, (_, index) => index + 1);
  const pages = await pdfToPng(buffer, {
    viewportScale: 1.5,
    pagesToProcess,
    strictPagesToProcess: false,
    disableFontFace: false,
    useSystemFonts: false,
    verbosityLevel: 0,
  });

  const images = pages
    .slice(0, MAX_PDF_PAGES)
    .map((page) => page.content)
    .filter(Buffer.isBuffer);

  if (!images.length) {
    throw new Error('No PDF pages could be converted for AI processing.');
  }

  images.forEach(assertImageSize);
  return images;
}

function parseAiJson(text = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw error;
    return JSON.parse(arrayMatch[0]);
  }
}

function validateSubjectMarks(result) {
  if (!Array.isArray(result)) return [];

  const bySubject = new Map();
  result.forEach((item) => {
    const rawSubject = typeof item?.subject === 'string' ? item.subject.trim() : '';
    const subject = normalizeSubjectName(rawSubject) || rawSubject;
    const mark = Number(item?.mark);

    if (!subject || !Number.isFinite(mark) || mark < 0 || mark > 100) return;

    const roundedMark = Math.round(mark);
    const existing = bySubject.get(subject);
    if (!existing || roundedMark > existing.mark) {
      bySubject.set(subject, { subject, mark: roundedMark });
    }
  });

  return [...bySubject.values()].sort((a, b) => a.subject.localeCompare(b.subject));
}

function buildVisionPromptContent(images) {
  const prompt = `You are extracting academic results from a student report.

Analyze the images carefully.

Return ONLY valid JSON in this format:
[
  { "subject": "Mathematics", "mark": 78 },
  { "subject": "English", "mark": 65 }
]

Rules:
- Match each subject with the correct mark
- Marks must be between 0 and 100
- Ignore invalid or unclear entries
- Normalize subject names:
  - Maths -> Mathematics
  - Math Lit -> Mathematical Literacy
  - Physics/Chemistry -> Physical Sciences
  - Zulu -> IsiZulu
- Combine Physics and Chemistry into "Physical Sciences" if both appear
- Do NOT hallucinate
- If unsure, skip the entry
- Do NOT return explanations
- ONLY return JSON`;

  return {
    prompt,
    contents: [{
      role: 'user',
      parts: [
    {
      text: prompt,
    },
    ...images.map((buffer) => {
      assertImageSize(buffer);
      const mimeType = getImageMimeType(buffer);
      return {
        inlineData: {
          mimeType,
          data: buffer.toString('base64'),
        },
      };
    }),
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };
}

async function callGeminiForSubjects(images, options = {}) {
  const request = buildVisionPromptContent(images);
  const { prompt, ...geminiRequest } = request;
  const result = await withTimeout(
    getFirebaseAiModel({
      firebaseConfig: options.firebaseConfig || {},
      generationConfig: geminiRequest.generationConfig,
    }).generateContent(geminiRequest.contents[0].parts),
    getGeminiTimeoutMs(),
    'Firebase AI Logic subject extraction',
  );
  return result.response.text();
}

async function extractSubjectsWithAI(images, options = {}) {
  let lastError = null;
  const logger = options.logger || console;
  const logContext = options.logContext || {};
  const config = getGeminiConfig();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      logger.info?.('gemini_subject_extraction_started', {
        ...logContext,
        attempt,
        imageCount: images.length,
        imageBytes: images.map((image) => image.length),
        provider: 'firebase-ai-logic',
        aiBackend: getGeminiConfig().backend,
        model: config.model,
        timeoutMs: getGeminiTimeoutMs(),
      });
      const outputText = await callGeminiForSubjects(images, options);
      const parsed = parseAiJson(outputText);
      const validated = validateSubjectMarks(parsed);
      logger.info?.('gemini_subject_extraction_completed', {
        ...logContext,
        attempt,
        durationMs: Date.now() - startedAt,
        rawOutput: outputText,
        extractedSubjectCount: validated.length,
      });
      return validated;
    } catch (error) {
      lastError = error;
      logger.warn?.('gemini_subject_extraction_attempt_failed', {
        ...logContext,
        attempt,
        durationMs: Date.now() - startedAt,
        error: error.message,
      });
    }
  }

  throw new Error(lastError?.message || 'AI subject extraction failed.');
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value = '', maxChars = MAX_CLASSIFICATION_INPUT_CHARS) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
}

function clampEstimatedMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 10;
  return Math.min(90, Math.max(10, Math.round(numeric)));
}

function getSupportedSubjectMap(supportedSubjects = []) {
  return supportedSubjects.reduce((acc, subject) => {
    const value = normalizeText(subject?.value || subject);
    const label = normalizeText(subject?.label);
    if (!value) return acc;
    acc.set(value.toLowerCase(), value);
    if (label) acc.set(label.toLowerCase(), value);
    return acc;
  }, new Map());
}

function normalizeSubjectToSupported(rawSubject, supportedSubjects = []) {
  const normalizedText = normalizeText(rawSubject);
  const normalized = normalizedText.toLowerCase();
  if (!normalized) return '';
  const supportedMap = getSupportedSubjectMap(supportedSubjects);
  const directMatch = supportedMap.get(normalized);
  if (directMatch) return directMatch;

  const aliasMatch = normalizeSubjectName(normalizedText);
  return aliasMatch ? supportedMap.get(aliasMatch.toLowerCase()) || '' : '';
}

function buildFallbackClassification(supportedSubjects = []) {
  const defaultSubject = normalizeSubjectToSupported('Mathematics', supportedSubjects) || '';
  return {
    subject: defaultSubject,
    topic: '',
    estimatedMinutes: 10,
    subjectConfidence: 'unknown',
    needsManualSubjectSelection: !defaultSubject,
  };
}

function validateSubjectClassification(parsed, supportedSubjects = []) {
  const fallback = buildFallbackClassification(supportedSubjects);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;

  const supportedSubject = normalizeSubjectToSupported(parsed.subject, supportedSubjects);
  const confidence = ['high', 'low', 'unknown'].includes(parsed.subjectConfidence)
    ? parsed.subjectConfidence
    : 'unknown';

  return {
    subject: supportedSubject || fallback.subject,
    topic: normalizeText(parsed.topic),
    estimatedMinutes: clampEstimatedMinutes(parsed.estimatedMinutes),
    subjectConfidence: confidence,
    needsManualSubjectSelection: Boolean(parsed.needsManualSubjectSelection)
      || !supportedSubject
      || confidence !== 'high',
  };
}

function buildClassificationPrompt({ supportedSubjects = [], inputText = '' }) {
  const supportedList = supportedSubjects.map((subject) => subject?.value || subject).filter(Boolean);
  return [
    'You classify tutoring request text.',
    `Supported subjects: ${supportedList.join(', ')}`,
    'Return JSON only with keys: subject, topic, estimatedMinutes, subjectConfidence, needsManualSubjectSelection.',
    'Rules:',
    '- subject must be one of the supported subjects above or empty string.',
    '- topic must be a short optional string or empty string.',
    '- estimatedMinutes must be an integer from 10 to 90.',
    '- estimatedMinutes should reflect likely tutoring workload visible in the text, including question count, text volume, and diagram or multi-step complexity when implied.',
    '- Treat estimatedMinutes as a suggestion, not a fixed booking length.',
    "- subjectConfidence must be one of: 'high', 'low', 'unknown'.",
    '- needsManualSubjectSelection must be true when subject is unclear, unsupported, or ambiguous.',
    '- If text does not clearly indicate a supported subject, set subject to empty string, subjectConfidence to unknown, needsManualSubjectSelection to true.',
    '- Do not infer beyond the provided text.',
    '',
    'Input text:',
    truncateText(normalizeText(inputText)),
  ].join('\n');
}

async function classifySubjectWithAI({ inputText = '', supportedSubjects = [], firebaseConfig = {} } = {}) {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) return buildFallbackClassification(supportedSubjects);

  const prompt = buildClassificationPrompt({ supportedSubjects, inputText: normalizedInput });
  const result = await withTimeout(getFirebaseAiModel({
    firebaseConfig,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 300,
      responseMimeType: 'application/json',
    },
  }).generateContent(prompt), getGeminiTimeoutMs(), 'Firebase AI Logic subject classification');

  const outputText = result.response.text();
  return {
    classification: validateSubjectClassification(parseAiJson(outputText), supportedSubjects),
    rawOutput: outputText,
    prompt,
    model: getGeminiConfig().model,
    provider: 'firebase-ai-logic',
    backend: getGeminiConfig().backend,
  };
}

module.exports = {
  MAX_PDF_PAGES,
  convertPdfToImages,
  extractSubjectsWithAI,
  classifySubjectWithAI,
  validateSubjectClassification,
  validateSubjectMarks,
};
