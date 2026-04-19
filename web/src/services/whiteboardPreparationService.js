const DEFAULT_TEXT_HEIGHT = 160;
const DEFAULT_IMAGE_HEIGHT = 260;
const BASE_BLOCK_SPACING = 160;
const LONG_TEXT_THRESHOLD = 320;
const LONG_TEXT_EXTRA_SPACING = 120;
const IMAGE_EXTRA_SPACING = 140;

function estimateTextHeight(text = '') {
  const normalizedLength = String(text || '').trim().length;
  if (!normalizedLength) return DEFAULT_TEXT_HEIGHT;
  return Math.max(DEFAULT_TEXT_HEIGHT, Math.ceil(normalizedLength / 2.4));
}

export function prepareWhiteboardLayout(parsedQuestions = []) {
  const safeQuestions = Array.isArray(parsedQuestions) ? parsedQuestions : [];
  const elements = [];
  let currentY = 0;

  safeQuestions.forEach((question, index) => {
    const questionLabel = question?.questionNumber
      ? `Question ${question.questionNumber}: ${question?.text || ''}`
      : String(question?.text || '');

    const textHeight = estimateTextHeight(questionLabel);

    elements.push({
      type: 'text',
      content: questionLabel,
      position: { x: 0, y: currentY },
    });

    currentY += textHeight;

    const images = Array.isArray(question?.images) ? question.images : [];
    images.forEach((image) => {
      elements.push({
        type: 'image',
        src: image?.src || '',
        position: { x: 0, y: currentY + 20 },
      });
      currentY += DEFAULT_IMAGE_HEIGHT;
    });

    let spacing = BASE_BLOCK_SPACING;
    if (questionLabel.length > LONG_TEXT_THRESHOLD) {
      spacing += LONG_TEXT_EXTRA_SPACING;
    }
    if (images.length > 0) {
      spacing += IMAGE_EXTRA_SPACING;
    }

    currentY += spacing;

    if (index === safeQuestions.length - 1) {
      currentY += 0;
    }
  });

  return elements;
}

