import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { getSupabaseClient, isSupabaseConfigured, getStoredSupabaseConfig } from '../lib/supabase';
import { workspaceRepo } from '../services/workspaceRepository';
import { logger } from '../lib/logger';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;

  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, fullName: string, inviteToken?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_SESSION_KEY = 'projecthub_auth_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  // Initialize session check on application open
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const supabase = getSupabaseClient();

        if (supabase) {
          // 1. Check existing Supabase auth session
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            logger.warn('AuthContext', 'Supabase session check notice', sessionError);
          }

          if (data?.session?.user && mounted) {
            const authUser = data.session.user;
            setSession(data.session);
            setUser(authUser);

            // Fetch profile
            const userProfile = await workspaceRepo.ensureAuthenticatedProfile(
              authUser.id,
              authUser.email || '',
              authUser.user_metadata?.full_name || authUser.user_metadata?.name,
              authUser.user_metadata?.avatar_url
            );

            if (mounted) {
              setProfile(userProfile);
              await workspaceRepo.syncWithSupabase(authUser.id);
            }
          }

          // Listen for auth state changes
          const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, newSession) => {
              if (!mounted) return;
              if (newSession?.user) {
                setSession(newSession);
                setUser(newSession.user);
                const prof = await workspaceRepo.ensureAuthenticatedProfile(
                  newSession.user.id,
                  newSession.user.email || '',
                  newSession.user.user_metadata?.full_name || newSession.user.user_metadata?.name,
                  newSession.user.user_metadata?.avatar_url
                );
                setProfile(prof);
              } else {
                setSession(null);
                setUser(null);
                setProfile(null);
              }
            }
          );

          return () => {
            authListener?.subscription.unsubscribe();
          };
        } else {
          // Supabase not yet configured via env/storage: check local persistent session
          const savedSession = localStorage.getItem(LOCAL_SESSION_KEY);
          if (savedSession && mounted) {
            try {
              const parsed = JSON.parse(savedSession);
              if (parsed && parsed.email) {
                const userProfile = await workspaceRepo.ensureAuthenticatedProfile(
                  parsed.id || 'usr-local-owner',
                  parsed.email,
                  parsed.fullName,
                  parsed.avatarUrl
                );
                setUser({
                  id: userProfile.id,
                  email: userProfile.email,
                  app_metadata: {},
                  user_metadata: { full_name: userProfile.fullName },
                  aud: 'authenticated',
                  created_at: userProfile.createdAt,
                } as unknown as User);
                setProfile(userProfile);
              }
            } catch (err) {
              localStorage.removeItem(LOCAL_SESSION_KEY);
            }
          }
        }
      } catch (err: unknown) {
        logger.error('AuthContext', 'Auth initialization error', err);
      } finally {
        if (mounted) {
          // Finish checking session - will route to Login screen if !user
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Sign In with Email & Password
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();

      if (supabase) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setIsLoading(false);
          return { success: false, error: signInError.message };
        }

        if (data.user) {
          setUser(data.user);
          setSession(data.session);

          const prof = await workspaceRepo.ensureAuthenticatedProfile(
            data.user.id,
            data.user.email || email,
            data.user.user_metadata?.full_name || data.user.user_metadata?.name,
            data.user.user_metadata?.avatar_url
          );
          setProfile(prof);
          await workspaceRepo.syncWithSupabase(data.user.id);
          setIsLoading(false);
          return { success: true };
        }
      } else {
        // Local developer session fallback (when cloud Supabase project credentials are not supplied)
        if (!email.includes('@')) {
          const err = 'Please enter a valid email address.';
          setError(err);
          setIsLoading(false);
          return { success: false, error: err };
        }
        if (password.length < 6) {
          const err = 'Password must be at least 6 characters.';
          setError(err);
          setIsLoading(false);
          return { success: false, error: err };
        }

        const userId = `usr-${Math.random().toString(36).substr(2, 9)}`;
        const prof = await workspaceRepo.ensureAuthenticatedProfile(
          userId,
          email.trim().toLowerCase(),
          email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        );

        const localUserObj = {
          id: prof.id,
          email: prof.email,
          fullName: prof.fullName,
        };
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUserObj));

        setUser({
          id: prof.id,
          email: prof.email,
          app_metadata: {},
          user_metadata: { full_name: prof.fullName },
          aud: 'authenticated',
          created_at: prof.createdAt,
        } as unknown as User);
        setProfile(prof);
        setIsLoading(false);
        return { success: true };
      }

      setIsLoading(false);
      return { success: false, error: 'Authentication failed.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  }, []);

  // Sign Up with Email
  const signUpWithEmail = useCallback(
    async (email: string, password: string, fullName: string, inviteToken?: string) => {
      setError(null);
      setIsLoading(true);

      try {
        // If invitation token provided, redeem it
        if (inviteToken) {
          try {
            workspaceRepo.redeemInvitation(inviteToken, fullName);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Invalid invitation token.';
            setError(msg);
            setIsLoading(false);
            return { success: false, error: msg };
          }
        }

        const supabase = getSupabaseClient();

        if (supabase) {
          const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
              data: { full_name: fullName.trim() },
            },
          });

          if (signUpError) {
            setError(signUpError.message);
            setIsLoading(false);
            return { success: false, error: signUpError.message };
          }

          if (data.user) {
            setUser(data.user);
            setSession(data.session);

            const prof = await workspaceRepo.ensureAuthenticatedProfile(
              data.user.id,
              data.user.email || email,
              fullName.trim(),
              undefined
            );
            setProfile(prof);
            setIsLoading(false);
            return { success: true };
          }
        } else {
          // Local signup
          const userId = `usr-${Math.random().toString(36).substr(2, 9)}`;
          const prof = await workspaceRepo.ensureAuthenticatedProfile(
            userId,
            email.trim().toLowerCase(),
            fullName.trim()
          );

          const localUserObj = {
            id: prof.id,
            email: prof.email,
            fullName: prof.fullName,
          };
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUserObj));

          setUser({
            id: prof.id,
            email: prof.email,
            app_metadata: {},
            user_metadata: { full_name: prof.fullName },
            aud: 'authenticated',
            created_at: prof.createdAt,
          } as unknown as User);
          setProfile(prof);
          setIsLoading(false);
          return { success: true };
        }

        setIsLoading(false);
        return { success: false, error: 'Registration failed.' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setIsLoading(false);
        return { success: false, error: msg };
      }
    },
    []
  );

  // Forgot Password / Reset
  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const supabase = getSupabaseClient();

    if (supabase) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (resetError) {
        setError(resetError.message);
        return { success: false, error: resetError.message };
      }
      return { success: true };
    } else {
      return { success: true };
    }
  }, []);

  // Sign Out
  const signOut = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      logger.warn('AuthContext', 'Error during remote signout', e);
    } finally {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setUser(null);
      setSession(null);
      setProfile(null);
      setError(null);
      logger.info('AuthContext', 'User signed out. Cleared authenticated session.');
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id && user?.email) {
      const prof = await workspaceRepo.ensureAuthenticatedProfile(
        user.id,
        user.email,
        user.user_metadata?.full_name
      );
      setProfile(prof);
    }
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAuthenticated: Boolean(user && profile),
        isLoading,
        isConfigured,
        error,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOut,
        clearError,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
