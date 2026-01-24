/**
 * Environment configuration - Single source of truth.
 * 
 * Priority: VITE_APP_ENV > URL detection > 'production' fallback
 * 
 * Production and test environments maintain separate:
 * - User accounts (same email can exist in both)
 * - Password reset tokens
 * - Session state
 */

export type AppEnvironment = 'production' | 'test';

// Cache the resolved environment
let _resolvedEnv: AppEnvironment | null = null;
let _envSource: string | null = null;

/**
 * Resolve environment from config with safe fallback.
 * Uses VITE_APP_ENV if set, otherwise falls back to URL detection.
 */
function resolveEnvironment(): { env: AppEnvironment; source: string } {
  const envVar = import.meta.env.VITE_APP_ENV;
  
  // Priority 1: Explicit environment variable
  if (envVar === 'test' || envVar === 'prod' || envVar === 'production') {
    const env: AppEnvironment = envVar === 'test' ? 'test' : 'production';
    return { env, source: `VITE_APP_ENV="${envVar}"` };
  }
  
  // Priority 2: URL-based detection (preview = test)
  const hostname = window.location.hostname;
  if (hostname.includes('-preview--') || hostname.includes('localhost')) {
    return { env: 'test', source: `URL detection (${hostname})` };
  }
  
  // Priority 3: Safe fallback to production
  return { env: 'production', source: 'fallback (default)' };
}

/**
 * Get current environment. Caches result and logs on first call.
 */
export function getEnvironment(): AppEnvironment {
  if (_resolvedEnv === null) {
    const { env, source } = resolveEnvironment();
    _resolvedEnv = env;
    _envSource = source;
    
    // Log resolved environment for debugging
    console.info(
      `%c[Environment] %c${env.toUpperCase()}%c via ${source}`,
      'color: #888',
      `color: ${env === 'test' ? '#f59e0b' : '#22c55e'}; font-weight: bold`,
      'color: #888'
    );
  }
  return _resolvedEnv;
}

/**
 * Get environment source for debug display
 */
export function getEnvironmentSource(): string {
  if (_envSource === null) {
    getEnvironment(); // Trigger resolution
  }
  return _envSource!;
}

/**
 * Get environment display name for UI
 */
export function getEnvironmentLabel(): string {
  return getEnvironment() === 'test' ? 'Test Environment' : 'Continuity';
}

/**
 * Get branded app name with environment context
 */
export function getBrandedName(): string {
  const env = getEnvironment();
  return env === 'test' ? 'Continuity — Test Environment' : 'Continuity';
}

/**
 * Check if current environment is test
 */
export function isTestEnvironment(): boolean {
  return getEnvironment() === 'test';
}

/**
 * Generate environment-scoped storage key
 * Prevents token/state leakage between environments
 */
export function getScopedKey(key: string): string {
  const env = getEnvironment();
  return `${env}:${key}`;
}
