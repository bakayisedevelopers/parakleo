# PaddleOCR + PP-StructureV3 Migration Notes

## Backend OCR Routing

`extractImageOcr` now uses `functions/ocr/ocrProviderRouter.js`.

Provider routing order:
1. PaddleOCR Cloud Run (if configured)
2. Gemini 2.5 Flash fallback (for low confidence, timeout, or provider failure)
3. Legacy Vision only when `OCR_PROVIDER_MODE=legacy_vision`

## New Function Env Vars

- `PADDLE_OCR_SERVICE_URL`
- `PADDLE_OCR_SERVICE_API_KEY` (optional)
- `PADDLE_OCR_TIMEOUT_MS` (default ~30000)
- `PADDLE_OCR_MIN_CONFIDENCE` (default ~0.55)
- `OCR_PROVIDER_MODE` (`paddle_first` | `gemini_only` | `legacy_vision`)

## Classify Subject Path

`classifySubject` now does:
1. Local subject classifier (rules/keywords)
2. Local topic detector
3. Local minutes estimation (always local)
4. Gemini fallback only when local subject/topic confidence is low

Response shape remains compatible and now includes extra metadata fields:
- `topics`
- `topicConfidence`
- `subjectMethod`
- `topicMethod`
- `minutesMethod`
- `minutesConfidence`
- `minutesSignalsUsed`

## Rollback

Set `OCR_PROVIDER_MODE=legacy_vision` to route `/image-ocr` back to existing Vision OCR behavior.

## Cloud Run Recommended Start

- CPU: 4
- RAM: 8Gi
- Concurrency: 2
- Min instances: 0
- Max instances: 20

## Local verification

Run:
- `npm --prefix functions test`
