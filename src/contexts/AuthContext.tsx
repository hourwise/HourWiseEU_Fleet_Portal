import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, AuthError, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isSigningUp: boolean; // New
  needsMfa: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string, role: 'driver' | 'manager', companyName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false); // New
  const [needsMfa, setNeedsMfa] = useState(false);
  const runIdRef = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    // This looks for the user in BOTH potential columns
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
    } else {
      // Safety check: if we found it via user_id but the 'id' is different,
      // it's still a valid profile for this user.
      setProfile(data || null);
    }
  }, []);

  const checkMfaStatus = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      console.error("Error fetching MFA status:", error);
      setNeedsMfa(false);
    } else {
      const mfaRequired = !!(data.nextLevel && data.nextLevel !== data.currentLevel);
      setNeedsMfa(mfaRequired);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession();
     if (error) {
      console.error('Refresh Session Error:', error.message);
      setUser(null);
      setProfile(null);
      setNeedsMfa(false);
    } else if (session?.user) {
      await loadProfile(session.user.id);
      await checkMfaStatus();
    } else {
      setUser(null);
      setProfile(null);
      setNeedsMfa(false);
    }
  }, [loadProfile, checkMfaStatus]);

  useEffect(() => {
    let cancelled = false;
    const runId = ++runIdRef.current;

    const processSession = async (session: Session | null) => {
      setLoading(true);
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      try {
        if (sessionUser) {
          await loadProfile(sessionUser.id);
          await checkMfaStatus();
        } else {
          setProfile(null);
          setNeedsMfa(false);
        }
      } catch (e) {
        console.error('[Auth] processSession error:', e);
        setProfile(null);
        setNeedsMfa(false);
      } finally {
        if (!cancelled && runId === runIdRef.current) {
          setLoading(false);
        }
      }
    };

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) await processSession(data.session);
      } catch (e) {
        console.error('[Auth] getSession failed:', e);
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setNeedsMfa(false);
          setLoading(false);
        }
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      processSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile, checkMfaStatus]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) console.error('Sign In Error:', error.message);
    return { error };
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: 'driver' | 'manager',
      companyName?: string
    ) => {
      setIsSigningUp(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        if (!authData.user) throw new Error('User creation failed');

        const userId = authData.user.id; // This is the ID we MUST use

        let companyId: string | null = null;
        if (role === 'manager' && companyName) {
          const { data: company, error: companyError } = await supabase
            .from('companies')
            .insert({ name: companyName, created_by: userId }) // Use correct ID
            .select()
            .single();
          if (companyError) throw companyError;
          companyId = company.id;
        }

        // THE CRITICAL FIX: Explicitly set BOTH 'id' and 'user_id'
        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,        // Force Primary Key to match Auth
          user_id: userId,   // Force reference column to match Auth
          email: email.toLowerCase().trim(), // Clean the data
          role,
          company_id: companyId,
          full_name: fullName,
          account_type: 'fleet',
          is_active: true // Ensure they are active by default
        });

        if (profileError) throw profileError;

        // ADD A TINY DELAY to let the DB trigger finish
        await new Promise(resolve => setTimeout(resolve, 800));

        // Manually refresh to get the NEW profile into the app state
        await loadProfile(userId);
        await refreshSession();

        return { error: null };
      } catch (error) {
        console.error('Sign Up Error:', (error as Error).message);
        return { error: error as Error };
      } finally {
        setIsSigningUp(false);
      }
    },
    [loadProfile, refreshSession]
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign Out Error:', error.message);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isSigningUp, needsMfa, signIn, signUp, signOut, refreshSession }}>
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
