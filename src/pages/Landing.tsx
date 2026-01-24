import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Clock, 
  AlertCircle,
  Lock,
  CheckCircle, 
  ArrowRight, 
  ClipboardCheck,
  FileCheck,
  Users,
  Briefcase,
  ChevronRight
} from 'lucide-react';

const valueProof = [
  { icon: ClipboardCheck, text: "Clean handoffs to accounting" },
  { icon: CheckCircle, text: "Fewer approval back-and-forths" },
  { icon: FileCheck, text: "Audit-ready records by default" },
];

const painPoints = [
  {
    icon: Clock,
    title: "Hours lost to retyping",
    description: "Manually copying vendor details from W-9s and invoices into PO templates and spreadsheets."
  },
  {
    icon: AlertCircle,
    title: "Errors that delay payment",
    description: "Small mistakes turn into approval churn, vendor frustration, and accounting follow-ups."
  },
  {
    icon: Lock,
    title: "Sensitive data in the wrong places",
    description: "Tax IDs and financial information scattered across inboxes and shared drives."
  }
];

const steps = [
  {
    step: "1",
    title: "Upload documents",
    description: "Upload an invoice PDF and optional W-9. Processing happens locally in your browser."
  },
  {
    step: "2",
    title: "Review and confirm",
    description: "Review extracted fields with confidence indicators. Fix only what needs attention."
  },
  {
    step: "3",
    title: "Generate a clean PO",
    description: "Create a professional purchase order in seconds and export as PDF, ready for approval."
  }
];

const privacyFeatures = [
  "Local-first document processing",
  "Only confirmed fields saved",
  "No cloud upload required",
  "Optional encrypted storage (Pro)"
];

const audiences = [
  {
    icon: Briefcase,
    title: "Production Coordinators",
    description: "Turn W-9s and invoices into clean purchase orders without spreadsheet gymnastics."
  },
  {
    icon: Users,
    title: "Line Producers and Production Managers",
    description: "Approve faster with fewer surprises and cleaner downstream records."
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border bg-card fixed w-full z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-lg">Continuity</span>
              <span className="text-sm text-muted-foreground">PO Maker (Beta)</span>
            </div>
          </div>
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="mb-6 animate-fade-in">
            Keep production moving —
            <br />
            <span className="text-primary">without breaking accounting.</span>
          </h1>
          
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Create clean purchase orders from W-9s and invoices, with confidence before approval.
            <br />
            Local-first processing. Only confirmed fields are saved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <Link to="/login">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
              Watch Demo
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            No credit card required.
          </p>
        </div>
      </section>

      {/* Value Proof Strip */}
      <section className="py-6 px-4 border-y border-border bg-secondary">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4">
            {valueProof.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center gap-2 text-sm text-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{item.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">
              Sound familiar?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Production teams lose hours every week to repetitive finance paperwork — and the cleanup that follows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {painPoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <div 
                  key={index} 
                  className="section-card rounded-lg p-6"
                >
                  <div className="h-10 w-10 rounded bg-destructive/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-destructive" />
                  </div>
                  <h3 className="mb-2">{point.title}</h3>
                  <p className="text-sm text-muted-foreground">{point.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 bg-secondary">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">
              How it works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From documents to a clean purchase order — with confidence at every step.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className="relative"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-full border-2 border-primary flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{step.step}</span>
                  </div>
                  <h3>{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground pl-11">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-4 -right-5 text-border">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="py-24 px-4 bg-sidebar text-sidebar-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 trust-badge px-3 py-1.5 rounded text-sm font-medium mb-6">
            <Lock className="h-4 w-4" />
            Privacy-first
          </div>
          
          <h2 className="mb-6">
            Your data stays yours.
          </h2>
          
          <p className="text-sidebar-foreground/80 mb-10 max-w-xl mx-auto">
            Production finance involves sensitive information. Continuity processes documents locally and stores only the structured data you explicitly confirm. No documents are uploaded unless you opt in.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-md mx-auto text-left">
            {privacyFeatures.map((item, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                <span className="text-sidebar-foreground/90">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">
              Built for production finance handoffs
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              For teams who need speed and accuracy — before anything hits accounting.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {audiences.map((audience, index) => {
              const Icon = audience.icon;
              return (
                <div key={index} className="section-card rounded-lg p-8">
                  <Icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="mb-2">{audience.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {audience.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Future Direction */}
      <section className="py-20 px-4 bg-secondary border-y border-border">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="mb-5">
            Continuity is just getting started.
          </h2>
          <p className="text-muted-foreground">
            Today, Continuity helps you generate clean purchase orders.
            <br />
            Next, it will help you catch issues before approval — and prevent problems before they reach accounting.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 bg-primary">
        <div className="container mx-auto max-w-3xl text-center text-primary-foreground">
          <h2 className="mb-5">
            Ready to get hours back every week?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
            Start your 7-day free trial. No credit card required.
          </p>
          <Link to="/login">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 2026 Continuity. Built with privacy in mind.</p>
        </div>
      </footer>
    </div>
  );
}
