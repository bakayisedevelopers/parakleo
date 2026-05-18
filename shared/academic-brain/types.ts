export interface SubjectPack {
  subjectId: string;
  displayName: string;
  aliases: string[];
  countriesSupported: string[];
  languagesSupported: string[];
  keywords: string[];
  topicKeywords: Record<string, string[]>;
  commandWords: string[];
  numberingPatterns: string[];
  marksPatterns: string[];
  layoutPatterns: string[];
  confidenceThresholds: {
    subject: number;
    topic: number;
    questionBoundary: number;
  };
  estimatedDifficultyWeights: Record<string, number>;
  estimatedMinuteRules: {
    baseMinutes: number;
    perQuestionMinutes: number;
    perSubQuestionMinutes: number;
    readingPassageBonus: number;
    maxMinutes: number;
    minMinutes: number;
  };
  parserHints: Record<string, boolean>;
  enabled: boolean;
  version: string;
}

export interface AcademicBrainQuestion {
  id: string;
  number: string | null;
  text: string;
  type: 'question' | 'instruction' | 'reading_passage' | 'unstructured_block';
  marks: number | null;
  confidence: number;
  source: { page: number | null; blockIndex: number | null };
  children: AcademicBrainQuestion[];
}

export interface AcademicBrainOutput {
  subject: {
    subjectId: string;
    displayName: string;
    confidence: number;
    matchedSignals: string[];
  };
  topics: Array<{
    topicId: string;
    label: string;
    confidence: number;
    matchedKeywords: string[];
  }>;
  estimatedMinutes: number;
  questions: AcademicBrainQuestion[];
  warnings: string[];
  needsReview: boolean;
  engine: {
    name: 'academic-brain';
    version: string;
    subjectPackVersions: Array<{ subjectId: string; version: string }>;
  };
}
