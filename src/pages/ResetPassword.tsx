import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnvironmentIndicator } from '@/components/EnvironmentIndicator';
import { FileText, Loader2, AlertCircle, CheckCircle2, Copy, Check, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import { getEnvironment } from '@/lib/environment';

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Environment URLs for mismatch redirect
const ENV_URLS = {
  test: import.meta.env.VITE_TEST_URL || 'https://continuityflow.vercel.app',
  production: import.meta.env.VITE_PROD_URL || 'https://www.continuityflow.com',
};

export default function ResetPassword() {
  const { updatePassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Environment mismatch detection
  const envFromUrl = searchParams.get('env') as 'production' | 'test' | null;
  const currentEnv = getEnvironment();
  const envMismatch = envFromUrl && envFromUrl !== currentEnv;
  
  // Build the correct URL for the other environment
  const correctEnvUrl = envMismatch 
    ? `${ENV_URLS[envFromUrl]}${window.location.pathname}${window.location.search}${window.location.hash}`
    : null;

  const handleCopyUrl = async () => {
    if (correctEnvUrl) {
      await navigator.clipboard.writeText(correctEnvUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    // After successful password reset, redirect to upload
    if (success) {
      const timer = setTimeout(() => {
        navigate('/upload');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  // Environment mismatch blocking screen
  if (envMismatch && correctEnvUrl) {
    const envLabel = envFromUrl === 'test' ? 'Test Environment' : 'Production';
    const envBadgeClass = envFromUrl === 'test' ? 'env-test-badge' : 'bg-primary/10 text-primary';
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-xl">Continuity</span>
        </Link>

        <Card className="w-full max-w-md border-warning/50 border-2">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <CardTitle className="text-xl font-semibold">Wrong Environment</CardTitle>
            <CardDescription className="text-sm mt-2">
              This password reset link is for{' '}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${envBadgeClass}`}>
                {envLabel}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              You're currently on <strong>{currentEnv === 'test' ? 'Test' : 'Production'}</strong>. 
              Open this link in the correct environment to reset your password.
            </p>
            
            <div className="bg-muted rounded-lg p-3 text-xs font-mono break-all text-muted-foreground">
              {correctEnvUrl}
            </div>
            
            <Button 
              onClick={handleCopyUrl} 
              className="w-full gap-2"
              variant={copied ? "secondary" : "default"}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy {envLabel} Link
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Or open the link directly in your {envLabel.toLowerCase()} browser session.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no user session from the reset link, show error
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-xl">Continuity</span>
        </Link>

        <EnvironmentIndicator />

        <Card className="w-full max-w-md border">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold">Invalid or Expired Link</CardTitle>
            <CardDescription className="text-sm">
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/login">
              <Button>Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const validation = passwordSchema.safeParse({ password, confirmPassword });
      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setIsSubmitting(false);
        return;
      }

      const { error } = await updatePassword(password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Link to="/" className="flex items-center gap-2 mb-6">
        <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
          <FileText className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-xl">Continuity</span>
      </Link>

      <EnvironmentIndicator />

      <Card className="w-full max-w-md animate-fade-in border">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-semibold">Set New Password</CardTitle>
          <CardDescription className="text-sm">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-12 w-12 rounded-full state-confirmed flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 state-confirmed-text" />
              </div>
              <p className="text-center text-muted-foreground">
                Your password has been updated. Redirecting...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
