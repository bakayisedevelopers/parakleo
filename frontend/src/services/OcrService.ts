import { z } from 'zod';

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrTextBlock {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface OcrResult {
  text: string;
  blocks: OcrTextBlock[];
  method: 'browser-native' | 'react-native-native-ocr';
  metadata: {
    durationMs: number;
    source: string;
    blockCount: number;
  };
}

const FileInputSchema = z.object({
  name: z.string().min(1),
  size: z.number().nonnegative(),
  type: z.string(),
});

const ImagePathSchema = z.string().min(1);

function normalizeText(raw: string): string {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sortByGeometry(blocks: OcrTextBlock[]): OcrTextBlock[] {
  return [...blocks].sort((a, b) => {
    const ay = a.boundingBox?.top ?? Number.MAX_SAFE_INTEGER;
    const by = b.boundingBox?.top ?? Number.MAX_SAFE_INTEGER;
    if (Math.abs(ay - by) > 8) return ay - by;

    const ax = a.boundingBox?.left ?? Number.MAX_SAFE_INTEGER;
    const bx = b.boundingBox?.left ?? Number.MAX_SAFE_INTEGER;
    return ax - bx;
  });
}

function finaliseResult(method: OcrResult['method'], source: string, startedAt: number, blocks: OcrTextBlock[]): OcrResult {
  const ordered = sortByGeometry(
    blocks
      .map((block) => ({
        text: normalizeText(block.text),
        confidence: Number.isFinite(block.confidence) ? Math.max(0, Math.min(1, block.confidence)) : 0.5,
        boundingBox: block.boundingBox,
      }))
      .filter((block) => block.text.length > 0),
  );

  const text = normalizeText(ordered.map((block) => block.text).join('\n'));
  if (!text) {
    throw new Error('No readable text detected. Capture a clearer image or provide a text-based document.');
  }

  return {
    text,
    blocks: ordered,
    method,
    metadata: {
      durationMs: Math.max(1, Date.now() - startedAt),
      source,
      blockCount: ordered.length,
    },
  };
}

export class BrowserLocalTextEngine {
  static async extractFromWebFile(file: File): Promise<OcrResult> {
    const startedAt = Date.now();
    const parsed = FileInputSchema.safeParse({
      name: file?.name,
      size: file?.size,
      type: file?.type,
    });

    if (!parsed.success) {
      throw new Error('Invalid upload input. A valid File object is required for web extraction.');
    }

    const mimeType = (parsed.data.type || '').toLowerCase();

    if (mimeType.startsWith('text/') || /json|xml|csv|markdown/.test(mimeType) || file.name.toLowerCase().endsWith('.txt')) {
      const rawText = await file.text();
      return finaliseResult('browser-native', 'file.text()', startedAt, [{ text: rawText, confidence: 0.99 }]);
    }

    // Browser-only local fallback:
    // We intentionally avoid cloud OCR/API calls here. For non-text binaries,
    // return a user-facing failure that keeps extraction fully offline.
    throw new Error('This web extractor currently supports clean text-based uploads only (e.g., .txt, .md, .csv).');
  }
}

interface DariydRecognizer {
  recognize: (imagePath: string) => Promise<string[]>;
}

interface MlKitLine {
  text?: string;
  frame?: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
  };
}

interface MlKitBlock {
  text?: string;
  confidence?: number;
  frame?: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
  };
  lines?: MlKitLine[];
}

interface MlKitRecognizeResponse {
  text?: string;
  blocks?: MlKitBlock[];
}

interface MlKitRecognizer {
  recognize: (imagePath: string) => Promise<MlKitRecognizeResponse>;
}

export class ReactNativeLocalTextEngine {
  static async extractFromImagePath(imagePath: string): Promise<OcrResult> {
    const startedAt = Date.now();
    const parsedPath = ImagePathSchema.safeParse(imagePath);
    if (!parsedPath.success) {
      throw new Error('Invalid mobile input. imagePath is required for local OCR extraction.');
    }

    const fromDariyd = await this.tryDariyd(parsedPath.data);
    if (fromDariyd) {
      return finaliseResult('react-native-native-ocr', '@dariyd/react-native-text-recognition', startedAt, fromDariyd);
    }

    const fromMlKit = await this.tryMlKit(parsedPath.data);
    if (fromMlKit) {
      return finaliseResult('react-native-native-ocr', 'react-native-ml-kit/text-recognition', startedAt, fromMlKit);
    }

    throw new Error('No local OCR native bridge was available. Install either @dariyd/react-native-text-recognition or react-native-ml-kit/text-recognition.');
  }

  private static async tryDariyd(imagePath: string): Promise<OcrTextBlock[] | null> {
    try {
      const moduleAny: { default: DariydRecognizer } = await import('@dariyd/react-native-text-recognition');
      const lines = await moduleAny.default.recognize(imagePath);
      if (!Array.isArray(lines)) return null;

      return lines
        .map((line: unknown): OcrTextBlock => ({ text: String(line ?? ''), confidence: 0.9 }))
        .filter((block) => normalizeText(block.text).length > 0);
    } catch (_error) {
      return null;
    }
  }

  private static async tryMlKit(imagePath: string): Promise<OcrTextBlock[] | null> {
    try {
      const moduleAny: { default: MlKitRecognizer } = await import('react-native-ml-kit/text-recognition');
      const result = await moduleAny.default.recognize(imagePath);
      const response: MlKitRecognizeResponse = result ?? {};
      const blocks = Array.isArray(response.blocks) ? response.blocks : [];

      const mapped: OcrTextBlock[] = [];
      for (const block of blocks) {
        const frame = block.frame;
        mapped.push({
          text: String(block.text ?? ''),
          confidence: Number.isFinite(block.confidence) ? Number(block.confidence) : 0.85,
          boundingBox: frame
            ? {
                left: Number(frame.left ?? 0),
                top: Number(frame.top ?? 0),
                width: Number(frame.width ?? 0),
                height: Number(frame.height ?? 0),
              }
            : undefined,
        });

        // Keep line-level fallback to preserve text when block text is empty.
        const lines = Array.isArray(block.lines) ? block.lines : [];
        for (const line of lines) {
          const lineFrame = line.frame;
          mapped.push({
            text: String(line.text ?? ''),
            confidence: Number.isFinite(block.confidence) ? Number(block.confidence) : 0.8,
            boundingBox: lineFrame
              ? {
                  left: Number(lineFrame.left ?? 0),
                  top: Number(lineFrame.top ?? 0),
                  width: Number(lineFrame.width ?? 0),
                  height: Number(lineFrame.height ?? 0),
                }
              : undefined,
          });
        }
      }

      return mapped.filter((block) => normalizeText(block.text).length > 0);
    } catch (_error) {
      return null;
    }
  }
}

export async function extractTextWeb(file: File): Promise<OcrResult> {
  return BrowserLocalTextEngine.extractFromWebFile(file);
}

export async function extractTextReactNative(imagePath: string): Promise<OcrResult> {
  return ReactNativeLocalTextEngine.extractFromImagePath(imagePath);
}
