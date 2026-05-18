import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { AcademicBrain, SUBJECTS, type Subject, type TrainingSample } from './AcademicBrain';

const SubjectSchema = z.enum(SUBJECTS);

const HistoricalEntrySchema = z.object({
  rawText: z.string().min(1),
  subject: SubjectSchema,
  topic: z.string().min(1),
  actualMinutes: z.number().min(5).max(240),
  verifiedByTutor: z.boolean().default(true),
  createdAtMs: z.number().nonnegative(),
});

const TrainingSampleSchema = z.object({
  text: z.string().min(1),
  subject: SubjectSchema,
  topic: z.string().min(1),
  actualMinutes: z.number().min(5).max(240),
});

const GeminiStructuredSampleSchema = z.object({
  text: z.string().min(1),
  subject: SubjectSchema,
  topic: z.string().min(1),
  actualMinutes: z.number().min(5).max(240),
});

const GeminiResponseSchema = z.object({
  samples: z.array(GeminiStructuredSampleSchema),
});

export interface ClassSessionEntry {
  rawText: string;
  subject: Subject;
  topic: string;
  actualMinutes: number;
  verifiedByTutor: boolean;
  createdAtMs: number;
}

export interface ClassSessionRepository {
  fetchSince: (sinceEpochMs: number) => Promise<ClassSessionEntry[]>;
}

export interface GeminiEnrichmentClient {
  enrich: (entries: ClassSessionEntry[]) => Promise<TrainingSample[]>;
}

export interface TrainingPipelineOptions {
  brain?: AcademicBrain;
  repository?: ClassSessionRepository;
  geminiClient?: GeminiEnrichmentClient;
  geminiApiKey?: string;
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export interface RunTrainingOptions {
  lookbackDays?: number;
  trigger?: 'manual' | 'scheduled';
}

export interface RunTrainingResult {
  trained: boolean;
  trigger: 'manual' | 'scheduled';
  databaseCount: number;
  syntheticCount: number;
  finalSampleCount: number;
  persistedModel: boolean;
}

function buildGeminiPrompt(entries: ClassSessionEntry[]): string {
  const payload = entries.slice(0, 200).map((entry) => ({
    rawText: entry.rawText,
    subject: entry.subject,
    topic: entry.topic,
    actualMinutes: entry.actualMinutes,
  }));

  return [
    'You are enriching OCR-derived tutoring data for supervised machine learning.',
    'Return strict JSON only in the form: {"samples":[{"text":"...","subject":"Mathematics|Physics|Chemistry|Biology","topic":"...","actualMinutes":number}]}.',
    'Rules:',
    '- Keep each sample realistic and curriculum-relevant.',
    '- Preserve subject taxonomy exactly.',
    '- Infer quality labels from OCR fragments when text is noisy.',
    '- actualMinutes must be in range 5..240.',
    'Input historical entries:',
    JSON.stringify(payload),
  ].join('\n');
}

class GoogleGeminiEnrichmentClient implements GeminiEnrichmentClient {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async enrich(entries: ClassSessionEntry[]): Promise<TrainingSample[]> {
    if (!entries.length) return [];

    const prompt = buildGeminiPrompt(entries);
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = String(response.text ?? '').trim();
    if (!text) return [];

    const parsed = GeminiResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return [];

    return parsed.data.samples.map((sample) => ({
      text: sample.text,
      subject: sample.subject,
      topic: sample.topic,
      actualMinutes: sample.actualMinutes,
    }));
  }
}

export class TrainingPipeline {
  private readonly brain: AcademicBrain;
  private readonly repository: ClassSessionRepository | null;
  private readonly geminiClient: GeminiEnrichmentClient | null;
  private readonly logger: Pick<Console, 'info' | 'warn' | 'error'>;

  constructor(options: TrainingPipelineOptions = {}) {
    this.brain = options.brain ?? new AcademicBrain();
    this.repository = options.repository ?? null;
    this.logger = options.logger ?? console;

    if (options.geminiClient) {
      this.geminiClient = options.geminiClient;
    } else if (options.geminiApiKey) {
      this.geminiClient = new GoogleGeminiEnrichmentClient(options.geminiApiKey);
    } else {
      this.geminiClient = null;
    }
  }

  async init(): Promise<void> {
    await this.brain.init();
  }

  async runWeeklyTrainingCycle(options: RunTrainingOptions = {}): Promise<RunTrainingResult> {
    const lookbackDays = Math.max(1, Number(options.lookbackDays ?? 7));
    const trigger = options.trigger ?? 'scheduled';

    const databaseSamples = await this.fetchDatabaseHistorySamples(lookbackDays);
    const syntheticSamples = await this.generateGeminiSyntheticSamples(databaseSamples);

    const mergedSamples = [...databaseSamples, ...syntheticSamples];
    const validated = mergedSamples
      .map((sample) => TrainingSampleSchema.safeParse(sample))
      .filter((result): result is { success: true; data: z.infer<typeof TrainingSampleSchema> } => result.success)
      .map((result) => result.data);

    if (!validated.length) {
      return {
        trained: false,
        trigger,
        databaseCount: databaseSamples.length,
        syntheticCount: syntheticSamples.length,
        finalSampleCount: 0,
        persistedModel: false,
      };
    }

    const retrainResult = await this.brain.retrain(validated);

    this.logger.info('academic_brain_retraining_completed', {
      trigger,
      lookbackDays,
      databaseCount: databaseSamples.length,
      syntheticCount: syntheticSamples.length,
      finalSampleCount: validated.length,
      persistedModel: retrainResult.persistedModel,
    });

    return {
      trained: retrainResult.trained,
      trigger,
      databaseCount: databaseSamples.length,
      syntheticCount: syntheticSamples.length,
      finalSampleCount: retrainResult.sampleCount,
      persistedModel: retrainResult.persistedModel,
    };
  }

  private async fetchDatabaseHistorySamples(lookbackDays: number): Promise<TrainingSample[]> {
    if (!this.repository) return [];

    const sinceEpochMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const entries = await this.repository.fetchSince(sinceEpochMs);

    return entries
      .map((entry) => HistoricalEntrySchema.safeParse(entry))
      .filter((result): result is { success: true; data: z.infer<typeof HistoricalEntrySchema> } => result.success)
      .map((result) => result.data)
      .filter((entry) => entry.verifiedByTutor)
      .map((entry) => ({
        text: entry.rawText,
        subject: entry.subject,
        topic: entry.topic,
        actualMinutes: entry.actualMinutes,
      }));
  }

  private async generateGeminiSyntheticSamples(sourceEntries: TrainingSample[]): Promise<TrainingSample[]> {
    if (!this.geminiClient || sourceEntries.length === 0) return [];

    try {
      const entries: ClassSessionEntry[] = sourceEntries.map((entry) => ({
        rawText: entry.text,
        subject: entry.subject,
        topic: entry.topic,
        actualMinutes: entry.actualMinutes,
        verifiedByTutor: true,
        createdAtMs: Date.now(),
      }));

      return await this.geminiClient.enrich(entries);
    } catch (error) {
      this.logger.warn('gemini_synthetic_enrichment_failed', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return [];
    }
  }

  startWeeklySchedule(intervalMs = 7 * 24 * 60 * 60 * 1000): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        await this.runWeeklyTrainingCycle({ lookbackDays: 7, trigger: 'scheduled' });
      } catch (error) {
        this.logger.error('academic_brain_weekly_schedule_failed', {
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }, Math.max(60_000, intervalMs));
  }
}
