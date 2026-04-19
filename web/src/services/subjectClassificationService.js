import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { getFirebaseClients } from '../firebase/config';

const CLASSIFICATION_MODEL = import.meta.env.VITE_FIREBASE_AI_SUBJECT_MODEL || 'gemini-2.5-flash';
const MAX_CLASSIFICATION_INPUT_CHARS = 6000;

const UNKNOWN_CLASSIFICATION = {
  subject: '',
  topic: '',
  subjectConfidence: 'unknown',
  needsManualSubjectSelection: true,
};

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value = '', maxChars = MAX_CLASSIFICATION_INPUT_CHARS) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
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

export function buildSubjectClassificationInput({ typedText = '', attachmentExtractions = [] } = {}) {
  const normalizedTypedText = normalizeText(typedText);

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

  const combinedText = truncateText(combinedSections.join('\n\n'));

  return {
    combinedText,
    sourceLabels,
    hasUsableText: Boolean(combinedText),
  };
}

function buildClassificationPrompt({ supportedSubjects = [], inputText = '' }) {
  const supportedList = supportedSubjects.map((subject) => subject.value).filter(Boolean);
  return [
    'You classify tutoring request text.',
    `Supported subjects: ${supportedList.join(', ')}`,
    'Return JSON only with keys: subject, topic, subjectConfidence, needsManualSubjectSelection.',
    'Rules:',
    '- subject must be one of the supported subjects above or empty string.',
    '- topic must be a short optional string or empty string.',
    "- subjectConfidence must be one of: 'high', 'low', 'unknown'.",
    '- needsManualSubjectSelection must be true when subject is unclear, unsupported, or ambiguous.',
    '- If text does not clearly indicate a supported subject, set subject to empty string, subjectConfidence to unknown, needsManualSubjectSelection to true.',
    '- Do not infer beyond the provided text.',
    '',
    'Input text:',
    inputText,
  ].join('\n');
}

export async function classifySubjectFromText({ inputText = '', supportedSubjects = [] } = {}) {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) {
    return UNKNOWN_CLASSIFICATION;
  }

  await getFirebaseClients();

  const ai = getAI(undefined, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: CLASSIFICATION_MODEL,
    generationConfig: {
      temperature: 0,
      topK: 1,
      topP: 0.1,
      maxOutputTokens: 200,
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildClassificationPrompt({ supportedSubjects, inputText: normalizedInput });
  const response = await model.generateContent(prompt);
  const text = normalizeText(response?.response?.text?.() || '');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.debug('[subjectClassification] invalid JSON response', { error: error?.message, text });
    return UNKNOWN_CLASSIFICATION;
  }

  const supportedSubject = normalizeSubjectToSupported(parsed?.subject, supportedSubjects);
  const confidence = ['high', 'low', 'unknown'].includes(parsed?.subjectConfidence)
    ? parsed.subjectConfidence
    : 'unknown';
  const topic = normalizeText(parsed?.topic);

  const needsManualSubjectSelection = Boolean(parsed?.needsManualSubjectSelection)
    || !supportedSubject
    || confidence === 'unknown';

  return {
    subject: supportedSubject,
    topic,
    subjectConfidence: confidence,
    needsManualSubjectSelection,
  };
}
