import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { TrialBanner } from '@/components/TrialBanner';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Upload, 
  ClipboardList, 
  FileOutput, 
  Settings,
  LogOut,
  CreditCard
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/records', label: 'Records', icon: ClipboardList },
  { path: '/upgrade', label: 'Upgrade', icon: CreditCard },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { signOut, user, profile, role } = useAuth();
  const location = useLocation();

  const getRoleBadge = () => {
    if (!role) return null;
    
    const roleConfig = {
      owner: { label: 'Owner', className: 'state-ready' },
      collaborator: { label: 'Collaborator', className: 'state-attention' },
      viewer: { label: 'Viewer', className: 'bg-muted text-muted-foreground' },
    };
    
    const config = roleConfig[role];
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TrialBanner />
      
      {/* Top Navigation */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/upload" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground">Continuity</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            {getRoleBadge()}
            {profile?.subscription_status === 'subscribed' && (
              <span className="trust-badge text-xs px-2 py-1 rounded-full font-medium">
                {profile.plan_type?.toUpperCase()}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className="flex flex-col items-center gap-1 p-2">
                <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  );
}
