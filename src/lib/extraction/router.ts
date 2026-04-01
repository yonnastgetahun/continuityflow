import { localExtractor } from '@/lib/extraction/localExtractor';
import { runEnhancedExtraction } from '@/lib/extraction/enhancedExtractor';
import {
  getAutomaticRoutingReason,
  isEnhancedAccuracyFeatureEnabled,
  shouldAttemptEnhancedAccuracy,
} from '@/lib/extraction/rolloutPolicy';
import type { ExtractionInput, ExtractionResult } from '@/lib/extraction/types';

export const ENHANCED_ACCURACY_FALLBACK_REASON =
  'Enhanced Accuracy is not available yet. Using local processing.';

export async function extractDocuments(input: ExtractionInput): Promise<ExtractionResult> {
  const localResult = await localExtractor.extract(input);
  const automaticRoutingReason = input.hasEnhancedAccess ? getAutomaticRoutingReason(localResult) : null;
  const shouldUseEnhancedAccuracy = shouldAttemptEnhancedAccuracy({
    featureEnabled: isEnhancedAccuracyFeatureEnabled(),
    hasEnhancedAccess: input.hasEnhancedAccess,
    manualRequest: input.enableEnhancedAccuracy,
    automaticRoutingReason,
  });

  if (!shouldUseEnhancedAccuracy) {
    return localResult;
  }

  try {
    const enhancedResult = await runEnhancedExtraction(input, localResult);

    return automaticRoutingReason
      ? {
          ...enhancedResult,
          metadata: {
            ...enhancedResult.metadata,
            automaticRoutingReason,
          },
        }
      : enhancedResult;
  } catch (error) {
    const failureReason =
      error instanceof Error && error.message ? error.message : ENHANCED_ACCURACY_FALLBACK_REASON;

    return {
      ...localResult,
      mode: 'enhanced_accuracy',
      requestedProvider: 'ai',
      finalProvider: 'fallback_local',
      usedFallback: true,
      failureReason,
      metadata: {
        ...localResult.metadata,
        enhancedAccuracyRequested: true,
        automaticRoutingReason,
        fallbackReason: failureReason,
      },
    };
  }
}
