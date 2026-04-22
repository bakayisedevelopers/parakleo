import { debugLog } from '../utils/devLogger';

const DEFAULT_TEXT_WIDTH = 980;
const TEXT_LINE_HEIGHT = 26;
const TEXT_PADDING_HEIGHT = 56;
const MIN_TEXT_HEIGHT = 150;
const DEFAULT_IMAGE_WIDTH = 460;
const DEFAULT_IMAGE_HEIGHT = 320;
const QUESTION_BLOCK_SPACING = 180;
const LONG_BLOCK_EXTRA_SPACING = 90;
const IMAGE_BLOCK_SPACING = 120;
const IMAGE_STACK_SPACING = 36;
const MAX_RENDER_IMAGE_WIDTH = 900;
const MAX_RENDER_IMAGE_HEIGHT = 700;

function normalizeQuestionText(question = {}) {
  const text = String(question?.text || '').trim();
  if (!text) return '';
  return question?.questionNumber && !/^question\s/i.test(text)
    ? `Question ${question.questionNumber}\n${text}`
    : text;
}

function estimateTextHeight(text = '') {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const wrappedLineCount = lines.reduce((total, line) => {
    const estimatedWrappedLines = Math.max(1, Math.ceil(line.length / 62));
    return total + estimatedWrappedLines;
  }, 0);

  return Math.max(MIN_TEXT_HEIGHT, (wrappedLineCount * TEXT_LINE_HEIGHT) + TEXT_PADDING_HEIGHT);
}

export function prepareWhiteboardLayout(parsedQuestions = []) {
  const safeQuestions = Array.isArray(parsedQuestions) ? parsedQuestions : [];
  const elements = [];
  let currentY = 0;

  safeQuestions.forEach((question) => {
    const content = normalizeQuestionText(question);
    const hasTextContent = Boolean(content);
    const textHeight = hasTextContent ? estimateTextHeight(content) : 0;
    const images = Array.isArray(question?.images) ? question.images.filter((image) => image?.src) : [];

    if (hasTextContent) {
      elements.push({
        type: 'text',
        content,
        position: { x: 0, y: currentY },
        width: DEFAULT_TEXT_WIDTH,
        height: textHeight,
      });

      currentY += textHeight + 28;
    }

    images.forEach((image, imageIndex) => {
      const sourceWidth = Number(image?.width || 0) || DEFAULT_IMAGE_WIDTH;
      const sourceHeight = Number(image?.height || 0) || DEFAULT_IMAGE_HEIGHT;
      const scale = Math.min(
        1,
        MAX_RENDER_IMAGE_WIDTH / sourceWidth,
        MAX_RENDER_IMAGE_HEIGHT / sourceHeight,
      );
      const width = Math.max(120, Math.round(sourceWidth * scale));
      const height = Math.max(120, Math.round(sourceHeight * scale));

      elements.push({
        type: 'image',
        src: image.src,
        mimeType: image.mimeType || 'image/png',
        fileName: image.fileName || '',
        imageId: image.id || '',
        position: { x: 48, y: currentY },
        width,
        height,
      });

      currentY += height;
      if (imageIndex < images.length - 1) {
        currentY += IMAGE_STACK_SPACING;
      }
    });

    let spacing = QUESTION_BLOCK_SPACING;
    if (hasTextContent && textHeight > 280) {
      spacing += LONG_BLOCK_EXTRA_SPACING;
    }
    if (images.length) {
      spacing += IMAGE_BLOCK_SPACING;
    }

    currentY += spacing;
  });

  debugLog('whiteboardPreparation', '[layout] prepared.', {
    questionCount: safeQuestions.length,
    imageCount: safeQuestions.reduce((count, question) => count + (question?.images?.length || 0), 0),
    elementCount: elements.length,
  });

  return elements;
}
