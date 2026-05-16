# Paddle OCR Service (Cloud Run)

This service provides OCR + document parsing for Claxi using PaddleOCR-VL 1.5 on CPU (Cloud Run).

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
- `provider` (`paddleocr_vl_1_5`)
- `warnings[]`
- `elapsedMs`

## Env Vars
- `PADDLE_OCR_SERVICE_API_KEY` (optional API key check via `x-api-key`)
- `PADDLE_OCR_MAX_PDF_PAGES` (default `10`)
- `PADDLE_OCR_MAX_IMAGE_BYTES` (default `20971520`)
- `PADDLE_OCR_VL_PIPELINE_VERSION` (default `v1.5`)
- `PADDLE_OCR_VL_DEVICE` (default `cpu`)
- `PADDLE_OCR_VL_USE_LAYOUT_DETECTION` (default `true`)
- `PADDLE_OCR_VL_USE_DOC_ORIENTATION_CLASSIFY` (default `false`)
- `PADDLE_OCR_VL_USE_DOC_UNWARPING` (default `false`)

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
  --cpu-boost \
  --min-instances 0 \
  --max-instances 20 \
  --allow-unauthenticated \
  --set-env-vars PADDLE_OCR_VL_PIPELINE_VERSION=v1.5,PADDLE_OCR_VL_DEVICE=cpu,PADDLE_OCR_VL_USE_LAYOUT_DETECTION=true,PADDLE_OCR_VL_USE_DOC_ORIENTATION_CLASSIFY=false,PADDLE_OCR_VL_USE_DOC_UNWARPING=false
```

Use authenticated ingress + API key in production.
