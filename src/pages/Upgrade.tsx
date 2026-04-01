import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Check, 
  Zap,
  Shield,
  Star,
  Clock
} from 'lucide-react';

const plans = [
  {
    name: 'Pilot',
    price: 49,
    description: 'For individuals getting started',
    features: [
      'Unlimited document uploads',
      'Vendor & invoice management',
      'PO generation & export',
      'Basic support',
    ],
    notIncluded: [
      'Encrypted document storage',
      'Advanced OCR features',
      'Priority support',
    ],
    popular: false,
  },
  {
    name: 'Pro',
    price: 199,
    description: 'For teams and power users',
    features: [
      'Everything in Pilot',
      'Encrypted document storage',
      'Advanced OCR preview',
      'Priority support',
      'API access (coming soon)',
    ],
    notIncluded: [],
    popular: true,
  },
];

export default function UpgradePage() {
  const { profile, trialDaysLeft } = useAuth();

  const isTrialActive = profile?.subscription_status === 'trial_active' || 
    profile?.subscription_status === 'trial_expiring';
  const isTrialExpired = profile?.subscription_status === 'trial_expired';
  const isSubscribed = profile?.subscription_status === 'subscribed';

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center animate-fade-in">
          <h1 className="font-display text-3xl font-bold mb-2">
            {isSubscribed ? 'Manage Subscription' : 'Choose Your Plan'}
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            {isTrialActive && (
              <>You have <strong>{trialDaysLeft} days</strong> left in your Pro trial. Subscribe to keep all features.</>
            )}
            {isTrialExpired && (
              <>Your trial has expired. Subscribe to continue using Continuity.</>
            )}
            {!isTrialActive && !isTrialExpired && !isSubscribed && (
              <>Start your 7-day free trial with Pro features. No credit card required.</>
            )}
            {isSubscribed && (
              <>You're currently on the <strong>{profile?.plan_type?.toUpperCase()}</strong> plan.</>
            )}
          </p>
        </div>

        {isTrialActive && (
          <div className="time-badge rounded-lg p-4 flex items-center justify-center gap-3 animate-scale-in">
            <Clock className="h-5 w-5" />
            <span>
              <strong>{trialDaysLeft} days</strong> remaining in your Pro trial
            </span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan, index) => (
            <Card 
              key={plan.name} 
              className={`relative animate-slide-up ${
                plan.popular ? 'border-primary shadow-lg' : ''
              }`}
              style={{ animationDelay: `${0.1 * index}s` }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="hero-gradient text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    MOST POPULAR
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="font-display text-2xl">{plan.name}</span>
                  <div className="text-right">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 opacity-50">
                      <div className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm line-through">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isSubscribed && profile?.plan_type === plan.name.toLowerCase() ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button 
                    variant={plan.popular ? 'default' : 'outline'} 
                    className="w-full gap-2"
                  >
                    {isSubscribed ? 'Switch Plan' : 'Subscribe'}
                    <Zap className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="grid sm:grid-cols-3 gap-4 pt-8">
          {[
            { icon: Shield, title: 'Secure Payments', desc: 'SSL encrypted checkout' },
            { icon: Zap, title: 'Instant Access', desc: 'Start using immediately' },
            { icon: Check, title: 'Cancel Anytime', desc: 'No long-term commitment' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
              <item.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
