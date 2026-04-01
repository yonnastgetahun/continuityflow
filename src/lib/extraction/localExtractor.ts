import {
  extractFieldsFromText,
  parsePDF,
  type ExtractedField,
  type ExtractedFields,
} from '@/lib/pdfParser';
import type {
  ExtractionCandidateRecord,
  ExtractionInput,
  ExtractionResult,
  Extractor,
} from '@/lib/extraction/types';

const FIELD_KEY_MAP = {
  vendor: {
    name: 'vendorName',
    address: 'vendorAddress',
    city: 'vendorCity',
    state: 'vendorState',
    zip: 'vendorZip',
    taxId: 'vendorTaxId',
    email: 'vendorEmail',
    phone: 'vendorPhone',
  },
  invoice: {
    invoiceNumber: 'invoiceNumber',
    invoiceDate: 'invoiceDate',
    dueDate: 'dueDate',
    subtotal: 'subtotal',
    tax: 'tax',
    total: 'total',
  },
} as const;

type ExtractionFieldKey =
  | keyof typeof FIELD_KEY_MAP.vendor
  | keyof typeof FIELD_KEY_MAP.invoice;

function toCandidate(
  fieldKey: string,
  field: ExtractedField,
  source: ExtractionCandidateRecord['source'],
  selectedForReview = true
): ExtractionCandidateRecord {
  return {
    fieldKey,
    source,
    candidateValue: field.value || null,
    confidence: field.confidence,
    pageNumber: field.evidence.pageNumber || null,
    evidenceSnippet: field.evidence.snippet || null,
    selectedForReview,
    metadata: {
      docType: field.evidence.docType,
    },
  };
}

export function flattenExtractedFields(extractedFields: ExtractedFields): Record<string, ExtractedField> {
  const flattened: Record<string, ExtractedField> = {};

  (Object.entries(extractedFields.vendor) as Array<[keyof typeof FIELD_KEY_MAP.vendor, ExtractedField]>).forEach(
    ([key, field]) => {
      flattened[FIELD_KEY_MAP.vendor[key]] = field;
    }
  );

  (Object.entries(extractedFields.invoice) as Array<[keyof typeof FIELD_KEY_MAP.invoice, ExtractedField]>).forEach(
    ([key, field]) => {
      flattened[FIELD_KEY_MAP.invoice[key]] = field;
    }
  );

  return flattened;
}

export function buildCandidatesForSource(
  extractedFields: ExtractedFields,
  source: ExtractionCandidateRecord['source']
): ExtractionCandidateRecord[] {
  const candidates: ExtractionCandidateRecord[] = [];
  const flattened = flattenExtractedFields(extractedFields);

  (Object.entries(flattened) as Array<[ExtractionFieldKey | string, ExtractedField]>).forEach(([fieldKey, field]) => {
    candidates.push(toCandidate(fieldKey, field, source));
  });

  return candidates;
}

export const localExtractor: Extractor = {
  name: 'local',
  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const invoiceDoc = await parsePDF(input.invoiceFile, 'invoice');
    const w9Doc = input.w9File ? await parsePDF(input.w9File, 'w9') : undefined;
    const extractedFields = extractFieldsFromText(invoiceDoc, w9Doc);
    const candidates = buildCandidatesForSource(extractedFields, 'local');

    return {
      mode: 'local_only',
      status: 'completed',
      requestedProvider: 'local',
      finalProvider: 'local',
      aiProvider: null,
      invoiceDoc,
      w9Doc,
      extractedFields,
      candidates,
      isScanned: invoiceDoc.isScanned || Boolean(w9Doc?.isScanned),
      usedFallback: false,
      usage: {
        aiDocs: 0,
        aiPages: 0,
        aiCostUsd: 0,
      },
      metadata: {
        sourceDocumentType: 'invoice',
        candidateCounts: candidates.reduce<Record<string, number>>((acc, candidate) => {
          acc[candidate.fieldKey] = (acc[candidate.fieldKey] || 0) + 1;
          return acc;
        }, {}),
      },
    };
  },
};
