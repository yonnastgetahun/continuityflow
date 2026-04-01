export interface RolloutProfile {
  plan_type: 'pilot' | 'pro' | null;
  subscription_status:
    | 'trial_not_started'
    | 'trial_active'
    | 'trial_expiring'
    | 'trial_expired'
    | 'subscribed';
}

export interface MonthlyAiUsage {
  ai_docs: number;
  ai_pages: number;
  ai_cost_usd: number;
}

export interface EnhancedAccuracySettings {
  featureEnabled: boolean;
  providerConfigured: boolean;
  maxDocsPerMonth: number | null;
  maxPagesPerMonth: number | null;
  maxCostUsdPerMonth: number | null;
}

export type EnhancedAccuracyDeniedReason =
  | 'feature_disabled'
  | 'provider_not_configured'
  | 'plan_required'
  | 'monthly_doc_limit_reached'
  | 'monthly_page_limit_exceeded'
  | 'monthly_cost_limit_reached';

export function parseNullableInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseNullableFloat(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getEnhancedAccuracySettings(
  env: Record<string, string | undefined>,
): EnhancedAccuracySettings {
  return {
    featureEnabled: env.ENHANCED_ACCURACY_ENABLED !== 'false',
    providerConfigured: Boolean(env.AI_EXTRACTION_API_KEY ?? env.OPENAI_API_KEY),
    maxDocsPerMonth: parseNullableInt(env.ENHANCED_ACCURACY_MAX_DOCS_PER_MONTH),
    maxPagesPerMonth: parseNullableInt(env.ENHANCED_ACCURACY_MAX_PAGES_PER_MONTH),
    maxCostUsdPerMonth: parseNullableFloat(env.ENHANCED_ACCURACY_MAX_COST_USD_PER_MONTH),
  };
}

export function hasEnhancedPlanAccess(profile: RolloutProfile): boolean {
  return (
    profile.plan_type === 'pro' ||
    profile.subscription_status === 'trial_not_started' ||
    profile.subscription_status === 'trial_active' ||
    profile.subscription_status === 'trial_expiring'
  );
}

export function evaluateEnhancedAccuracyAccess({
  profile,
  settings,
  currentUsage,
  requestedPages,
}: {
  profile: RolloutProfile;
  settings: EnhancedAccuracySettings;
  currentUsage: MonthlyAiUsage;
  requestedPages: number;
}): { allowed: true; reason: null } | { allowed: false; reason: EnhancedAccuracyDeniedReason } {
  if (!settings.featureEnabled) {
    return { allowed: false, reason: 'feature_disabled' };
  }

  if (!settings.providerConfigured) {
    return { allowed: false, reason: 'provider_not_configured' };
  }

  if (!hasEnhancedPlanAccess(profile)) {
    return { allowed: false, reason: 'plan_required' };
  }

  if (
    settings.maxDocsPerMonth !== null &&
    currentUsage.ai_docs >= settings.maxDocsPerMonth
  ) {
    return { allowed: false, reason: 'monthly_doc_limit_reached' };
  }

  if (
    settings.maxPagesPerMonth !== null &&
    currentUsage.ai_pages + requestedPages > settings.maxPagesPerMonth
  ) {
    return { allowed: false, reason: 'monthly_page_limit_exceeded' };
  }

  if (
    settings.maxCostUsdPerMonth !== null &&
    currentUsage.ai_cost_usd >= settings.maxCostUsdPerMonth
  ) {
    return { allowed: false, reason: 'monthly_cost_limit_reached' };
  }

  return { allowed: true, reason: null };
}
