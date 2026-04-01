import { describe, expect, it, vi, beforeEach } from 'vitest';
import { extractDocuments, ENHANCED_ACCURACY_FALLBACK_REASON } from '@/lib/extraction/router';
import { runEnhancedExtraction } from '@/lib/extraction/enhancedExtractor';
import { localExtractor } from '@/lib/extraction/localExtractor';
import type { ExtractionInput, ExtractionResult } from '@/lib/extraction/types';

vi.mock('@/lib/extraction/localExtractor', () => ({
  localExtractor: {
    extract: vi.fn(),
  },
}));

vi.mock('@/lib/extraction/enhancedExtractor', () => ({
  runEnhancedExtraction: vi.fn(),
}));

const baseResult: ExtractionResult = {
  mode: 'local_only',
  status: 'completed',
  requestedProvider: 'local',
  finalProvider: 'local',
  aiProvider: null,
  invoiceDoc: {
    docType: 'invoice',
    fullText: 'Invoice 1001',
    pages: [],
    isScanned: false,
    fileName: 'invoice.pdf',
  },
  extractedFields: {
    vendor: {
      name: { value: 'Vendor', confidence: 'high', evidence: { docType: 'invoice', pageNumber: 1, snippet: 'Vendor' } },
      address: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      city: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      state: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      zip: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      taxId: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      email: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      phone: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
    },
    invoice: {
      invoiceNumber: { value: '1001', confidence: 'high', evidence: { docType: 'invoice', pageNumber: 1, snippet: '1001' } },
      invoiceDate: { value: '2026-03-30', confidence: 'high', evidence: { docType: 'invoice', pageNumber: 1, snippet: '2026-03-30' } },
      dueDate: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      subtotal: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      tax: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
      total: { value: '150.00', confidence: 'high', evidence: { docType: 'invoice', pageNumber: 1, snippet: '$150.00' } },
    },
  },
  candidates: [],
  isScanned: false,
  usedFallback: false,
  usage: {
    aiDocs: 0,
    aiPages: 0,
    aiCostUsd: 0,
  },
  metadata: {},
};

const baseInput: ExtractionInput = {
  invoiceFile: new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' }),
  w9File: null,
  enableEnhancedAccuracy: false,
  hasEnhancedAccess: false,
  userId: 'user-1',
  planType: null,
};

describe('extractDocuments', () => {
  beforeEach(() => {
    vi.mocked(localExtractor.extract).mockResolvedValue(baseResult);
    vi.mocked(runEnhancedExtraction).mockReset();
  });

  it('returns local extraction when enhanced accuracy is disabled', async () => {
    const result = await extractDocuments(baseInput);

    expect(result.mode).toBe('local_only');
    expect(result.finalProvider).toBe('local');
    expect(result.usedFallback).toBe(false);
    expect(runEnhancedExtraction).not.toHaveBeenCalled();
  });

  it('auto-routes scanned documents to enhanced extraction when access is available', async () => {
    vi.mocked(localExtractor.extract).mockResolvedValue({
      ...baseResult,
      isScanned: true,
      invoiceDoc: {
        ...baseResult.invoiceDoc,
        isScanned: true,
      },
    });

    vi.mocked(runEnhancedExtraction).mockResolvedValue({
      ...baseResult,
      mode: 'enhanced_accuracy',
      requestedProvider: 'ai',
      finalProvider: 'ai',
      aiProvider: 'openai',
      isScanned: true,
    });

    const result = await extractDocuments({
      ...baseInput,
      hasEnhancedAccess: true,
      planType: 'pro',
    });

    expect(runEnhancedExtraction).toHaveBeenCalledOnce();
    expect(result.finalProvider).toBe('ai');
  });

  it('auto-routes low-confidence required fields to enhanced extraction when access is available', async () => {
    vi.mocked(localExtractor.extract).mockResolvedValue({
      ...baseResult,
      extractedFields: {
        ...baseResult.extractedFields,
        invoice: {
          ...baseResult.extractedFields.invoice,
          total: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
        },
      },
    });

    vi.mocked(runEnhancedExtraction).mockResolvedValue({
      ...baseResult,
      mode: 'enhanced_accuracy',
      requestedProvider: 'ai',
      finalProvider: 'ai',
      aiProvider: 'openai',
    });

    const result = await extractDocuments({
      ...baseInput,
      hasEnhancedAccess: true,
      planType: 'pro',
    });

    expect(runEnhancedExtraction).toHaveBeenCalledOnce();
    expect(result.finalProvider).toBe('ai');
  });

  it('stays local when auto-routing conditions are met but enhanced access is unavailable', async () => {
    vi.mocked(localExtractor.extract).mockResolvedValue({
      ...baseResult,
      isScanned: true,
      invoiceDoc: {
        ...baseResult.invoiceDoc,
        isScanned: true,
      },
    });

    const result = await extractDocuments({
      ...baseInput,
      enableEnhancedAccuracy: false,
      hasEnhancedAccess: false,
      planType: null,
    });

    expect(runEnhancedExtraction).not.toHaveBeenCalled();
    expect(result.finalProvider).toBe('local');
  });

  it('returns fallback metadata when enhanced accuracy is requested and allowed', async () => {
    vi.mocked(runEnhancedExtraction).mockRejectedValue(new Error(ENHANCED_ACCURACY_FALLBACK_REASON));

    const result = await extractDocuments({
      ...baseInput,
      enableEnhancedAccuracy: true,
      hasEnhancedAccess: true,
      planType: 'pro',
    });

    expect(result.mode).toBe('enhanced_accuracy');
    expect(result.requestedProvider).toBe('ai');
    expect(result.finalProvider).toBe('fallback_local');
    expect(result.usedFallback).toBe(true);
    expect(result.failureReason).toBe(ENHANCED_ACCURACY_FALLBACK_REASON);
  });

  it('returns ai result when enhanced extraction succeeds', async () => {
    vi.mocked(runEnhancedExtraction).mockResolvedValue({
      ...baseResult,
      mode: 'enhanced_accuracy',
      requestedProvider: 'ai',
      finalProvider: 'ai',
      aiProvider: 'openai',
    });

    const result = await extractDocuments({
      ...baseInput,
      enableEnhancedAccuracy: true,
      hasEnhancedAccess: true,
      planType: 'pro',
    });

    expect(result.finalProvider).toBe('ai');
    expect(result.aiProvider).toBe('openai');
    expect(result.usedFallback).toBe(false);
  });
});
