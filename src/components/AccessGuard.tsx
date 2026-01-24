import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AccessGuardProps {
  children: ReactNode;
}

/**
 * Allows signed-in users who are either the owner OR have an assigned role
 * (owner/collaborator/viewer) to access protected app routes.
 */
export function AccessGuard({ children }: AccessGuardProps) {
  const { user, loading, ownershipLoading, roleLoading, isOwner, role } = useAuth();

  // Show loading while auth/role/ownership checks are in progress
  if (loading || ownershipLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAuthorized = isOwner || role === 'owner' || role === 'collaborator' || role === 'viewer';
  if (!isAuthorized) {
    return <Navigate to="/restricted" replace />;
  }

  return <>{children}</>;
}
