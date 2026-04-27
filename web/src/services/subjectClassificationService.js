import { getFirebaseClients } from '../firebase/config';

const CLASSIFY_SUBJECT_ENDPOINT = import.meta.env.VITE_CLASSIFY_SUBJECT_ENDPOINT || '/classify-subject';
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

export async function classifySubjectFromText({ inputText = '', supportedSubjects = [] } = {}) {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) {
    return buildFallbackClassification(supportedSubjects);
  }

  try {
    const clients = await getFirebaseClients();
    const idToken = await clients?.auth?.currentUser?.getIdToken?.();

    if (!idToken) {
      throw new Error('You must be signed in before classifying a request.');
    }

    const response = await fetch(CLASSIFY_SUBJECT_ENDPOINT, {
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
    if (!response.ok || payload?.success !== true || !payload?.classification) {
      throw new Error(payload?.message || 'Subject classification failed.');
    }

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
