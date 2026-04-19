const QUESTION_BOUNDARY_REGEX = /^\s*(?:Question\s*(\d+)|Q\s*(\d+)|([0-9]{1,3})\s*[.)])\s*/i;

function normalizeText(text = '') {
  return String(text || '').replace(/\r\n?/g, '\n').trim();
}

function getQuestionNumber(line = '') {
  const match = line.match(QUESTION_BOUNDARY_REGEX);
  if (!match) return null;
  return match[1] || match[2] || match[3] || null;
}

function shouldStartNewQuestion(line = '') {
  return QUESTION_BOUNDARY_REGEX.test(line || '');
}

function normalizeImageAttachments(attachments = []) {
  return (attachments || [])
    .filter(Boolean)
    .map((item) => {
      if (typeof item === 'string') {
        return { src: item, type: 'image' };
      }

      const contentType = String(item?.contentType || '').toLowerCase();
      const fileName = String(item?.fileName || '').toLowerCase();
      const isImage = contentType.startsWith('image/')
        || /\.(png|jpg|jpeg|webp|bmp|gif|tiff?)$/.test(fileName);

      return {
        src: item?.downloadUrl || item?.src || '',
        type: isImage ? 'image' : 'pdf',
        fileName: item?.fileName || '',
      };
    })
    .filter((item) => item.src);
}

function buildFallbackQuestion(fullText, imageReferences = []) {
  return [
    {
      questionNumber: null,
      text: normalizeText(fullText),
      images: imageReferences,
    },
  ];
}

function splitQuestionsDeterministically(fullText = '') {
  const normalized = normalizeText(fullText);
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const questions = [];
  let current = null;

  lines.forEach((line) => {
    if (shouldStartNewQuestion(line)) {
      if (current?.text?.trim()) {
        questions.push({
          questionNumber: current.questionNumber,
          text: current.text.trim(),
          images: [],
        });
      }

      current = {
        questionNumber: getQuestionNumber(line),
        text: line.trim(),
      };
      return;
    }

    if (!current) {
      current = {
        questionNumber: null,
        text: '',
      };
    }

    current.text = `${current.text}${current.text ? '\n' : ''}${line}`;
  });

  if (current?.text?.trim()) {
    questions.push({
      questionNumber: current.questionNumber,
      text: current.text.trim(),
      images: [],
    });
  }

  return questions;
}

function attachImagesToQuestions({ questions, imageReferences }) {
  if (!questions.length) return questions;
  if (!imageReferences.length) return questions;

  return questions.map((question, index) => {
    if (questions.length === 1) {
      return {
        ...question,
        images: imageReferences,
      };
    }

    return {
      ...question,
      images: index === 0 ? imageReferences : [],
    };
  });
}

export function parseQuestionsFromExtraction({
  extractedText = '',
  attachments = [],
  ocrImageReferences = [],
} = {}) {
  console.debug('[questionParsing] parsing started', {
    extractedTextLength: String(extractedText || '').length,
    attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
    ocrImageReferenceCount: Array.isArray(ocrImageReferences) ? ocrImageReferences.length : 0,
  });

  const parsedQuestions = splitQuestionsDeterministically(extractedText);
  const attachmentImages = normalizeImageAttachments(attachments);
  const ocrImages = normalizeImageAttachments(ocrImageReferences);
  const imageReferences = [...attachmentImages, ...ocrImages];

  if (!parsedQuestions.length) {
    const fallback = buildFallbackQuestion(extractedText, imageReferences);
    console.debug('[questionParsing] fallback used', {
      reason: 'no_question_boundaries_detected',
      questionCount: fallback.length,
    });
    return fallback;
  }

  const withImages = attachImagesToQuestions({
    questions: parsedQuestions,
    imageReferences,
  });

  console.debug('[questionParsing] number of questions detected', {
    questionCount: withImages.length,
    fallbackUsed: false,
  });

  return withImages;
}

