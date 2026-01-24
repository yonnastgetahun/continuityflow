import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnvironmentIndicator } from '@/components/EnvironmentIndicator';
import { FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ViewMode = 'signin' | 'signup' | 'forgot';

export default function Login() {
  const { signIn, signUp, resetPassword, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/upload" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (viewMode === 'forgot') {
        const validation = emailSchema.safeParse({ email });
        if (!validation.success) {
          setError(validation.error.errors[0].message);
          setIsSubmitting(false);
          return;
        }

        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
        } else {
          setSuccessMessage(
            `Password reset email sent to ${email}. Check your inbox for a link to reset your password.`
          );
        }
      } else {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          setError(validation.error.errors[0].message);
          setIsSubmitting(false);
          return;
        }

        const { error } = viewMode === 'signup'
          ? await signUp(email, password)
          : await signIn(email, password);

        if (error) {
          if (error.message.includes('User already registered')) {
            setError('An account with this email already exists. Please sign in.');
          } else if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please try again.');
          } else {
            setError(error.message);
          }
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    setError(null);
    setSuccessMessage(null);
  };

  const getTitle = () => {
    switch (viewMode) {
      case 'signup': return 'Create Account';
      case 'forgot': return 'Reset Password';
      default: return 'Welcome Back';
    }
  };

  const getDescription = () => {
    switch (viewMode) {
      case 'signup': return 'Start your 7-day free trial';
      case 'forgot': return 'Enter your email to receive a reset link';
      default: return 'Sign in to continue';
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
          <CardTitle className="text-xl font-semibold">{getTitle()}</CardTitle>
          <CardDescription className="text-sm">{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="state-error rounded-lg p-3 flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 state-error-text flex-shrink-0" />
                <span className="state-error-text">{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="state-confirmed rounded-lg p-3 flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 state-confirmed-text flex-shrink-0" />
                <span className="state-confirmed-text">{successMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {viewMode !== 'forgot' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {viewMode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchView('forgot')}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={viewMode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {viewMode === 'forgot' ? 'Sending...' : viewMode === 'signup' ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                viewMode === 'forgot' ? 'Send Reset Link' : viewMode === 'signup' ? 'Create Account' : 'Sign In'
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              {viewMode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('signin')}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              ) : viewMode === 'forgot' ? (
                <>
                  Remember your password?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('signin')}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('signup')}
                    className="text-primary hover:underline font-medium"
                  >
                    Create one
                  </button>
                </>
              )}
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Access is limited to authorized accounts only.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
