function normalizeText(rawText = '') {
  return String(rawText || '').replace(/\s+/g, ' ').trim();
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function evaluateExtractionQuality(text = '', confidence = 0) {
  const normalized = normalizeText(text);
  const textLength = normalized.length;
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;

  if (!textLength) {
    return {
      extractionQuality: 'failed',
      isUsable: false,
      reason: 'empty_text',
      textLength,
      wordCount,
      confidence: clamp01(confidence),
    };
  }

  if (textLength < 20 || wordCount < 3) {
    return {
      extractionQuality: 'poor',
      isUsable: false,
      reason: 'text_too_short',
      textLength,
      wordCount,
      confidence: clamp01(confidence),
    };
  }

  if (clamp01(confidence) < 0.45) {
    return {
      extractionQuality: 'poor',
      isUsable: false,
      reason: 'low_confidence',
      textLength,
      wordCount,
      confidence: clamp01(confidence),
    };
  }

  return {
    extractionQuality: 'good',
    isUsable: true,
    reason: 'ok',
    textLength,
    wordCount,
    confidence: clamp01(confidence),
  };
}

function normalizePaddleResult(payload = {}, context = {}) {
  const extractedText = normalizeText(payload.extractedText || payload.text || '');
  const textLength = Number(payload.textLength || extractedText.length || 0);
  const pages = Array.isArray(payload.pages) ? payload.pages : [];
  const failedPageCount = pages.filter((page) => !page?.success).length;
  const scannedPdfDetected = Boolean(context.isPdfInput || pages.length > 1);
  const confidence = clamp01(payload.confidence);
  const quality = evaluateExtractionQuality(extractedText, confidence);

  return {
    success: Boolean(payload.success && textLength > 0),
    extractedText,
    text: normalizeText(payload.text || extractedText),
    textLength,
    extractionMethod: context.isPdfInput ? 'pdf_ocr' : 'ocr',
    provider: 'paddleocr_ppstructure',
    fileType: context.isPdfInput ? 'pdf' : 'image',
    extractionQuality: quality.extractionQuality,
    scannedPdfDetected,
    ocrStatus: context.isPdfInput
      ? (failedPageCount ? (textLength > 0 ? 'partial' : 'failed') : 'complete')
      : 'complete',
    pageCount: pages.length || (context.isPdfInput ? null : 1),
    selectedPages: pages.map((page) => Number(page?.pageNumber || 0)).filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber > 0),
    pages,
    failedPageCount,
    partialSuccess: Boolean(failedPageCount > 0 && textLength > 0),
    extractedImages: Array.isArray(payload.extractedImages) ? payload.extractedImages : [],
    source: context.isPdfInput ? 'pdf' : 'image',
    confidence,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    elapsedMs: Number(payload.elapsedMs || 0),
    qualitySignal: quality,
  };
}

function normalizeGeminiFallbackResult(payload = {}, context = {}) {
  const extractedText = normalizeText(payload.extractedText || payload.text || '');
  const textLength = Number(payload.textLength || extractedText.length || 0);
  const pages = Array.isArray(payload.pages) ? payload.pages : [];
  const failedPageCount = pages.filter((page) => !page?.success).length;

  return {
    success: Boolean(textLength > 0),
    extractedText,
    text: extractedText,
    textLength,
    extractionMethod: context.isPdfInput ? 'pdf_gemini_fallback' : 'gemini_fallback',
    provider: 'gemini-2.5-flash-fallback',
    fileType: context.isPdfInput ? 'pdf' : 'image',
    extractionQuality: textLength > 0 ? (failedPageCount ? 'poor' : 'good') : 'failed',
    scannedPdfDetected: Boolean(context.isPdfInput),
    ocrStatus: context.isPdfInput
      ? (failedPageCount ? (textLength > 0 ? 'partial' : 'failed') : 'complete')
      : (textLength > 0 ? 'complete' : 'failed'),
    pageCount: pages.length || (context.isPdfInput ? null : 1),
    selectedPages: pages.map((page) => Number(page?.pageNumber || 0)).filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber > 0),
    pages,
    failedPageCount,
    partialSuccess: Boolean(failedPageCount > 0 && textLength > 0),
    extractedImages: Array.isArray(payload.extractedImages) ? payload.extractedImages : [],
    source: context.isPdfInput ? 'pdf' : 'image',
    confidence: Number(payload.confidence || 0),
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    elapsedMs: Number(payload.elapsedMs || 0),
    qualitySignal: evaluateExtractionQuality(extractedText, Number(payload.confidence || 0.5)),
  };
}

module.exports = {
  normalizeText,
  clamp01,
  evaluateExtractionQuality,
  normalizePaddleResult,
  normalizeGeminiFallbackResult,
};
