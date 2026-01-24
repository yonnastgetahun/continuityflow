import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface OwnerGuardProps {
  children: ReactNode;
}

export function OwnerGuard({ children }: OwnerGuardProps) {
  const { user, loading, isOwner } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isOwner) {
    return <Navigate to="/restricted" replace />;
  }

  return <>{children}</>;
}
