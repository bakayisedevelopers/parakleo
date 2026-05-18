import fs from 'node:fs';
import path from 'node:path';
import natural from 'natural';
import { z } from 'zod';

let tf: typeof import('@tensorflow/tfjs-node');
try {
  tf = require('@tensorflow/tfjs-node') as typeof import('@tensorflow/tfjs-node');
} catch (_error) {
  tf = require('@tensorflow/tfjs') as typeof import('@tensorflow/tfjs-node');
}

export const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology'] as const;
export type Subject = (typeof SUBJECTS)[number];

export interface TrainingSample {
  text: string;
  subject: Subject;
  topic: string;
  actualMinutes: number;
}

export interface ClassificationOutput {
  subject: Subject;
  topic: string;
  topics: string[];
  estimatedMinutes: number;
  confidence: number;
  normalizedText: string;
  features: number[];
}

export interface AcademicBrainOptions {
  modelDir?: string;
}

const SubjectEnum = z.enum(SUBJECTS);
const TrainingSampleSchema = z.object({
  text: z.string().min(1),
  subject: SubjectEnum,
  topic: z.string().min(1),
  actualMinutes: z.number().min(5).max(240),
});

const DEFAULT_CORPUS: Record<Subject, string[]> = {
  Mathematics: [
    'algebra equations inequality calculus derivative integral theorem trigonometry geometry statistics probability matrix vector',
    'solve simplify factor polynomial graph function limit sequence ratio',
  ],
  Physics: [
    'mechanics force motion acceleration velocity momentum work energy power newton dynamics kinematics',
    'electricity circuits voltage current resistance magnetism optics waves frequency thermodynamics',
  ],
  Chemistry: [
    'atoms molecules ionic covalent bonding periodic table stoichiometry moles reactions equilibrium',
    'acids bases ph redox kinetics electrochemistry organic inorganic compounds',
  ],
  Biology: [
    'cell respiration photosynthesis dna rna genetics mitosis meiosis evolution ecology',
    'anatomy physiology enzymes homeostasis inheritance transcription translation',
  ],
};

const DEFAULT_TOPICS: Record<Subject, string[]> = {
  Mathematics: ['algebra', 'calculus', 'trigonometry', 'geometry', 'statistics', 'probability'],
  Physics: ['mechanics', 'electricity', 'magnetism', 'waves', 'optics', 'thermodynamics'],
  Chemistry: ['stoichiometry', 'organic', 'inorganic', 'equilibrium', 'kinetics', 'electrochemistry'],
  Biology: ['genetics', 'ecology', 'cells', 'evolution', 'physiology', 'anatomy'],
};

const OCR_TYPO_MAP: Record<string, string> = {
  l: '1',
  I: '1',
  O: '0',
  o: '0',
  S: '5',
  B: '8',
};

function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function nearestToken(token: string, candidates: string[]): { value: string; distance: number } {
  let winner = token;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = natural.LevenshteinDistance(token, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      winner = candidate;
    }
  }

  return { value: winner, distance: bestDistance };
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export class AcademicBrain {
  private readonly modelDir: string;
  private readonly modelPath: string;
  private tfidf: natural.TfIdf;
  private durationModel: tf.LayersModel | null;
  private corpus: Record<Subject, string[]>;
  private topicVocabulary: Record<Subject, string[]>;
  private subjectTokenVocabulary: Map<Subject, string[]>;

  constructor(options: AcademicBrainOptions = {}) {
    this.modelDir = options.modelDir ?? path.join(process.cwd(), 'backend', 'src', 'ai', 'models', 'academic-brain');
    this.modelPath = `file://${path.join(this.modelDir, 'model.json')}`;
    this.tfidf = new natural.TfIdf();
    this.durationModel = null;
    this.corpus = DEFAULT_CORPUS;
    this.topicVocabulary = DEFAULT_TOPICS;
    this.subjectTokenVocabulary = new Map<Subject, string[]>();
  }

  async init(): Promise<void> {
    fs.mkdirSync(this.modelDir, { recursive: true });

    const storedCorpus = safeReadJson<Record<Subject, string[]>>(path.join(this.modelDir, 'corpus.json'));
    const storedTopics = safeReadJson<Record<Subject, string[]>>(path.join(this.modelDir, 'topics.json'));

    if (storedCorpus) this.corpus = storedCorpus;
    if (storedTopics) this.topicVocabulary = storedTopics;

    this.rebuildTfIdfCorpus();
    this.rebuildSubjectTokenVocabulary();
    await this.loadOrCreateDurationModel();
  }

  normalizeText(rawText: string): string {
    const compact = normalizeWhitespace(rawText)
      .replace(/[|`~^]+/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[-–—]/g, '-');

    // First pass: OCR typo repair for isolated ambiguous characters near numbers.
    const typoFixed = compact.replace(/[lIoOSB](?=\d)|(?<=\d)[lIoOSB]/g, (match) => OCR_TYPO_MAP[match] ?? match);

    const tokens = tokenize(typoFixed);
    const canonicalVocabulary = [
      ...SUBJECTS.map((s) => s.toLowerCase()),
      ...Object.values(this.topicVocabulary).flat(),
      'equation', 'integral', 'derivative', 'coefficient', 'stoichiometry', 'mechanics', 'genetics',
    ];

    // Second pass: Levenshtein token snapping to reduce OCR drift such as "inteqral" -> "integral".
    const corrected = tokens.map((token) => {
      if (token.length <= 2) return token;
      const nearest = nearestToken(token, canonicalVocabulary);
      return nearest.distance <= 1 ? nearest.value : token;
    });

    return corrected.join(' ');
  }

  classifySubjectAndTopics(rawText: string): {
    subject: Subject;
    topics: string[];
    topic: string;
    confidence: number;
    normalizedText: string;
  } {
    const normalizedText = this.normalizeText(rawText);
    const queryTfIdf = new natural.TfIdf();
    queryTfIdf.addDocument(normalizedText);

    // TF-IDF matching strategy:
    // - each subject stores a token vocabulary built from its corpus documents
    // - query score is the sum of token TF-IDF weights projected onto that subject token set
    // - the highest score becomes the predicted subject
    const scores = SUBJECTS.map((subject) => {
      const tokens = this.subjectTokenVocabulary.get(subject) ?? [];
      const score = tokens.reduce((sum, token) => sum + queryTfIdf.tfidf(token, 0), 0);
      return { subject, score };
    }).sort((a, b) => b.score - a.score);

    const winner = scores[0] ?? { subject: 'Mathematics' as Subject, score: 0 };

    const topics = (this.topicVocabulary[winner.subject] ?? [])
      .map((topic) => ({ topic, score: queryTfIdf.tfidf(topic, 0) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((row) => row.topic);

    return {
      subject: winner.subject,
      topics,
      topic: topics[0] ?? 'general',
      confidence: Number(winner.score.toFixed(6)),
      normalizedText,
    };
  }

  extractDurationFeatures(rawText: string): number[] {
    const text = this.normalizeText(rawText);
    const words = tokenize(text);

    // Tensor feature vector shape: [wordCount, mathSymbolCount, denseMathTokenCount, questionCount, numericTokenCount, sentenceCount]
    const wordCount = words.length;
    const mathSymbolCount = (text.match(/[=+\-*/^v?Sp]/g) ?? []).length;
    const denseMathTokenCount = words.filter((w) => ['equation', 'integral', 'derivative', 'matrix', 'vector', 'graph', 'limit'].includes(w)).length;
    const questionCount = (text.match(/\?/g) ?? []).length;
    const numericTokenCount = words.filter((w) => /^\d+(\.\d+)?$/.test(w)).length;
    const sentenceCount = Math.max(1, (text.match(/[.!?]/g) ?? []).length);

    return [wordCount, mathSymbolCount, denseMathTokenCount, questionCount, numericTokenCount, sentenceCount];
  }

  async estimateMinutes(rawText: string): Promise<number> {
    if (!this.durationModel) throw new Error('AcademicBrain is not initialized.');

    const features = this.extractDurationFeatures(rawText);
    const x = tf.tensor2d([features], [1, features.length], 'float32');

    try {
      const predictionTensor = this.durationModel.predict(x) as tf.Tensor;
      const values = await predictionTensor.data();
      predictionTensor.dispose();
      return Math.round(Math.max(10, Math.min(180, Number(values[0] ?? 30))));
    } finally {
      x.dispose();
    }
  }

  async classify(rawText: string): Promise<ClassificationOutput> {
    const base = this.classifySubjectAndTopics(rawText);
    const features = this.extractDurationFeatures(base.normalizedText);
    const estimatedMinutes = await this.estimateMinutes(base.normalizedText);

    return {
      subject: base.subject,
      topic: base.topic,
      topics: base.topics,
      confidence: base.confidence,
      estimatedMinutes,
      normalizedText: base.normalizedText,
      features,
    };
  }

  async retrain(samples: TrainingSample[]): Promise<{ trained: boolean; sampleCount: number; persistedModel: boolean }> {
    if (!this.durationModel) throw new Error('AcademicBrain is not initialized.');

    const validated = z.array(TrainingSampleSchema).parse(samples);
    if (validated.length === 0) {
      return { trained: false, sampleCount: 0, persistedModel: false };
    }

    for (const sample of validated) {
      this.corpus[sample.subject] = [...(this.corpus[sample.subject] ?? []), sample.text].slice(-300);
      const topic = sample.topic.toLowerCase().trim();
      if (topic && !(this.topicVocabulary[sample.subject] ?? []).includes(topic)) {
        this.topicVocabulary[sample.subject].push(topic);
      }
    }

    this.rebuildTfIdfCorpus();
    this.rebuildSubjectTokenVocabulary();

    const xRows = validated.map((sample) => this.extractDurationFeatures(sample.text));
    const yRows = validated.map((sample) => [sample.actualMinutes]);

    const x = tf.tensor2d(xRows, [xRows.length, xRows[0]?.length ?? 6], 'float32');
    const y = tf.tensor2d(yRows, [yRows.length, 1], 'float32');

    try {
      await this.durationModel.fit(x, y, {
        epochs: 100,
        batchSize: Math.max(1, Math.min(24, validated.length)),
        shuffle: true,
        verbose: 0,
      });
    } finally {
      x.dispose();
      y.dispose();
    }

    fs.mkdirSync(this.modelDir, { recursive: true });
    fs.writeFileSync(path.join(this.modelDir, 'corpus.json'), JSON.stringify(this.corpus, null, 2), 'utf8');
    fs.writeFileSync(path.join(this.modelDir, 'topics.json'), JSON.stringify(this.topicVocabulary, null, 2), 'utf8');

    let persistedModel = false;
    const saveHandlers = tf.io.getSaveHandlers(this.modelPath);
    if (Array.isArray(saveHandlers) && saveHandlers.length > 0) {
      await this.durationModel.save(this.modelPath);
      persistedModel = true;
    }

    return { trained: true, sampleCount: validated.length, persistedModel };
  }

  private rebuildTfIdfCorpus(): void {
    this.tfidf = new natural.TfIdf();
    for (const subject of SUBJECTS) {
      const docs = this.corpus[subject] ?? [];
      for (const doc of docs) this.tfidf.addDocument(this.normalizeText(doc));
    }
  }

  private rebuildSubjectTokenVocabulary(): void {
    this.subjectTokenVocabulary = new Map<Subject, string[]>();

    for (const subject of SUBJECTS) {
      const tokenSets = (this.corpus[subject] ?? []).map((doc) => tokenize(this.normalizeText(doc)));
      const flattened = tokenSets.flat();
      this.subjectTokenVocabulary.set(subject, [...new Set(flattened)]);
    }
  }

  private async loadOrCreateDurationModel(): Promise<void> {
    const modelJsonPath = path.join(this.modelDir, 'model.json');
    const hasLoadHandler = Array.isArray(tf.io.getLoadHandlers(this.modelPath)) && tf.io.getLoadHandlers(this.modelPath).length > 0;

    if (fs.existsSync(modelJsonPath) && hasLoadHandler) {
      this.durationModel = await tf.loadLayersModel(this.modelPath);
      this.durationModel.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError', metrics: ['mae'] });
      return;
    }

    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [6], units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError', metrics: ['mae'] });
    this.durationModel = model;
  }
}
