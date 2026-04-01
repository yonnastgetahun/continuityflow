import type { AutomaticRoutingReason } from '@/lib/extraction/rolloutPolicy';

export type ReviewRoutingReason = AutomaticRoutingReason | 'manual_request' | null;

interface UploadExtractionCopyInput {
  featureEnabled: boolean;
  hasEnhancedAccess: boolean;
  forcedEnhancedAccuracy: boolean;
}

export function getUploadExtractionModeSummary({
  featureEnabled,
  hasEnhancedAccess,
  forcedEnhancedAccuracy,
}: UploadExtractionCopyInput): string {
  if (!featureEnabled || !hasEnhancedAccess) {
    return 'Continuity will use local processing only for this extraction.';
  }

  if (forcedEnhancedAccuracy) {
    return 'Continuity starts locally and will force enhanced extraction immediately for this document.';
  }

  return 'Continuity starts locally and may automatically use enhanced extraction for scanned or low-confidence documents.';
}

export function getUploadExtractionStatusMessage({
  featureEnabled,
  hasEnhancedAccess,
  forcedEnhancedAccuracy,
}: UploadExtractionCopyInput): string {
  if (!featureEnabled || !hasEnhancedAccess) {
    return 'Parsing locally. Enhanced extraction is unavailable, so Continuity will use local processing only.';
  }

  if (forcedEnhancedAccuracy) {
    return 'Parsing locally and requesting enhanced extraction.';
  }

  return 'Parsing locally. If the document is scanned or low-confidence, Continuity may automatically use enhanced extraction.';
}

export function getReviewRoutingReasonLabel(reason: ReviewRoutingReason): string | null {
  switch (reason) {
    case 'scanned_document':
      return 'Scanned PDF detected';
    case 'low_confidence_required_fields':
      return 'Required fields were missing or low-confidence';
    case 'manual_request':
      return 'You forced enhanced extraction before review';
    default:
      return null;
  }
}
