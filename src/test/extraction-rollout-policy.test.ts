import { describe, expect, it } from 'vitest';
import {
  getAutomaticRoutingReason,
  shouldAttemptEnhancedAccuracy,
} from '@/lib/extraction/rolloutPolicy';
import type { ExtractionResult } from '@/lib/extraction/types';

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

describe('extraction rollout policy', () => {
  it('returns scanned_document for scanned results', () => {
    expect(getAutomaticRoutingReason({
      ...baseResult,
      isScanned: true,
    })).toBe('scanned_document');
  });

  it('returns low_confidence_required_fields when a required field is missing or weak', () => {
    expect(getAutomaticRoutingReason({
      ...baseResult,
      extractedFields: {
        ...baseResult.extractedFields,
        invoice: {
          ...baseResult.extractedFields.invoice,
          total: { value: '', confidence: 'low', evidence: { docType: 'invoice', pageNumber: 0, snippet: '' } },
        },
      },
    })).toBe('low_confidence_required_fields');
  });

  it('does not attempt enhanced accuracy when the rollout flag is disabled', () => {
    expect(shouldAttemptEnhancedAccuracy({
      featureEnabled: false,
      hasEnhancedAccess: true,
      manualRequest: true,
      automaticRoutingReason: null,
    })).toBe(false);
  });

  it('attempts enhanced accuracy for manual requests when feature and access are enabled', () => {
    expect(shouldAttemptEnhancedAccuracy({
      featureEnabled: true,
      hasEnhancedAccess: true,
      manualRequest: true,
      automaticRoutingReason: null,
    })).toBe(true);
  });

  it('attempts enhanced accuracy for automatic routing when feature and access are enabled', () => {
    expect(shouldAttemptEnhancedAccuracy({
      featureEnabled: true,
      hasEnhancedAccess: true,
      manualRequest: false,
      automaticRoutingReason: 'scanned_document',
    })).toBe(true);
  });
});
