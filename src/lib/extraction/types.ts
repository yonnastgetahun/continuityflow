import type { ExtractedFields, ParsedDocument } from '@/lib/pdfParser';
import type { Enums } from '@/integrations/supabase/types';

export type ExtractionMode = Enums<'extraction_mode'>;
export type ExtractionStatus = Enums<'extraction_status'>;
export type ExtractionProvider = Enums<'extraction_provider'>;
export type ExtractionConfidence = Enums<'extraction_confidence'>;
export type ReviewDecisionSource = Enums<'review_decision_source'>;

export interface ExtractionInput {
  invoiceFile: File;
  w9File?: File | null;
  enableEnhancedAccuracy: boolean;
  hasEnhancedAccess: boolean;
  userId: string;
  planType: 'pilot' | 'pro' | null;
}

export interface ExtractionCandidateRecord {
  fieldKey: string;
  source: ExtractionProvider;
  candidateValue: string | null;
  confidence: ExtractionConfidence;
  pageNumber: number | null;
  evidenceSnippet: string | null;
  selectedForReview: boolean;
  metadata?: Record<string, unknown>;
}

export interface ReviewDecisionRecord {
  fieldKey: string;
  localValue?: string | null;
  aiValue?: string | null;
  finalValue?: string | null;
  chosenSource: ReviewDecisionSource;
  userChanged: boolean;
  notes?: string | null;
}

export interface ExtractionUsageMetrics {
  aiDocs: number;
  aiPages: number;
  aiCostUsd: number;
}

export interface ExtractionResult {
  mode: ExtractionMode;
  status: ExtractionStatus;
  requestedProvider: ExtractionProvider;
  finalProvider: ExtractionProvider;
  aiProvider?: string | null;
  invoiceDoc: ParsedDocument;
  w9Doc?: ParsedDocument;
  extractedFields: ExtractedFields;
  candidates: ExtractionCandidateRecord[];
  isScanned: boolean;
  usedFallback: boolean;
  failureReason?: string | null;
  usage: ExtractionUsageMetrics;
  metadata?: Record<string, unknown>;
}

export interface Extractor {
  name: ExtractionProvider;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}
