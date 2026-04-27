import { getFirebaseClients } from '../firebase/config';
import { cleanExtractedText, parseQuestionsFromExtraction } from './questionParsingService';

const CLASSIFY_SUBJECT_ENDPOINT = import.meta.env.VITE_CLASSIFY_SUBJECT_ENDPOINT || '/classify-subject';
const MAX_CLASSIFICATION_INPUT_CHARS = 6000;
const CLASSIFICATION_TIMEOUT_MS = 12000;

function buildFallbackClassification(supportedSubjects = []) {
  return {
    subject: '',
    unsupportedSubject: '',
    topic: '',
    estimatedMinutes: 10,
    subjectConfidence: 'unknown',
    needsManualSubjectSelection: true,
    unsupportedSubjectRequested: false,
    isFallback: true,
  };
}

function clampEstimatedMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 10;
  return Math.min(90, Math.max(10, Math.round(numeric)));
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value = '', maxChars = MAX_CLASSIFICATION_INPUT_CHARS) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
}

function formatQuestionBlocksForClassification({ typedText = '', attachmentExtractions = [] } = {}) {
  const blocks = parseQuestionsFromExtraction({
    extractedText: typedText,
    attachmentExtractions,
  });

  if (!blocks.length) {
    return cleanExtractedText(typedText).cleanedText;
  }

  return blocks
    .map((block, index) => {
      const label = block.questionNumber ? `Question ${block.questionNumber}` : `Question ${index + 1}`;
      return `${label}:\n${cleanExtractedText(block.text).cleanedText}`;
    })
    .filter((text) => text.replace(/^Question[^:]*:\s*/i, '').trim())
    .join('\n\n---\n\n')
    .trim();
}

function getSupportedSubjectMap(supportedSubjects = []) {
  return supportedSubjects.reduce((acc, subject) => {
    const value = normalizeText(subject?.value);
    const label = normalizeText(subject?.label);
    if (!value) return acc;
    acc.set(value.toLowerCase(), value);
    if (label) {
      acc.set(label.toLowerCase(), value);
    }
    return acc;
  }, new Map());
}

function normalizeSubjectToSupported(rawSubject, supportedSubjects = []) {
  const normalized = normalizeText(rawSubject).toLowerCase();
  if (!normalized) return '';
  const supportedMap = getSupportedSubjectMap(supportedSubjects);
  return supportedMap.get(normalized) || '';
}

function fetchWithTimeout(url, options = {}, timeoutMs = CLASSIFICATION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeoutId));
}

export function buildSubjectClassificationInput({ typedText = '', attachmentExtractions = [] } = {}) {
  const normalizedTypedText = cleanExtractedText(typedText).cleanedText;

  const usableAttachmentTexts = attachmentExtractions
    .map((entry) => normalizeText(entry?.extractedText))
    .filter(Boolean);

  const sourceLabels = [];
  if (normalizedTypedText) sourceLabels.push('typed_text');
  if (usableAttachmentTexts.length) sourceLabels.push('attachment_extracted_text');

  const combinedSections = [];
  if (normalizedTypedText) {
    combinedSections.push(`Typed request text:\n${normalizedTypedText}`);
  }
  if (usableAttachmentTexts.length) {
    combinedSections.push(`Extracted attachment text:\n${usableAttachmentTexts.join('\n\n---\n\n')}`);
  }

  const structuredText = formatQuestionBlocksForClassification({
    typedText: combinedSections.join('\n\n'),
    attachmentExtractions,
  });
  const combinedText = truncateText(structuredText || combinedSections.join('\n\n'));

  return {
    combinedText,
    sourceLabels,
    hasUsableText: Boolean(combinedText),
  };
}

export async function classifySubjectFromText({ inputText = '', supportedSubjects = [] } = {}) {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) {
    console.debug('[studentRequestAI] frontend fallback before request', {
      reason: 'empty_input',
      supportedSubjectCount: supportedSubjects.length,
    });
    return buildFallbackClassification(supportedSubjects);
  }

  try {
    const startedAt = Date.now();
    const clients = await getFirebaseClients();
    const idToken = await clients?.auth?.currentUser?.getIdToken?.();

    if (!idToken) {
      throw new Error('You must be signed in before classifying a request.');
    }

    console.debug('[studentRequestAI] frontend classification request starting', {
      endpoint: CLASSIFY_SUBJECT_ENDPOINT,
      inputLength: normalizedInput.length,
      supportedSubjectCount: supportedSubjects.length,
      timeoutMs: CLASSIFICATION_TIMEOUT_MS,
      inputText: normalizedInput,
      supportedSubjects,
    });

    const response = await fetchWithTimeout(CLASSIFY_SUBJECT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        inputText: normalizedInput,
        supportedSubjects,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    console.debug('[studentRequestAI] frontend classification response received', {
      endpoint: CLASSIFY_SUBJECT_ENDPOINT,
      ok: response.ok,
      status: response.status,
      payload,
    });
    if (!response.ok || payload?.success !== true || !payload?.classification) {
      throw new Error(payload?.message || 'Subject classification failed.');
    }

    console.debug('[studentRequestAI] frontend classification completed', {
      durationMs: Date.now() - startedAt,
      provider: payload.provider,
      classification: payload.classification,
    });

    const parsed = payload.classification;

    const fallbackClassification = buildFallbackClassification(supportedSubjects);
    const supportedSubject = normalizeSubjectToSupported(parsed?.subject, supportedSubjects) || fallbackClassification.subject;
    const confidence = ['high', 'low', 'unknown'].includes(parsed?.subjectConfidence)
      ? parsed.subjectConfidence
      : 'unknown';
    const topic = normalizeText(parsed?.topic);
    const estimatedMinutes = clampEstimatedMinutes(parsed?.estimatedMinutes);

    const needsManualSubjectSelection = Boolean(parsed?.needsManualSubjectSelection)
      || !supportedSubject
      || (!fallbackClassification.subject && confidence === 'unknown');

    return {
      subject: supportedSubject,
      unsupportedSubject: normalizeText(parsed?.unsupportedSubject),
      topic,
      estimatedMinutes,
      subjectConfidence: confidence,
      needsManualSubjectSelection,
      unsupportedSubjectRequested: Boolean(parsed?.unsupportedSubjectRequested || parsed?.unsupportedSubject),
      isFallback: false,
    };
  } catch (error) {
    console.debug('[studentRequestAI] frontend classification failed, using fallback', { error: error?.message });
    return buildFallbackClassification(supportedSubjects);
  }
}
