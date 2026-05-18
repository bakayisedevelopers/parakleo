const { callPaddleOcrService, geminiOcrFallback, getTimeoutMs } = require('./paddleOcrProvider');
const {
  normalizePaddleResult,
  normalizeGeminiFallbackResult,
  evaluateExtractionQuality,
} = require('./ocrNormalization');

function getProviderMode(config = {}) {
  const mode = String(config.OCR_PROVIDER_MODE || process.env.OCR_PROVIDER_MODE || 'paddle_first').toLowerCase();
  if (['paddle_first', 'gemini_only', 'legacy_vision'].includes(mode)) return mode;
  return 'paddle_first';
}

function getMinConfidence(config = {}) {
  const numeric = Number(config.PADDLE_OCR_MIN_CONFIDENCE || process.env.PADDLE_OCR_MIN_CONFIDENCE || 0.55);
  if (!Number.isFinite(numeric)) return 0.55;
  return Math.max(0, Math.min(1, numeric));
}

async function runOcrProviderRouter({
  imageBuffer,
  imageBase64,
  mimeType,
  fileName,
  sourceLabel,
  aiConfig = {},
  legacyVisionRunner = null,
  logger = console,
}) {
  const startedAt = Date.now();
  const mode = getProviderMode(aiConfig);
  const timeoutMs = getTimeoutMs(aiConfig.PADDLE_OCR_TIMEOUT_MS || process.env.PADDLE_OCR_TIMEOUT_MS, 30000);
  const minConfidence = getMinConfidence(aiConfig);
  const isPdfInput = String(mimeType || '').toLowerCase() === 'application/pdf'
    || (Buffer.isBuffer(imageBuffer) && imageBuffer.slice(0, 5).toString('utf8') === '%PDF-');
  const context = { isPdfInput };

  const tryGeminiFallback = async (reason) => {
    const gemini = await geminiOcrFallback({
      imageBuffer,
      mimeType,
      fileName,
      aiConfig,
      timeoutMs,
    });
    const normalized = normalizeGeminiFallbackResult({
      ...gemini,
      warnings: [...(gemini.warnings || []), `fallback_reason:${reason}`],
      elapsedMs: Date.now() - startedAt,
    }, context);
    return { result: normalized, route: 'gemini_fallback', reason };
  };

  if (mode === 'gemini_only') {
    return tryGeminiFallback('mode_gemini_only');
  }

  if (mode === 'legacy_vision' && typeof legacyVisionRunner === 'function') {
    const legacy = await legacyVisionRunner();
    return {
      result: {
        ...legacy,
        elapsedMs: Date.now() - startedAt,
      },
      route: 'legacy_vision',
      reason: 'mode_legacy_vision',
    };
  }

  const serviceUrl = aiConfig.PADDLE_OCR_SERVICE_URL || process.env.PADDLE_OCR_SERVICE_URL || '';
  const serviceApiKey = aiConfig.PADDLE_OCR_SERVICE_API_KEY || process.env.PADDLE_OCR_SERVICE_API_KEY || '';

  if (!serviceUrl) {
    logger.warn('paddle_ocr_service_not_configured', { source: sourceLabel || '', mode });
    return tryGeminiFallback('paddle_service_not_configured');
  }

  try {
    const paddlePayload = await callPaddleOcrService({
      serviceUrl,
      apiKey: serviceApiKey,
      timeoutMs,
      imageBase64,
      mimeType,
      fileName,
    });

    const normalized = normalizePaddleResult({
      ...paddlePayload,
      elapsedMs: Date.now() - startedAt,
    }, context);

    const quality = evaluateExtractionQuality(normalized.extractedText, normalized.confidence);
    const confidenceTooLow = normalized.confidence < minConfidence;
    const lowQuality = !quality.isUsable;

    if (!normalized.success || confidenceTooLow || lowQuality) {
      return tryGeminiFallback(confidenceTooLow ? 'low_confidence' : (lowQuality ? quality.reason : 'paddle_unsuccessful'));
    }

    return {
      result: normalized,
      route: 'paddle_primary',
      reason: 'paddle_success',
    };
  } catch (error) {
    logger.warn('paddle_ocr_primary_failed', {
      source: sourceLabel || '',
      mode,
      message: error?.message || 'unknown_error',
    });
    return tryGeminiFallback('paddle_error');
  }
}

module.exports = {
  runOcrProviderRouter,
  getProviderMode,
};
