import { describe, expect, it } from 'vitest';
import {
  evaluateEnhancedAccuracyAccess,
  type EnhancedAccuracySettings,
  type MonthlyAiUsage,
  type RolloutProfile,
} from '../../supabase/functions/enhanced-extract/policy';

const proProfile: RolloutProfile = {
  plan_type: 'pro',
  subscription_status: 'subscribed',
};

const baseSettings: EnhancedAccuracySettings = {
  featureEnabled: true,
  providerConfigured: true,
  maxDocsPerMonth: null,
  maxPagesPerMonth: null,
  maxCostUsdPerMonth: null,
};

const emptyUsage: MonthlyAiUsage = {
  ai_docs: 0,
  ai_pages: 0,
  ai_cost_usd: 0,
};

describe('enhanced extract policy', () => {
  it('denies access when the global feature flag is disabled', () => {
    const result = evaluateEnhancedAccuracyAccess({
      profile: proProfile,
      settings: { ...baseSettings, featureEnabled: false },
      currentUsage: emptyUsage,
      requestedPages: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('feature_disabled');
  });

  it('denies access when no provider is configured', () => {
    const result = evaluateEnhancedAccuracyAccess({
      profile: proProfile,
      settings: { ...baseSettings, providerConfigured: false },
      currentUsage: emptyUsage,
      requestedPages: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('provider_not_configured');
  });

  it('denies access when the user does not have an eligible plan or trial', () => {
    const result = evaluateEnhancedAccuracyAccess({
      profile: {
        plan_type: 'pilot',
        subscription_status: 'trial_expired',
      },
      settings: baseSettings,
      currentUsage: emptyUsage,
      requestedPages: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('plan_required');
  });

  it('denies access when the monthly document limit has been reached', () => {
    const result = evaluateEnhancedAccuracyAccess({
      profile: proProfile,
      settings: { ...baseSettings, maxDocsPerMonth: 5 },
      currentUsage: { ...emptyUsage, ai_docs: 5 },
      requestedPages: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('monthly_doc_limit_reached');
  });

  it('denies access when the monthly page limit would be exceeded', () => {
    const result = evaluateEnhancedAccuracyAccess({
      profile: proProfile,
      settings: { ...baseSettings, maxPagesPerMonth: 10 },
      currentUsage: { ...emptyUsage, ai_pages: 9 },
      requestedPages: 2,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('monthly_page_limit_exceeded');
  });

  it('denies access when the monthly cost limit has been reached', () => {
    const result = evaluateEnhancedAccuracyAccess({
      profile: proProfile,
      settings: { ...baseSettings, maxCostUsdPerMonth: 2 },
      currentUsage: { ...emptyUsage, ai_cost_usd: 2 },
      requestedPages: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('monthly_cost_limit_reached');
  });

  it('allows access when feature, provider, plan, and quota conditions are satisfied', () => {
    const result = evaluateEnhancedAccuracyAccess({
      profile: proProfile,
      settings: { ...baseSettings, maxDocsPerMonth: 5, maxPagesPerMonth: 20, maxCostUsdPerMonth: 10 },
      currentUsage: { ai_docs: 2, ai_pages: 4, ai_cost_usd: 0.15 },
      requestedPages: 2,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });
});
