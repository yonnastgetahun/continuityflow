import { supabase } from '@/integrations/supabase/client';
import {
  buildCandidatesForSource,
  flattenExtractedFields,
} from '@/lib/extraction/localExtractor';
import type {
  ExtractionInput,
  ExtractionResult,
} from '@/lib/extraction/types';
import type { ExtractedField, ExtractedFields } from '@/lib/pdfParser';

interface EnhancedExtractionResponse {
  extractedFields: ExtractedFields;
  aiProvider: string;
  usage: {
    aiDocs: number;
    aiPages: number;
    aiCostUsd: number;
  };
  metadata?: Record<string, unknown>;
}

function mergeExtractedFields(
  localFields: ExtractedFields,
  aiFields: ExtractedFields
): ExtractedFields {
  const merged = structuredClone(localFields);
  const localFlat = flattenExtractedFields(localFields);
  const aiFlat = flattenExtractedFields(aiFields);

  const applyMergedField = (target: ExtractedField, fieldKey: string) => {
    const localField = localFlat[fieldKey];
    const aiField = aiFlat[fieldKey];

    if (aiField?.value) {
      target.value = aiField.value;
      target.confidence = aiField.confidence;
      target.evidence = aiField.evidence;
      return;
    }

    if (localField) {
      target.value = localField.value;
      target.confidence = localField.confidence;
      target.evidence = localField.evidence;
    }
  };

  applyMergedField(merged.vendor.name, 'vendorName');
  applyMergedField(merged.vendor.address, 'vendorAddress');
  applyMergedField(merged.vendor.city, 'vendorCity');
  applyMergedField(merged.vendor.state, 'vendorState');
  applyMergedField(merged.vendor.zip, 'vendorZip');
  applyMergedField(merged.vendor.taxId, 'vendorTaxId');
  applyMergedField(merged.vendor.email, 'vendorEmail');
  applyMergedField(merged.vendor.phone, 'vendorPhone');
  applyMergedField(merged.invoice.invoiceNumber, 'invoiceNumber');
  applyMergedField(merged.invoice.invoiceDate, 'invoiceDate');
  applyMergedField(merged.invoice.dueDate, 'dueDate');
  applyMergedField(merged.invoice.subtotal, 'subtotal');
  applyMergedField(merged.invoice.tax, 'tax');
  applyMergedField(merged.invoice.total, 'total');

  return merged;
}

export async function runEnhancedExtraction(
  input: ExtractionInput,
  localResult: ExtractionResult
): Promise<ExtractionResult> {
  const requestBody = {
    invoiceDoc: {
      fullText: localResult.invoiceDoc.fullText,
      fileName: localResult.invoiceDoc.fileName,
      isScanned: localResult.invoiceDoc.isScanned,
      pageCount: localResult.invoiceDoc.pages.length,
    },
    w9Doc: localResult.w9Doc
      ? {
          fullText: localResult.w9Doc.fullText,
          fileName: localResult.w9Doc.fileName,
          isScanned: localResult.w9Doc.isScanned,
          pageCount: localResult.w9Doc.pages.length,
        }
      : null,
    localExtractedFields: localResult.extractedFields,
    requestedProvider: 'ai',
    requestedMode: 'enhanced_accuracy',
    metadata: {
      enableEnhancedAccuracy: input.enableEnhancedAccuracy,
      source: 'continuity-web',
    },
  };

  const { data, error } = await supabase.functions.invoke<EnhancedExtractionResponse>('enhanced-extract', {
    body: requestBody,
  });

  if (error) {
    throw new Error(error.message || 'Enhanced extraction failed');
  }

  if (!data?.extractedFields) {
    throw new Error('Enhanced extraction returned no structured fields');
  }

  const mergedFields = mergeExtractedFields(localResult.extractedFields, data.extractedFields);

  return {
    ...localResult,
    mode: 'enhanced_accuracy',
    requestedProvider: 'ai',
    finalProvider: 'ai',
    aiProvider: data.aiProvider,
    extractedFields: mergedFields,
    candidates: [
      ...buildCandidatesForSource(localResult.extractedFields, 'local'),
      ...buildCandidatesForSource(data.extractedFields, 'ai'),
    ],
    usedFallback: false,
    failureReason: null,
    usage: data.usage,
    metadata: {
      ...localResult.metadata,
      ...data.metadata,
      enhancedAccuracyRequested: true,
    },
  };
}
