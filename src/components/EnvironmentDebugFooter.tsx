import { useAuth } from '@/hooks/useAuth';
import { getEnvironment, getEnvironmentSource } from '@/lib/environment';

/**
 * Hidden debug footer showing environment info.
 * Only visible to owners/admins.
 */
export function EnvironmentDebugFooter() {
  const { role } = useAuth();

  const isAdmin = role === 'owner';
  if (!isAdmin) return null;

  const env = getEnvironment();
  const source = getEnvironmentSource();
  const buildTime = import.meta.env.VITE_BUILD_TIME || 'dev';

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 h-6 bg-muted/80 backdrop-blur-sm border-t border-border/50 flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-mono opacity-0 hover:opacity-100 transition-opacity z-50"
      title="Debug info (admin only)"
    >
      <span className={env === 'test' ? 'text-amber-500' : 'text-green-500'}>
        ENV: {env.toUpperCase()}
      </span>
      <span className="text-muted-foreground/60">|</span>
      <span>Source: {source}</span>
      <span className="text-muted-foreground/60">|</span>
      <span>Build: {buildTime}</span>
    </div>
  );
}
