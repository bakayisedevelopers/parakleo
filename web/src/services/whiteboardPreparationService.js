import { debugLog } from '../utils/devLogger';

const DEFAULT_TEXT_WIDTH = 980;
const TEXT_LINE_HEIGHT = 26;
const TEXT_PADDING_HEIGHT = 56;
const MIN_TEXT_HEIGHT = 150;
const DEFAULT_IMAGE_WIDTH = 460;
const DEFAULT_IMAGE_HEIGHT = 320;
const SIDE_LANE_X = DEFAULT_TEXT_WIDTH + 64;
const SIDE_LANE_WIDTH = 420;
const FILE_CARD_HEIGHT = 160;
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

function normalizeFileReferences(files = []) {
  const seen = new Set();
  return (Array.isArray(files) ? files : [])
    .map((file) => ({
      url: file?.url || file?.downloadUrl || file?.src || '',
      fileName: file?.fileName || file?.name || 'Uploaded file',
      mimeType: file?.mimeType || file?.contentType || file?.type || '',
    }))
    .filter((file) => {
      const key = `${file.url}::${file.fileName}`;
      if (!file.url || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getScaledImageSize(image) {
  const sourceWidth = Number(image?.width || 0) || DEFAULT_IMAGE_WIDTH;
  const sourceHeight = Number(image?.height || 0) || DEFAULT_IMAGE_HEIGHT;
  const scale = Math.min(
    1,
    MAX_RENDER_IMAGE_WIDTH / sourceWidth,
    MAX_RENDER_IMAGE_HEIGHT / sourceHeight,
  );

  return {
    width: Math.max(120, Math.round(sourceWidth * scale)),
    height: Math.max(120, Math.round(sourceHeight * scale)),
  };
}

function pushImageElement(elements, image, position) {
  const { width, height } = getScaledImageSize(image);
  elements.push({
    type: 'image',
    src: image.src,
    mimeType: image.mimeType || 'image/png',
    fileName: image.fileName || '',
    imageId: image.id || '',
    position,
    width,
    height,
  });

  return { width, height };
}

function pushFileElement(elements, file, position) {
  elements.push({
    type: 'file',
    url: file.url,
    fileName: file.fileName || 'Uploaded file',
    mimeType: file.mimeType || '',
    position,
    width: SIDE_LANE_WIDTH,
    height: FILE_CARD_HEIGHT,
  });

  return { width: SIDE_LANE_WIDTH, height: FILE_CARD_HEIGHT };
}

export function prepareWhiteboardLayout(parsedQuestions = []) {
  const safeQuestions = Array.isArray(parsedQuestions) ? parsedQuestions : [];
  const elements = [];
  let currentY = 0;

  safeQuestions.forEach((question, questionIndex) => {
    const content = normalizeQuestionText(question);
    const hasTextContent = Boolean(content);
    const textHeight = hasTextContent ? estimateTextHeight(content) : 0;
    const images = Array.isArray(question?.images) ? question.images.filter((image) => image?.src) : [];
    const files = normalizeFileReferences(question?.files);
    const sideLaneItems = questionIndex === 0 ? [...files, ...images] : [];
    let sideLaneBottom = currentY;
    const questionTopY = currentY;

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

    if (sideLaneItems.length) {
      const sideLaneX = hasTextContent ? SIDE_LANE_X : 0;
      let sideY = questionTopY;
      sideLaneItems.forEach((item, itemIndex) => {
        const size = item?.type === 'file' || item?.url
          ? pushFileElement(elements, item, { x: sideLaneX, y: sideY })
          : pushImageElement(elements, item, { x: sideLaneX, y: sideY });
        sideY += size.height;
        if (itemIndex < sideLaneItems.length - 1) {
          sideY += IMAGE_STACK_SPACING;
        }
      });
      sideLaneBottom = Math.max(sideLaneBottom, sideY);
    }

    if (questionIndex !== 0) {
      images.forEach((image, imageIndex) => {
        const size = pushImageElement(elements, image, { x: 48, y: currentY });
        currentY += size.height;
        if (imageIndex < images.length - 1) {
          currentY += IMAGE_STACK_SPACING;
        }
      });

      files.forEach((file, fileIndex) => {
        const size = pushFileElement(elements, file, { x: 48, y: currentY });
        currentY += size.height;
        if (fileIndex < files.length - 1) {
          currentY += IMAGE_STACK_SPACING;
        }
      });
    } else if (sideLaneBottom > currentY) {
      currentY = sideLaneBottom;
    }

    if (!hasTextContent && !images.length && !files.length) {
      return;
    }

    if (questionIndex === 0 && sideLaneItems.length) {
      const sideImageCount = images.length;
      const sideFileCount = files.length;
      debugLog('whiteboardPreparation', '[layout] placed first question side attachments.', {
        sideImageCount,
        sideFileCount,
        sideLaneX: hasTextContent ? SIDE_LANE_X : 0,
      });
    }

    if (questionIndex === 0 && sideLaneItems.length) {
      currentY = Math.max(currentY, sideLaneBottom);
    }

    let spacing = QUESTION_BLOCK_SPACING;
    if (hasTextContent && textHeight > 280) {
      spacing += LONG_BLOCK_EXTRA_SPACING;
    }
    if (images.length || files.length) {
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
