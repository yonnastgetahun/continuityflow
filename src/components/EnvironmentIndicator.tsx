import { getEnvironment } from '@/lib/environment';

interface EnvironmentIndicatorProps {
  /** Show production label (defaults to false - production is calm/unlabeled) */
  showProduction?: boolean;
}

/**
 * Environment indicator for auth screens.
 * - Test: Visible muted badge with safety note
 * - Production: Minimal or hidden (calm default)
 * 
 * Place this near the top of auth cards, before credential inputs.
 */
export function EnvironmentIndicator({ showProduction = false }: EnvironmentIndicatorProps) {
  const env = getEnvironment();
  
  if (env === 'test') {
    return (
      <div className="w-full max-w-md mb-4">
        <div className="bg-muted border border-border rounded-lg px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-warning" />
            <span className="text-sm font-medium text-foreground">Test Environment</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Actions here do not affect production.
          </p>
        </div>
      </div>
    );
  }
  
  // Production: calm and minimal
  if (showProduction) {
    return (
      <div className="w-full max-w-md mb-4 text-center">
        <span className="text-xs text-muted-foreground/60">Production</span>
      </div>
    );
  }
  
  return null;
}
