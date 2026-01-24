import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Clock, 
  Shield, 
  CheckCircle, 
  ArrowRight, 
  Upload,
  Zap,
  Lock,
  Building2,
  Users
} from 'lucide-react';

const painPoints = [
  {
    icon: Clock,
    title: "Hours wasted on data entry",
    description: "Manually copying vendor info from W9s and invoice details into spreadsheets"
  },
  {
    icon: FileText,
    title: "Error-prone paperwork",
    description: "Typos and mistakes that lead to payment delays and vendor frustration"
  },
  {
    icon: Shield,
    title: "Sensitive data concerns",
    description: "Uploading tax IDs and financial info to cloud services you don't control"
  }
];

const steps = [
  {
    step: "01",
    title: "Upload Documents",
    description: "Drag and drop your invoice PDF and optional W9. Processing happens locally."
  },
  {
    step: "02",
    title: "Review & Edit",
    description: "See extracted fields with confidence scores. Fix anything that needs correction."
  },
  {
    step: "03",
    title: "Generate PO",
    description: "Create a professional purchase order in seconds. Export as PDF."
  }
];

const features = [
  { icon: Lock, text: "Local-first processing" },
  { icon: Shield, text: "Only confirmed data saved" },
  { icon: Zap, text: "90% faster than manual entry" },
  { icon: CheckCircle, text: "No credit card for trial" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm fixed w-full z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg hero-gradient flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-xl">PO Maker</span>
          </div>
          <Link to="/login">
            <Button variant="default">Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 time-badge px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-in">
            <Clock className="h-4 w-4" />
            Save 2+ hours per week
          </div>
          
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Turn hours of paperwork
            <br />
            <span className="hero-gradient-text">into minutes.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
            Create clean purchase orders from W9s and invoices — safely.
            <br />
            Processed locally. Only confirmed fields are saved.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <Link to="/login">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
              Watch Demo
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-12 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 text-success" />
                  <span>{feature.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-4">
            Sound familiar?
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Accounts payable teams spend hours each week on repetitive document processing.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {painPoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <div key={index} className="glass-card rounded-xl p-6 animate-slide-up" style={{ animationDelay: `${0.1 * index}s` }}>
                  <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-destructive" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">{point.title}</h3>
                  <p className="text-muted-foreground text-sm">{point.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            From documents to purchase order in three simple steps.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative animate-slide-up" style={{ animationDelay: `${0.1 * index}s` }}>
                <div className="text-6xl font-display font-bold text-primary/10 mb-4">
                  {step.step}
                </div>
                <h3 className="font-display font-semibold text-xl mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 -right-4 text-primary/30">
                    <ArrowRight className="h-8 w-8" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Security */}
      <section className="py-20 px-4 bg-sidebar text-sidebar-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 trust-badge px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            Privacy First
          </div>
          
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
            Your data stays yours.
          </h2>
          
          <p className="text-sidebar-foreground/70 text-lg mb-8 max-w-2xl mx-auto">
            Document extraction happens in your browser. We only store the structured data you explicitly confirm. 
            No documents are uploaded unless you opt in with Pro.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left">
            {[
              "Local-first document processing",
              "No cloud upload required",
              "Only confirmed fields saved",
              "Optional encrypted storage (Pro)"
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-4">
            Built for teams who value their time
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Whether you're a solo operator or part of a larger finance team.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-card rounded-xl p-8">
              <Building2 className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-display font-semibold text-xl mb-2">Small Business Owners</h3>
              <p className="text-muted-foreground">
                Manage vendor relationships and create professional POs without hiring additional staff.
              </p>
            </div>
            <div className="glass-card rounded-xl p-8">
              <Users className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-display font-semibold text-xl mb-2">Accounts Payable Teams</h3>
              <p className="text-muted-foreground">
                Process more invoices in less time while maintaining accuracy and compliance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 hero-gradient">
        <div className="container mx-auto max-w-4xl text-center text-primary-foreground">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
            Ready to save hours every week?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl mx-auto">
            Start your 7-day free trial today. No credit card required.
          </p>
          <Link to="/login">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 2026 PO Maker. Built with privacy in mind.</p>
        </div>
      </footer>
    </div>
  );
}
