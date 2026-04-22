import { debugLog } from '../utils/devLogger';

const QUESTION_BOUNDARY_REGEX = /(?:^|\n)\s*(Question\s*\d+|Q\s*\d+|[0-9]{1,3}(?:\.[0-9]{1,3})*\s*[.)]?|[A-Za-z]\s*[)])/gi;
const QUESTION_LINE_START_REGEX = /^\s*(Question\s*(\d+)|Q\s*(\d+)|([0-9]{1,3}(?:\.[0-9]{1,3})*)\s*[.)]?|([A-Za-z])\s*[)])\s*/i;

function normalizeLineBreaks(text = '') {
  return String(text || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
}

function trimOcrNoise(line = '') {
  return String(line || '')
    .replace(/^[`~_|\\]+/, '')
    .replace(/[`~_|\\]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanExtractedText(rawText = '') {
  const original = String(rawText || '');
  if (!original.trim()) {
    return {
      cleanedText: '',
      stats: {
        originalLength: original.length,
        cleanedLength: 0,
        lineCount: 0,
      },
    };
  }

  let cleaned = normalizeLineBreaks(original)
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/\t/g, ' ')
    .replace(/[ \f\v]+/g, ' ')
    .replace(/([?!.,;:]){3,}/g, '$1')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  cleaned = cleaned
    .split('\n')
    .map((line) => trimOcrNoise(line))
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  cleaned = cleaned
    .replace(/\s+(Question\s*\d+|Q\s*\d+|[0-9]{1,3}(?:\.[0-9]{1,3})*\s*[.)]|[A-Za-z]\s*[)])(?=\s+)/gi, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const stats = {
    originalLength: original.length,
    cleanedLength: cleaned.length,
    lineCount: cleaned ? cleaned.split('\n').length : 0,
  };

  debugLog('questionParsing', '[textCleaning] applied.', stats);

  return {
    cleanedText: cleaned,
    stats,
  };
}

function normalizeImageAttachment(item) {
  if (!item) return null;

  if (typeof item === 'string') {
    return {
      src: item,
      type: 'image',
      fileName: '',
      mimeType: 'image/png',
    };
  }

  const contentType = String(item?.contentType || item?.mimeType || '').toLowerCase();
  const fileName = String(item?.fileName || '').toLowerCase();
  const src = item?.downloadUrl || item?.src || item?.url || '';
  const isImage = contentType.startsWith('image/')
    || /\.(png|jpg|jpeg|webp|bmp|gif|tiff?)$/.test(fileName)
    || /^data:image\//i.test(src);

  if (!src || !isImage) return null;

  let mimeType = contentType;
  if (!mimeType) {
    if (/\.(png)$/i.test(fileName) || /^data:image\/png/i.test(src)) mimeType = 'image/png';
    else if (/\.(jpe?g)$/i.test(fileName) || /^data:image\/jpeg/i.test(src)) mimeType = 'image/jpeg';
    else if (/\.(webp)$/i.test(fileName) || /^data:image\/webp/i.test(src)) mimeType = 'image/webp';
    else if (/\.(gif)$/i.test(fileName) || /^data:image\/gif/i.test(src)) mimeType = 'image/gif';
    else mimeType = 'image/png';
  }

  return {
    src,
    type: 'image',
    fileName: item?.fileName || '',
    mimeType,
    id: item?.id || '',
    width: Number(item?.width || 0) || undefined,
    height: Number(item?.height || 0) || undefined,
  };
}

function dedupeImages(images = []) {
  const seen = new Set();
  return images.filter((image) => {
    const key = `${image?.src || ''}::${image?.fileName || ''}`;
    if (!image?.src || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getQuestionNumber(boundary = '') {
  const match = String(boundary || '').match(QUESTION_LINE_START_REGEX);
  if (!match) return null;
  return match[2] || match[3] || match[4] || match[5] || null;
}

function splitQuestionsDeterministically(fullText = '') {
  const normalized = String(fullText || '').trim();
  if (!normalized) return [];

  const matches = Array.from(normalized.matchAll(QUESTION_BOUNDARY_REGEX));
  if (!matches.length) return [];

  const blocks = [];
  matches.forEach((match, index) => {
    const start = typeof match.index === 'number' ? match.index : 0;
    const boundaryStart = normalized.indexOf(match[1], start);
    const nextMatch = matches[index + 1];
    const nextStart = nextMatch && typeof nextMatch.index === 'number'
      ? normalized.indexOf(nextMatch[1], nextMatch.index)
      : normalized.length;

    const sliceStart = Math.max(0, boundaryStart);
    const sliceEnd = nextStart > sliceStart ? nextStart : normalized.length;
    const text = normalized.slice(sliceStart, sliceEnd).trim();

    if (!text) return;

    blocks.push({
      questionNumber: getQuestionNumber(match[1]),
      text,
      images: [],
    });
  });

  return blocks;
}

function buildFallbackQuestion(fullText, imageReferences = []) {
  const text = String(fullText || '').trim();
  if (!text && !imageReferences.length) return [];

  return [
    {
      questionNumber: null,
      text,
      images: imageReferences,
    },
  ];
}

function attachImagesToBlocks(blocks = [], images = []) {
  if (!blocks.length || !images.length) return blocks;

  const nextBlocks = blocks.map((block) => ({ ...block, images: [...(block.images || [])] }));

  images.forEach((image, index) => {
    const targetIndex = blocks.length === 1
      ? 0
      : Math.min(blocks.length - 1, index);
    nextBlocks[targetIndex].images.push(image);
  });

  return nextBlocks;
}

function parseSourceIntoBlocks({ text = '', images = [] }) {
  const { cleanedText } = cleanExtractedText(text);
  const structuredBlocks = splitQuestionsDeterministically(cleanedText);

  if (!structuredBlocks.length) {
    return {
      blocks: buildFallbackQuestion(cleanedText, images),
      fallbackUsed: true,
    };
  }

  return {
    blocks: attachImagesToBlocks(structuredBlocks, images),
    fallbackUsed: false,
  };
}

function normalizeAttachmentExtractions(attachmentExtractions = []) {
  return (attachmentExtractions || [])
    .map((entry) => {
      const uploadedImage = normalizeImageAttachment(entry?.uploadedAttachment);
      const extractedImages = (entry?.extractedImages || [])
        .map((image) => normalizeImageAttachment(image))
        .filter(Boolean);
      const pageImages = (entry?.pages || [])
        .flatMap((page) => page?.images || [])
        .map((image) => normalizeImageAttachment(image))
        .filter(Boolean);

      return {
        text: String(entry?.extractedText || ''),
        images: dedupeImages([
          ...pageImages,
          ...extractedImages,
          ...(uploadedImage ? [uploadedImage] : []),
        ]),
      };
    })
    .filter((entry) => String(entry.text || '').trim() || entry.images.length);
}

export function parseQuestionsFromExtraction({
  extractedText = '',
  attachments = [],
  attachmentExtractions = [],
  ocrImageReferences = [],
} = {}) {
  const attachmentImages = dedupeImages((attachments || []).map((item) => normalizeImageAttachment(item)).filter(Boolean));
  const ocrImages = dedupeImages((ocrImageReferences || []).map((item) => normalizeImageAttachment(item)).filter(Boolean));
  const extractionSources = normalizeAttachmentExtractions(attachmentExtractions);

  debugLog('questionParsing', '[parse] started.', {
    extractedTextLength: String(extractedText || '').length,
    attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
    attachmentExtractionCount: Array.isArray(attachmentExtractions) ? attachmentExtractions.length : 0,
    ocrImageReferenceCount: Array.isArray(ocrImageReferences) ? ocrImageReferences.length : 0,
  });

  const sourceBlocks = [];
  let fallbackUsed = false;
  let attachedImageCount = 0;

  if (extractionSources.length) {
    extractionSources.forEach((source) => {
      const parsed = parseSourceIntoBlocks(source);
      fallbackUsed = fallbackUsed || parsed.fallbackUsed;
      attachedImageCount += source.images.length;
      sourceBlocks.push(...parsed.blocks);
    });
  }

  if (!sourceBlocks.length) {
    const parsed = parseSourceIntoBlocks({
      text: extractedText,
      images: dedupeImages([...attachmentImages, ...ocrImages]),
    });
    fallbackUsed = parsed.fallbackUsed;
    attachedImageCount += attachmentImages.length + ocrImages.length;
    sourceBlocks.push(...parsed.blocks);
  } else {
    const extraImages = dedupeImages([
      ...ocrImages,
      ...attachmentImages.filter((image) => {
        return !sourceBlocks.some((block) => (block.images || []).some((blockImage) => blockImage.src === image.src));
      }),
    ]);

    if (extraImages.length && sourceBlocks.length) {
      sourceBlocks[sourceBlocks.length - 1].images = [
        ...(sourceBlocks[sourceBlocks.length - 1].images || []),
        ...extraImages,
      ];
      attachedImageCount += extraImages.length;
    }
  }

  const finalBlocks = sourceBlocks.length
    ? sourceBlocks
    : buildFallbackQuestion(cleanExtractedText(extractedText).cleanedText, dedupeImages([...attachmentImages, ...ocrImages]));

  debugLog('questionParsing', '[parse] finished.', {
    questionBlockCount: finalBlocks.length,
    fallbackUsed,
    attachedImageCount,
  });

  return finalBlocks;
}
