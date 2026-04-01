import type { ExtractionResult } from '@/lib/extraction/types';

export type AutomaticRoutingReason =
  | 'scanned_document'
  | 'low_confidence_required_fields';

const REQUIRED_FIELD_KEYS = [
  ['vendor', 'name'],
  ['invoice', 'invoiceDate'],
  ['invoice', 'total'],
] as const;

export function isEnhancedAccuracyFeatureEnabled(): boolean {
  return import.meta.env.VITE_ENHANCED_ACCURACY_ENABLED !== 'false';
}

export function hasLowConfidenceRequiredFields(result: ExtractionResult): boolean {
  return REQUIRED_FIELD_KEYS.some(([section, fieldKey]) => {
    const field = result.extractedFields[section][fieldKey];
    return !field.value || field.confidence !== 'high';
  });
}

export function getAutomaticRoutingReason(result: ExtractionResult): AutomaticRoutingReason | null {
  if (result.isScanned) {
    return 'scanned_document';
  }

  if (hasLowConfidenceRequiredFields(result)) {
    return 'low_confidence_required_fields';
  }

  return null;
}

export function shouldAttemptEnhancedAccuracy({
  featureEnabled,
  hasEnhancedAccess,
  manualRequest,
  automaticRoutingReason,
}: {
  featureEnabled: boolean;
  hasEnhancedAccess: boolean;
  manualRequest: boolean;
  automaticRoutingReason: AutomaticRoutingReason | null;
}): boolean {
  if (!featureEnabled || !hasEnhancedAccess) {
    return false;
  }

  return manualRequest || Boolean(automaticRoutingReason);
}
