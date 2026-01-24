import { useAuth } from '@/hooks/useAuth';
import { Clock, AlertTriangle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function TrialBanner() {
  const { profile, trialDaysLeft, isReadOnly } = useAuth();

  if (!profile || profile.subscription_status === 'subscribed') {
    return null;
  }

  if (profile.subscription_status === 'trial_not_started') {
    return (
      <div className="trust-badge px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <Clock className="h-4 w-4" />
        <span>7-day free trial starts when you extract your first document</span>
      </div>
    );
  }

  if (profile.subscription_status === 'trial_expiring' || (trialDaysLeft !== null && trialDaysLeft <= 3)) {
    return (
      <div className="trial-banner px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4" />
          <span>Trial expires in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</span>
        </div>
        <Link to="/upgrade">
          <Button variant="default" size="sm">
            Upgrade Now
          </Button>
        </Link>
      </div>
    );
  }

  if (profile.subscription_status === 'trial_active') {
    return (
      <div className="time-badge px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <Clock className="h-4 w-4" />
        <span>Trial: {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left</span>
      </div>
    );
  }

  if (isReadOnly) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Lock className="h-4 w-4" />
          <span>Trial expired. App is in read-only mode.</span>
        </div>
        <Link to="/upgrade">
          <Button variant="destructive" size="sm">
            Upgrade to Continue
          </Button>
        </Link>
      </div>
    );
  }

  return null;
}
