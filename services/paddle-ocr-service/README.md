# Paddle OCR Service (Cloud Run)

This service provides raw OCR + structured layout extraction for Claxi using PaddleOCR and PP-StructureV3.

## Endpoint
- `POST /extract`

## Request JSON
```json
{
  "imageBase64": "...",
  "mimeType": "image/png",
  "fileName": "worksheet.png",
  "objectPath": "optional",
  "downloadUrl": "optional"
}
```

`imageBase64` is required in current implementation.

## Response JSON
Includes:
- `success`
- `extractedText`
- `text`
- `textLength`
- `pages[]`
- `extractedImages[]`
- `visualRegions[]`
- `tables[]`
- `formulas[]`
- `confidence`
- `provider` (`paddleocr_ppstructure`)
- `warnings[]`
- `elapsedMs`

## Env Vars
- `PADDLE_OCR_SERVICE_API_KEY` (optional API key check via `x-api-key`)
- `PADDLE_OCR_MAX_PDF_PAGES` (default `10`)
- `PADDLE_OCR_MAX_IMAGE_BYTES` (default `20971520`)

## Local Run
```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Cloud Run Deploy Example
```bash
gcloud builds submit --tag gcr.io/<PROJECT_ID>/claxi-paddle-ocr ./services/paddle-ocr-service

gcloud run deploy claxi-paddle-ocr \
  --image gcr.io/<PROJECT_ID>/claxi-paddle-ocr \
  --region us-central1 \
  --platform managed \
  --cpu 4 \
  --memory 8Gi \
  --concurrency 2 \
  --min-instances 0 \
  --max-instances 20 \
  --allow-unauthenticated
```

Use authenticated ingress + API key in production.
