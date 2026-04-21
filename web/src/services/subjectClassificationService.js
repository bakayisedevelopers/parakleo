import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { getFirebaseClients } from '../firebase/config';

const CLASSIFICATION_MODEL = import.meta.env.VITE_FIREBASE_AI_SUBJECT_MODEL || 'gemini-2.5-flash';
const MAX_CLASSIFICATION_INPUT_CHARS = 6000;

function buildFallbackClassification(supportedSubjects = []) {
  const defaultSubject = normalizeSubjectToSupported('Mathematics', supportedSubjects) || '';
  return {
    subject: defaultSubject,
    topic: '',
    estimatedMinutes: 10,
    subjectConfidence: defaultSubject ? 'unknown' : 'unknown',
    needsManualSubjectSelection: !defaultSubject,
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
    inputText,
  ].join('\n');
}

export async function classifySubjectFromText({ inputText = '', supportedSubjects = [] } = {}) {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) {
    return buildFallbackClassification(supportedSubjects);
  }

  try {
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
    console.info('[subjectClassification] prompt', {
      model: CLASSIFICATION_MODEL,
      prompt,
    });

    const response = await model.generateContent(prompt);
    const rawText = response?.response?.text?.() || '';
    const text = normalizeText(rawText);
    console.info('[subjectClassification] response', {
      model: CLASSIFICATION_MODEL,
      rawText,
    });
    const parsed = JSON.parse(text);

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
      topic,
      estimatedMinutes,
      subjectConfidence: confidence,
      needsManualSubjectSelection,
    };
  } catch (error) {
    console.debug('[subjectClassification] classification failed, using fallback', { error: error?.message });
    return buildFallbackClassification(supportedSubjects);
  }
}
