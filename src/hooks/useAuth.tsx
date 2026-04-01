import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getEnvironment, type AppEnvironment } from '@/lib/environment';

export type AppRole = 'owner' | 'collaborator' | 'viewer' | null;

interface Profile {
  id: string;
  email: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_status: 'trial_not_started' | 'trial_active' | 'trial_expiring' | 'trial_expired' | 'subscribed';
  plan_type: 'pilot' | 'pro' | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  isOwner: boolean;
  trialDaysLeft: number | null;
  canUseApp: boolean;
  isReadOnly: boolean;
  environment: AppEnvironment;
  role: AppRole;
  canEdit: boolean;
  canManage: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [role, setRole] = useState<AppRole>(null);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (data && !error) {
      setProfile(data as Profile);
    }
  };

  const fetchRole = async (userId: string) => {
    setRoleLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .order('role')
        .limit(1)
        .maybeSingle();
      
      if (data && !error) {
        setRole(data.role as AppRole);
      } else {
        // No role assigned yet - default behavior
        setRole(null);
      }
    } finally {
      setRoleLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchRole(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchRole(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setRoleLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const environment = getEnvironment();
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    try {
      // Use custom edge function for environment-branded emails
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: { email, environment, redirectUrl }
      });
      
      if (error) {
        return { error: new Error(error.message) };
      }
      return { error: null };
    } catch (err) {
      // Fallback to standard reset if edge function fails
      console.warn('Custom reset failed, using standard flow:', err);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      return { error: error as Error | null };
    }
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };
  const isOwner = role === 'owner';
  const environment = getEnvironment();

  // Calculate trial days left
  const trialDaysLeft = profile?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Can use app: either subscribed or in active trial
  const canUseApp = profile?.subscription_status === 'subscribed' ||
    profile?.subscription_status === 'trial_active' ||
    profile?.subscription_status === 'trial_expiring' ||
    profile?.subscription_status === 'trial_not_started';

  // Read only mode: trial expired and not subscribed
  const isReadOnly = profile?.subscription_status === 'trial_expired';

  // Role-based permissions (expectation, not strict enforcement)
  // Owner or no role assigned (legacy single-user) can manage
  const canManage = role === 'owner' || (role === null && isOwner);
  // Owner and collaborator can edit, viewer cannot
  const canEdit = role === 'owner' || role === 'collaborator' || (role === null && isOwner);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      roleLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile,
      isOwner,
      trialDaysLeft,
      canUseApp,
      isReadOnly,
      environment,
      role,
      canEdit,
      canManage,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
