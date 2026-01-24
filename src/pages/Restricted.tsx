import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldX, LogOut, FileText } from 'lucide-react';

export default function Restricted() {
  const { signOut, user, loading, ownershipLoading, roleLoading, isOwner, role } = useAuth();

  // If the user is actually authorized (e.g. collaborator) don't leave them stranded here.
  if (!loading && !ownershipLoading && !roleLoading && user) {
    const isAuthorized =
      isOwner || role === 'owner' || role === 'collaborator' || role === 'viewer';
    if (isAuthorized) {
      return <Navigate to="/upload" replace />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="h-10 w-10 rounded-lg hero-gradient flex items-center justify-center">
          <FileText className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="font-display font-bold text-2xl">PO Maker</span>
      </Link>

      <Card className="w-full max-w-md animate-scale-in">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="font-display text-2xl">Access Restricted</CardTitle>
          <CardDescription>
            Your account doesn't have access to this application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Signed in as: <span className="font-medium text-foreground">{user?.email}</span>
            </p>
          </div>

          <p className="text-sm text-center text-muted-foreground">
            PO Maker is currently limited to authorized accounts only. 
            If you believe you should have access, please contact the administrator.
          </p>

          <Button onClick={signOut} variant="outline" className="w-full gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>

          <div className="text-center">
            <Link to="/" className="text-sm text-primary hover:underline">
              Return to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
