/**
 * Environment detection for authentication separation.
 * 
 * Production and test environments maintain separate:
 * - User accounts (same email can exist in both)
 * - Password reset tokens
 * - Session state
 */

export type AppEnvironment = 'production' | 'test';

/**
 * Detect current environment based on URL.
 * Preview URLs are considered test environment.
 * Published/custom domains are production.
 */
export function getEnvironment(): AppEnvironment {
  const hostname = window.location.hostname;
  
  // Preview URLs contain '-preview--' in the hostname
  if (hostname.includes('-preview--') || hostname.includes('localhost')) {
    return 'test';
  }
  
  return 'production';
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
