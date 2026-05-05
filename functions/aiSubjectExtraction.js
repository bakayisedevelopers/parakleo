const { initializeApp, getApp, getApps } = require('firebase/app');
const { getAI, getGenerativeModel, GoogleAIBackend } = require('firebase/ai');
const { pdfToPng } = require('pdf-to-png-converter');
const { normalizeSubjectName } = require('./subjectExtraction');

const DEFAULT_MAX_PDF_PAGES = 8;
const MAX_IMAGE_BYTES = 19 * 1024 * 1024;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const TUTOR_RESULTS_GEMINI_MODEL = 'gemini-2.5-pro';
const MAX_CLASSIFICATION_INPUT_CHARS = 6000;
const DEFAULT_GEMINI_TIMEOUT_MS = 45 * 1000;
const DEFAULT_CLASSIFICATION_TIMEOUT_MS = 30 * 1000;

function getGeminiConfig(overrides = {}) {
  return {
    model: overrides.GEMINI_MODEL
      || overrides.FIREBASE_AI_MODEL
      || process.env.GEMINI_MODEL
      || process.env.FIREBASE_AI_MODEL
      || DEFAULT_GEMINI_MODEL,
    visionModel: overrides.GEMINI_VISION_MODEL
      || overrides.GEMINI_MODEL
      || overrides.FIREBASE_AI_MODEL
      || process.env.GEMINI_VISION_MODEL
      || process.env.GEMINI_MODEL
      || process.env.FIREBASE_AI_MODEL
      || DEFAULT_GEMINI_MODEL,
    classificationModel: overrides.GEMINI_CLASSIFICATION_MODEL
      || overrides.GEMINI_MODEL
      || overrides.FIREBASE_AI_MODEL
      || process.env.GEMINI_CLASSIFICATION_MODEL
      || process.env.GEMINI_MODEL
      || process.env.FIREBASE_AI_MODEL
      || DEFAULT_GEMINI_MODEL,
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
    model: options.model || getGeminiConfig(options.firebaseConfig || {}).model,
    generationConfig: options.generationConfig,
  });
}

function getMaxPdfPages(overrides = {}) {
  const numeric = Number(overrides.MAX_PDF_PAGES || process.env.MAX_PDF_PAGES || DEFAULT_MAX_PDF_PAGES);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_MAX_PDF_PAGES;
  return Math.min(10, Math.max(1, Math.round(numeric)));
}

function getGeminiTimeoutMs() {
  const numeric = Number(process.env.GEMINI_TIMEOUT_MS || DEFAULT_GEMINI_TIMEOUT_MS);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_GEMINI_TIMEOUT_MS;
  return Math.min(120000, Math.max(5000, Math.round(numeric)));
}

function getClassificationTimeoutMs(overrides = {}) {
  const numeric = Number(
    overrides.GEMINI_CLASSIFICATION_TIMEOUT_MS
      || process.env.GEMINI_CLASSIFICATION_TIMEOUT_MS
      || DEFAULT_CLASSIFICATION_TIMEOUT_MS,
  );
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_CLASSIFICATION_TIMEOUT_MS;
  return Math.min(30000, Math.max(5000, Math.round(numeric)));
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

async function convertPdfToImages(buffer, options = {}) {
  if (!isPdfBuffer(buffer)) {
    assertImageSize(buffer);
    return [buffer];
  }

  const maxPages = getMaxPdfPages(options.firebaseConfig || options);
  const pagesToProcess = Array.from({ length: maxPages }, (_, index) => index + 1);
  const pages = await pdfToPng(buffer, {
    viewportScale: 2,
    pagesToProcess,
    strictPagesToProcess: false,
    disableFontFace: false,
    useSystemFonts: false,
    verbosityLevel: 0,
  });

  const images = pages
    .slice(0, maxPages)
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
  if (!trimmed) return null;

  const attempts = [
    () => JSON.parse(trimmed),
    () => {
      const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      return fencedMatch?.[1] ? JSON.parse(fencedMatch[1].trim()) : null;
    },
    () => {
      const arrayStart = trimmed.indexOf('[');
      const arrayEnd = trimmed.lastIndexOf(']');
      return arrayStart >= 0 && arrayEnd > arrayStart
        ? JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1))
        : null;
    },
    () => {
      const objectStart = trimmed.indexOf('{');
      const objectEnd = trimmed.lastIndexOf('}');
      return objectStart >= 0 && objectEnd > objectStart
        ? JSON.parse(trimmed.slice(objectStart, objectEnd + 1))
        : null;
    },
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      if (parsed) return parsed;
    } catch (error) {
      // Try the next recovery path.
    }
  }

  return null;
}

function validateSubjectMarks(result) {
  const subjectRows = Array.isArray(result) ? result : result?.subjects;
  if (!Array.isArray(subjectRows)) return [];

  const bySubject = new Map();
  subjectRows.forEach((item) => {
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

Rules:
- extractionStatus must be SUCCESS if any clear subject-and-mark pairs are found; otherwise use UNCLEAR_IMAGE, NO_SUBJECTS_FOUND, TOO_BLURRY, or another appropriate failure status.
- aiReasoning must briefly explain why that status was chosen.
- The document may be a matric certificate, varsity transcript, school report, result statement, or foreign academic results page. Do not assume a single country or layout.
- Extract every clear subject/course/module and its mark/percentage/grade where a numeric mark is present.
- If the document uses grade points, convert only when the mapping is explicit; otherwise skip the item rather than guessing.
- Marks must be between 0 and 100 when the document provides numeric marks.
- Ignore invalid, duplicated, or unclear entries.
- Normalize obvious subject aliases when safe:
  - Maths -> Mathematics
  - Math Lit -> Mathematical Literacy
  - Physics/Chemistry -> Physical Sciences
  - Zulu -> IsiZulu
- Preserve subject names as written when there is no safe normalization.
- Do NOT hallucinate.
- If unsure, skip the entry`;

  console.debug('[tutorResultsAI] vision prompt prepared', {
    imageCount: Array.isArray(images) ? images.length : 0,
    imageBytes: Array.isArray(images) ? images.map((buffer) => buffer.length) : [],
    prompt,
  });

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
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: {
        type: "OBJECT",
        properties: {
          extractionStatus: {
            type: "STRING",
            enum: ["SUCCESS", "UNCLEAR_IMAGE", "NO_SUBJECTS_FOUND", "TOO_BLURRY"],
            description: "Status of the extraction process."
          },
          aiReasoning: {
            type: "STRING",
            description: "Explain why this status was chosen."
          },
          subjects: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                subject: { type: "STRING" },
                mark: { type: "NUMBER" }
              },
              required: ["subject", "mark"]
            }
          }
        },
        required: ["extractionStatus", "aiReasoning", "subjects"]
      }
    },
  };
}

async function callGeminiForTutorResults(images, options = {}) {
  const request = buildVisionPromptContent(images);
  const { prompt, ...geminiRequest } = request;
  const config = getGeminiConfig(options.firebaseConfig || {});
  const model = options.model || TUTOR_RESULTS_GEMINI_MODEL;

  console.log("=== TUTOR RESULTS GEMINI PROMPT (TEXT) ===");
  console.log(prompt);
  console.log("=== TUTOR RESULTS GEMINI PROMPT (OBJECT) ===");
  console.log(JSON.stringify({ prompt }, null, 2));

  console.debug('[tutorResultsGemini] vision prompt sending to Gemini', {
    model,
    timeoutMs: getGeminiTimeoutMs(),
    prompt,
  });

  const result = await withTimeout(
    getFirebaseAiModel({
      firebaseConfig: options.firebaseConfig || {},
      model,
      generationConfig: geminiRequest.generationConfig,
    }).generateContent(geminiRequest.contents[0].parts),
    getGeminiTimeoutMs(),
    'Firebase AI Logic subject extraction',
  );
  const outputText = result.response.text();

  console.log("=== TUTOR RESULTS GEMINI OUTPUT (TEXT) ===");
  console.log(outputText);
  console.log("=== TUTOR RESULTS GEMINI OUTPUT (OBJECT) ===");
  try {
    console.log(JSON.stringify(parseAiJson(outputText), null, 2));
  } catch(e) {
    console.log("Parse error:", e.message);
  }

  console.debug('[tutorResultsGemini] vision raw output received', {
    model,
    outputText,
  });
  return { prompt, outputText };
}

async function extractTutorResultsWithGemini25Pro(images, options = {}) {
  let lastError = null;
  const logger = options.logger || console;
  const logContext = options.logContext || {};
  const config = getGeminiConfig(options.firebaseConfig || {});
  const model = options.model || TUTOR_RESULTS_GEMINI_MODEL;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      logger.info?.('gemini_tutor_results_extraction_started', {
        ...logContext,
        attempt,
        imageCount: images.length,
        imageBytes: images.map((image) => image.length),
        provider: 'firebase-ai-logic',
        aiBackend: config.backend,
        model,
        timeoutMs: getGeminiTimeoutMs(),
      });
      const { prompt, outputText } = await callGeminiForTutorResults(images, {
        ...options,
        model,
      });
      const parsed = parseAiJson(outputText);
      const validated = validateSubjectMarks(parsed);
      const aiReasoning = parsed?.aiReasoning || '';
      console.debug('[tutorResultsGemini] vision output parsed and validated', {
        ...logContext,
        attempt,
        prompt,
        rawOutput: outputText,
        parsed,
        validated,
        aiReasoning,
      });
      logger.info?.('gemini_tutor_results_extraction_completed', {
        ...logContext,
        attempt,
        durationMs: Date.now() - startedAt,
        prompt,
        rawOutput: outputText,
        extractedSubjectCount: validated.length,
      });
      return {
        validated,
        prompt,
        rawOutput: outputText,
        reasoning: aiReasoning,
      };
    } catch (error) {
      lastError = error;
      console.debug('[tutorResultsGemini] vision extraction attempt failed', {
        ...logContext,
        attempt,
        error: error.message,
      });
      logger.warn?.('gemini_tutor_results_extraction_attempt_failed', {
        ...logContext,
        attempt,
        durationMs: Date.now() - startedAt,
        error: error.message,
      });
    }
  }

  throw new Error('AI could not read valid subjects and marks from this document. Upload a clearer result document or try a stronger Gemini vision model.');
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
  return {
    subject: '',
    unsupportedSubject: '',
    topic: '',
    estimatedMinutes: 10,
    subjectConfidence: 'unknown',
    needsManualSubjectSelection: true,
    unsupportedSubjectRequested: false,
  };
}

function normalizeClassificationPayload(inputPayload = {}, inputText = '') {
  const payload = inputPayload && typeof inputPayload === 'object' && !Array.isArray(inputPayload)
    ? inputPayload
    : {};

  const sourceLabels = Array.isArray(payload.sourceLabels) ? payload.sourceLabels.slice(0, 10) : [];
  const questionBlocks = Array.isArray(payload.questionBlocks)
    ? payload.questionBlocks.slice(0, 6).map((block, index) => ({
      index,
      label: normalizeText(block?.label || `Question ${index + 1}`),
      text: truncateText(normalizeText(block?.text), 1200),
      textLength: Number(block?.textLength || normalizeText(block?.text).length || 0),
    })).filter((block) => block.text)
    : [];

  const attachmentSummaries = Array.isArray(payload.attachmentSummaries)
    ? payload.attachmentSummaries.slice(0, 6).map((entry, index) => ({
      index,
      fileName: normalizeText(entry?.fileName),
      fileType: normalizeText(entry?.fileType),
      extractionMethod: normalizeText(entry?.extractionMethod),
      extractionQuality: normalizeText(entry?.extractionQuality),
      scannedPdfDetected: Boolean(entry?.scannedPdfDetected),
      ocrStatus: normalizeText(entry?.ocrStatus),
      success: Boolean(entry?.success),
      partialSuccess: Boolean(entry?.partialSuccess),
      textPreview: truncateText(normalizeText(entry?.textPreview), 1200),
      textLength: Number(entry?.textLength || 0),
      selectedPages: Array.isArray(entry?.selectedPages) ? entry.selectedPages.slice(0, 10) : [],
      failedPageCount: Number(entry?.failedPageCount || 0),
    }))
    : [];

  const subjectHints = Array.isArray(payload.subjectHints)
    ? payload.subjectHints.map((value) => normalizeText(value)).filter(Boolean).slice(0, 10)
    : [];

  const typedTextPreview = truncateText(normalizeText(payload.typedTextPreview || inputText), 2500);
  const combinedTextPreview = truncateText(normalizeText(payload.combinedTextPreview || inputText), 3000);

  return {
    version: Number(payload.version || 1),
    sourceLabels,
    hasTypedText: Boolean(payload.hasTypedText),
    typedTextPreview,
    typedTextLength: Number(payload.typedTextLength || typedTextPreview.length || 0),
    questionBlocks,
    attachmentSummaries,
    subjectHints,
    totalAttachmentCount: Number(payload.totalAttachmentCount || 0),
    combinedTextPreview,
  };
}

function validateSubjectClassification(parsed, supportedSubjects = []) {
  const fallback = buildFallbackClassification(supportedSubjects);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;

  const supportedSubject = normalizeSubjectToSupported(parsed.subject, supportedSubjects);
  const unsupportedCandidate = normalizeText(parsed.unsupportedSubject || (!supportedSubject ? parsed.subject : ''));
  const unsupportedSubject = unsupportedCandidate && !normalizeSubjectToSupported(unsupportedCandidate, supportedSubjects)
    ? unsupportedCandidate
    : '';
  const confidence = ['high', 'low', 'unknown'].includes(parsed.subjectConfidence)
    ? parsed.subjectConfidence
    : 'unknown';

  return {
    subject: supportedSubject || fallback.subject,
    unsupportedSubject,
    topic: normalizeText(parsed.topic),
    estimatedMinutes: clampEstimatedMinutes(parsed.estimatedMinutes),
    subjectConfidence: confidence,
    needsManualSubjectSelection: Boolean(parsed.needsManualSubjectSelection)
      || !supportedSubject
      || confidence !== 'high',
    unsupportedSubjectRequested: Boolean(unsupportedSubject),
  };
}

function buildClassificationResponseSchema(supportedSubjects = []) {
  const supportedList = supportedSubjects.map((subject) => subject?.value || subject).filter(Boolean);

  return {
    type: 'OBJECT',
    properties: {
      classificationStatus: {
        type: 'STRING',
        enum: ['SUCCESS', 'UNCLEAR_TEXT', 'UNRELATED_TOPIC', 'TOO_NOISY', 'TOO_MUCH_TEXT'],
        description: 'Status of the classification process.',
      },
      aiReasoning: {
        type: 'STRING',
        description: 'Explain why this status was chosen, especially if it is not SUCCESS.',
      },
      subject: {
        type: 'STRING',
        description: 'One of the supported subjects, or an empty string if unsupported or unclear. The prompt lists the supported subjects; do not invent others.',
      },
      unsupportedSubject: {
        type: 'STRING',
        description: 'Requested subject name when the subject is not offered by Claxi.',
      },
      topic: {
        type: 'STRING',
        description: 'Short topic summary from the request.',
      },
      estimatedMinutes: {
        type: 'NUMBER',
        description: 'Estimated tutoring time from 10 to 90 minutes.',
      },
      subjectConfidence: {
        type: 'STRING',
        enum: ['high', 'low', 'unknown'],
      },
      needsManualSubjectSelection: {
        type: 'BOOLEAN',
      },
    },
    required: [
      'classificationStatus',
      'aiReasoning',
      'subject',
      'unsupportedSubject',
      'topic',
      'estimatedMinutes',
      'subjectConfidence',
      'needsManualSubjectSelection',
    ],
  };
}

function buildClassificationPrompt({ supportedSubjects = [], inputPayload = {}, inputText = '' }) {
  const supportedList = supportedSubjects.map((subject) => subject?.value || subject).filter(Boolean);
  const normalizedPayload = normalizeClassificationPayload(inputPayload, inputText);
  const prompt = [
    'You classify tutoring request text.',
    'The input may contain noisy OCR text from homework images or pasted questions from different countries and school systems. First identify actual question text, formulas, instructions, and topic clues. Ignore page headers, random OCR fragments, names, dates, marks, and unrelated noise.',
    `Supported subjects: ${supportedList.join(', ')}`,
    'Output must be valid JSON and must match the requested structure exactly.',
    'Return only the fields requested in the schema.',
    'Rules:',
    '- classificationStatus must represent your success in understanding the text (e.g. SUCCESS, TOO_NOISY).',
    '- aiReasoning must briefly explain why you chose that status.',
    '- subject must be one of the supported subjects above or empty string.',
    '- unsupportedSubject must be empty when the best requested subject is supported or unclear.',
    '- unsupportedSubject must contain the requested subject name only when the text clearly asks for a subject that is not in the supported subjects list.',
    '- topic must be a short optional string or empty string.',
    '- estimatedMinutes must be an integer from 10 to 90.',
    '- estimatedMinutes should reflect likely tutoring workload visible in the text, including question count, text volume, and diagram or multi-step complexity when implied.',
    '- Treat estimatedMinutes as a suggestion, not a fixed booking length.',
    "- subjectConfidence must be one of: 'high', 'low', 'unknown'.",
    '- needsManualSubjectSelection must be true when subject is unclear, unsupported, or ambiguous.',
    '- If question text clearly points to a supported subject, return the best supported subject even when OCR has noise.',
    '- If question text clearly points to an unsupported subject, set subject to empty string, unsupportedSubject to that subject, subjectConfidence to high, and needsManualSubjectSelection to true.',
    '- If text is too random or does not clearly indicate a supported subject, set subject to empty string, subjectConfidence to unknown, needsManualSubjectSelection to true.',
    '- Do not infer beyond the provided text.',
    '',
    'Requested JSON shape:',
    JSON.stringify({
      classificationStatus: 'SUCCESS',
      aiReasoning: 'short explanation',
      subject: 'one supported subject or empty string',
      unsupportedSubject: 'empty string unless the subject is not offered',
      topic: 'short topic summary',
      estimatedMinutes: 10,
      subjectConfidence: 'high',
      needsManualSubjectSelection: true,
    }, null, 2),
    '',
    'Input payload:',
    JSON.stringify(normalizedPayload, null, 2),
  ].join('\n');

  console.debug('[studentRequestAI] classification prompt prepared', {
    supportedSubjectCount: supportedList.length,
    supportedSubjects: supportedList,
    inputPayload: normalizedPayload,
    prompt,
  });

  return prompt;
}

async function classifySubjectWithAI({ inputText = '', inputPayload = null, supportedSubjects = [], firebaseConfig = {} } = {}) {
  const normalizedInput = normalizeText(inputText || inputPayload?.combinedTextPreview || inputPayload?.typedTextPreview || '');
  if (!normalizedInput) return buildFallbackClassification(supportedSubjects);

  const prompt = buildClassificationPrompt({ supportedSubjects, inputPayload, inputText: normalizedInput });
  const config = getGeminiConfig(firebaseConfig);

  console.log("=== SUBJECT CLASSIFICATION AI PROMPT (TEXT) ===");
  console.log(prompt);
  console.log("=== SUBJECT CLASSIFICATION AI PROMPT (OBJECT) ===");
  console.log(JSON.stringify({ prompt }, null, 2));

  console.debug('[studentRequestAI] classification request starting', {
    model: config.classificationModel,
    supportedSubjectCount: supportedSubjects.length,
    inputLength: normalizedInput.length,
    inputPayload,
    timeoutMs: getClassificationTimeoutMs(firebaseConfig),
  });
  let outputText = '';
  let lastError = null;
  try {
    const result = await withTimeout(getFirebaseAiModel({
      firebaseConfig,
      model: config.classificationModel,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: buildClassificationResponseSchema(supportedSubjects),
      },
    }).generateContent(prompt), getClassificationTimeoutMs(firebaseConfig), 'Firebase AI Logic subject classification');

    outputText = result.response.text();
  } catch (error) {
    lastError = error;
  }

  console.log("=== SUBJECT CLASSIFICATION AI OUTPUT (TEXT) ===");
  console.log(outputText);
  console.log("=== SUBJECT CLASSIFICATION AI OUTPUT (OBJECT) ===");
  try {
    console.log(JSON.stringify(parseAiJson(outputText), null, 2));
  } catch(e) {
    console.log("Parse error:", e.message);
  }

  console.debug('[studentRequestAI] classification raw output received', {
    model: config.classificationModel,
    outputText,
  });
  const parsed = parseAiJson(outputText);
  const classification = validateSubjectClassification(parsed, supportedSubjects);
  console.debug('[studentRequestAI] classification parsed and validated', {
    model: config.classificationModel,
    prompt,
    parsed,
    classification,
  });
  return {
    classification,
    rawOutput: outputText,
    prompt,
    model: config.classificationModel,
    provider: 'firebase-ai-logic',
    backend: config.backend,
    error: lastError?.message || '',
  };
}

module.exports = {
  MAX_PDF_PAGES: DEFAULT_MAX_PDF_PAGES,
  convertPdfToImages,
  extractTutorResultsWithGemini25Pro,
  classifySubjectWithAI,
  validateSubjectClassification,
  validateSubjectMarks,
};
