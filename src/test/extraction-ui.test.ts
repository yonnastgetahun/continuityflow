import { describe, expect, it } from 'vitest';
import {
  getReviewRoutingReasonLabel,
  getUploadExtractionModeSummary,
  getUploadExtractionStatusMessage,
} from '@/lib/extraction/ui';

describe('extraction UI copy', () => {
  it('describes local-first automatic routing when enhanced extraction is not forced', () => {
    expect(
      getUploadExtractionModeSummary({
        featureEnabled: true,
        hasEnhancedAccess: true,
        forcedEnhancedAccuracy: false,
      })
    ).toContain('starts locally');

    expect(
      getUploadExtractionModeSummary({
        featureEnabled: true,
        hasEnhancedAccess: true,
        forcedEnhancedAccuracy: false,
      })
    ).toContain('may automatically use enhanced extraction');
  });

  it('describes forced enhanced extraction when the toggle is enabled', () => {
    expect(
      getUploadExtractionModeSummary({
        featureEnabled: true,
        hasEnhancedAccess: true,
        forcedEnhancedAccuracy: true,
      })
    ).toContain('force enhanced extraction');
  });

  it('falls back to local-only copy when enhanced extraction is unavailable', () => {
    expect(
      getUploadExtractionModeSummary({
        featureEnabled: false,
        hasEnhancedAccess: true,
        forcedEnhancedAccuracy: false,
      })
    ).toContain('local processing only');
  });

  it('returns truthful extraction status messages for each processing path', () => {
    expect(
      getUploadExtractionStatusMessage({
        featureEnabled: true,
        hasEnhancedAccess: true,
        forcedEnhancedAccuracy: true,
      })
    ).toContain('requesting enhanced extraction');

    expect(
      getUploadExtractionStatusMessage({
        featureEnabled: true,
        hasEnhancedAccess: true,
        forcedEnhancedAccuracy: false,
      })
    ).toContain('may automatically use enhanced extraction');

    expect(
      getUploadExtractionStatusMessage({
        featureEnabled: false,
        hasEnhancedAccess: true,
        forcedEnhancedAccuracy: false,
      })
    ).toContain('local processing');
  });

  it('formats review routing reasons for scanned and low-confidence documents', () => {
    expect(getReviewRoutingReasonLabel('scanned_document')).toContain('Scanned PDF detected');
    expect(getReviewRoutingReasonLabel('low_confidence_required_fields')).toContain('Required fields were missing');
    expect(getReviewRoutingReasonLabel('manual_request')).toContain('forced enhanced extraction');
    expect(getReviewRoutingReasonLabel(null)).toBeNull();
  });
});
