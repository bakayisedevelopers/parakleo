import base64
import io
import os
import time
from typing import Any, Dict, List, Optional

import numpy as np
import pypdfium2 as pdfium
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from PIL import Image
from paddleocr import PPStructure, PaddleOCR

API_KEY = os.getenv('PADDLE_OCR_SERVICE_API_KEY', '').strip()
MAX_PDF_PAGES = int(os.getenv('PADDLE_OCR_MAX_PDF_PAGES', '10'))
MAX_IMAGE_BYTES = int(os.getenv('PADDLE_OCR_MAX_IMAGE_BYTES', str(20 * 1024 * 1024)))

app = FastAPI(title='claxi-paddle-ocr-service')

ocr_engine: Optional[PaddleOCR] = None
pp_structure: Optional[PPStructure] = None


class ExtractRequest(BaseModel):
    imageBase64: Optional[str] = None
    mimeType: Optional[str] = None
    fileName: Optional[str] = None
    objectPath: Optional[str] = None
    downloadUrl: Optional[str] = None


def get_engines() -> tuple[PaddleOCR, PPStructure]:
    global ocr_engine, pp_structure
    if ocr_engine is None:
        ocr_engine = PaddleOCR(use_angle_cls=True, lang='en')
    if pp_structure is None:
        pp_structure = PPStructure()
    return ocr_engine, pp_structure


def decode_base64_payload(value: str) -> bytes:
    raw = (value or '').strip()
    if ',' in raw:
        raw = raw.split(',', 1)[1]
    data = base64.b64decode(raw)
    if not data:
        raise ValueError('empty image payload')
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError('payload too large')
    return data


def is_pdf_bytes(data: bytes, mime_type: str) -> bool:
    return (mime_type or '').lower() == 'application/pdf' or data[:5] == b'%PDF-'


def pdf_bytes_to_images(data: bytes) -> List[np.ndarray]:
    images: List[np.ndarray] = []
    pdf = pdfium.PdfDocument(data)
    page_count = min(len(pdf), MAX_PDF_PAGES)
    for index in range(page_count):
      page = pdf[index]
      bitmap = page.render(scale=2).to_pil()
      images.append(np.array(bitmap.convert('RGB')))
    return images


def image_bytes_to_np(data: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(data)).convert('RGB')
    return np.array(image)


def normalize_ocr_lines(ocr_result: Any) -> tuple[str, float]:
    text_parts: List[str] = []
    confidences: List[float] = []
    if isinstance(ocr_result, list):
        for block in ocr_result:
            if not isinstance(block, list):
                continue
            for line in block:
                if not isinstance(line, list) or len(line) < 2:
                    continue
                content = line[1]
                if not isinstance(content, (list, tuple)) or not content:
                    continue
                line_text = str(content[0] or '').strip()
                line_conf = float(content[1] or 0)
                if line_text:
                    text_parts.append(line_text)
                    confidences.append(max(0.0, min(1.0, line_conf)))
    joined = ' '.join(text_parts).strip()
    confidence = float(sum(confidences) / len(confidences)) if confidences else 0.0
    return joined, confidence


def normalize_structured_regions(structured: Any) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    visual_regions: List[Dict[str, Any]] = []
    tables: List[Dict[str, Any]] = []
    formulas: List[Dict[str, Any]] = []
    extracted_images: List[Dict[str, Any]] = []
    warnings: List[str] = []

    if not isinstance(structured, list):
        return visual_regions, tables, formulas, extracted_images, warnings

    for item in structured:
        if not isinstance(item, dict):
            continue
        item_type = str(item.get('type') or 'other').lower()
        bbox = item.get('bbox') or item.get('box') or []
        region = {
            'type': item_type,
            'x': float(bbox[0]) if len(bbox) > 0 else 0.0,
            'y': float(bbox[1]) if len(bbox) > 1 else 0.0,
            'width': float(bbox[2] - bbox[0]) if len(bbox) > 3 else 0.0,
            'height': float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0.0,
            'description': str(item.get('res') or item.get('text') or '').strip(),
        }
        if region['width'] > 0 and region['height'] > 0:
            visual_regions.append(region)

        if 'table' in item_type:
            tables.append({
                'bbox': bbox,
                'html': str(item.get('res') or ''),
                'confidence': float(item.get('score') or 0),
            })
        if 'formula' in item_type or 'equation' in item_type:
            formulas.append({
                'bbox': bbox,
                'latex': str(item.get('res') or item.get('text') or ''),
                'confidence': float(item.get('score') or 0),
            })
        if item_type in ('figure', 'image', 'diagram', 'chart'):
            extracted_images.append({
                'id': str(item.get('id') or ''),
                'mimeType': 'image/png',
                'width': max(0.0, region['width']),
                'height': max(0.0, region['height']),
                'description': region['description'],
            })

    if not visual_regions:
        warnings.append('No structured regions detected.')

    return visual_regions, tables, formulas, extracted_images, warnings


@app.get('/healthz')
def healthz() -> Dict[str, Any]:
    return {'ok': True}


@app.post('/extract')
def extract(req: ExtractRequest, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail='Unauthorized')

    if not req.imageBase64:
        raise HTTPException(status_code=400, detail='imageBase64 is required')

    started = time.time()
    try:
        data = decode_base64_payload(req.imageBase64)
        mime_type = (req.mimeType or '').strip()
        pages_np = pdf_bytes_to_images(data) if is_pdf_bytes(data, mime_type) else [image_bytes_to_np(data)]
        ocr, structure = get_engines()

        page_results: List[Dict[str, Any]] = []
        full_text_parts: List[str] = []
        confidence_parts: List[float] = []
        all_visual_regions: List[Dict[str, Any]] = []
        all_tables: List[Dict[str, Any]] = []
        all_formulas: List[Dict[str, Any]] = []
        all_extracted_images: List[Dict[str, Any]] = []
        warnings: List[str] = []

        for i, page_img in enumerate(pages_np):
            ocr_result = ocr.ocr(page_img, cls=True)
            page_text, page_confidence = normalize_ocr_lines(ocr_result)
            structured = structure(page_img)
            visual_regions, tables, formulas, extracted_images, page_warnings = normalize_structured_regions(structured)

            if page_text:
                full_text_parts.append(page_text)
            confidence_parts.append(page_confidence)
            all_visual_regions.extend(visual_regions)
            all_tables.extend(tables)
            all_formulas.extend(formulas)
            all_extracted_images.extend(extracted_images)
            warnings.extend(page_warnings)

            page_results.append({
                'pageNumber': i + 1,
                'text': page_text,
                'extractedText': page_text,
                'textLength': len(page_text),
                'confidence': page_confidence,
                'visualRegions': visual_regions,
                'tables': tables,
                'formulas': formulas,
                'status': 'complete' if page_text else 'failed',
                'success': bool(page_text),
            })

        extracted_text = '\n\n'.join(part for part in full_text_parts if part).strip()
        confidence = float(sum(confidence_parts) / len(confidence_parts)) if confidence_parts else 0.0
        elapsed_ms = int((time.time() - started) * 1000)

        return {
            'success': bool(extracted_text),
            'extractedText': extracted_text,
            'text': extracted_text,
            'textLength': len(extracted_text),
            'pages': page_results,
            'extractedImages': all_extracted_images,
            'visualRegions': all_visual_regions,
            'tables': all_tables,
            'formulas': all_formulas,
            'confidence': confidence,
            'provider': 'paddleocr_ppstructure',
            'warnings': warnings[:20],
            'elapsedMs': elapsed_ms,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f'Extraction failed: {type(error).__name__}') from error
