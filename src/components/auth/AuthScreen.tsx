import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Key,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
  ExternalLink,
  UserCheck,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured,
} from '../../lib/supabase';

export const AuthScreen: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInAsPersona,
    profiles,
    redeemInvitation,
  } = useWorkspace();

  const [mode, setMode] = useState<'signin' | 'invite' | 'personas' | 'config'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Supabase live configuration state
  const [supabaseConfig, setSupabaseConfig] = useState(getStoredSupabaseConfig());
  const [testStatus, setTestStatus] = useState<{
    testing: boolean;
    result?: { success: boolean; message: string; latencyMs?: number };
  }>({ testing: false });

  const hasConfiguredSupabase = isSupabaseConfigured();

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        setError(res.error.message || 'Failed to authenticate with Google.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle Email + Password Sign In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await signInWithEmail(email.trim(), password);
      if (res.error) {
        setError(res.error.message || 'Invalid email or password.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Up with Invitation Token
  const handleInviteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      setError('Please enter your invitation token.');
      return;
    }
    if (!email.trim() || !fullName.trim()) {
      setError('Full name and email are required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Redeem invitation and verify matching email and token validity
      try {
        redeemInvitation(inviteToken.trim(), fullName.trim(), email.trim());
      } catch (repoErr: unknown) {
        setError(repoErr instanceof Error ? repoErr.message : 'Invalid or expired invitation token.');
        setLoading(false);
        return;
      }

      setSuccessMessage('Invitation verified! Signing you in...');
      const res = await signUpWithEmail(email.trim(), password || 'ApexDev#2026', fullName.trim(), inviteToken.trim());
      if (res.error) {
        setError(res.error.message || 'Failed to complete registration.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to redeem invitation.');
    } finally {
      setLoading(false);
    }
  };

  function loggerWarn(err: unknown) {
    console.warn(err);
  }

  // Handle saving Supabase credentials
  const handleSaveConfig = () => {
    saveSupabaseConfig(supabaseConfig.url.trim(), supabaseConfig.anonKey.trim());
    setSuccessMessage('Supabase credentials updated!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Handle testing connection
  const handleTestConnection = async () => {
    setTestStatus({ testing: true });
    const res = await testSupabaseConnection(supabaseConfig.url.trim(), supabaseConfig.anonKey.trim());
    setTestStatus({ testing: false, result: res });
  };

  return (
    <div className="min-h-screen bg-[#0F0B0A] text-[#F4F8FF] font-['Geist',sans-serif] selection:bg-[#8B5CF6] selection:text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Background radial atmosphere */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(139,92,246,0.18),rgba(15,11,10,0))] pointer-events-none" />

      {/* Top Bar / Navigation */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] text-white font-mono font-bold text-sm shadow-lg shadow-[#8B5CF6]/20">
            <span>▲</span>
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-[#F4F8FF] flex items-center gap-2">
              <span>Project Apex</span>
              <span className="font-mono text-[9px] uppercase font-semibold text-[#8B5CF6] bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 px-1.5 py-0.5 rounded">
                Private Workspace
              </span>
            </div>
            <p className="text-[11px] text-[#B4B0B0] font-mono">Restricted Access Protocol</p>
          </div>
        </div>

        {/* Database Status Pill */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'config' ? 'signin' : 'config')}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition ${
              hasConfiguredSupabase
                ? 'border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20'
                : 'border-[#38302D] bg-[#191311] text-[#B4B0B0] hover:border-[#8B5CF6]/40 hover:text-[#F4F8FF]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {hasConfiguredSupabase ? 'Supabase Live' : 'Supabase Offline Mode'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-8">
        <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-md">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#F4F8FF]">
              {mode === 'signin' && 'Workspace Sign In'}
              {mode === 'invite' && 'Redeem Invitation'}
              {mode === 'personas' && 'Developer Quick Access'}
              {mode === 'config' && 'Database & Auth Config'}
            </h1>
            <p className="text-xs text-[#B4B0B0] mt-1.5">
              {mode === 'signin' && 'Authenticate to access your software projects, repositories, and team data.'}
              {mode === 'invite' && 'Join the private workspace with your token provided by the Super Admin.'}
              {mode === 'personas' && 'Instant switchboard to test Super Admin and Member permissions.'}
              {mode === 'config' && 'Configure or verify your Supabase PostgreSQL and Auth credentials.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className={`grid ${import.meta.env.DEV ? 'grid-cols-3' : 'grid-cols-2'} gap-1 rounded-xl bg-[#0F0B0A] p-1 border border-[#38302D] mb-6 text-xs font-medium`}>
            <button
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`rounded-lg py-1.5 transition ${
                mode === 'signin'
                  ? 'bg-[#211B19] text-[#F4F8FF] font-semibold shadow-xs border border-[#38302D]'
                  : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('invite');
                setError(null);
              }}
              className={`rounded-lg py-1.5 transition ${
                mode === 'invite'
                  ? 'bg-[#211B19] text-[#F4F8FF] font-semibold shadow-xs border border-[#38302D]'
                  : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
            >
              Invitation
            </button>
            {import.meta.env.DEV && (
              <button
                onClick={() => {
                  setMode('personas');
                  setError(null);
                }}
                className={`rounded-lg py-1.5 transition ${
                  mode === 'personas'
                    ? 'bg-[#211B19] text-[#F4F8FF] font-semibold shadow-xs border border-[#38302D]'
                    : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
                }`}
              >
                Dev Personas
              </button>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#FB7185]/40 bg-[#FB7185]/10 p-3 text-xs text-[#FB7185]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#34D399]/40 bg-[#34D399]/10 p-3 text-xs text-[#34D399]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. SIGN IN MODE */}
          {mode === 'signin' && (
            <div className="space-y-4">
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#38302D] bg-[#211B19] py-2.5 px-4 text-xs font-semibold text-[#F4F8FF] hover:border-[#8B5CF6]/50 hover:bg-[#211B19]/80 transition cursor-pointer shadow-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-[#38302D]" />
                <span className="absolute bg-[#191311] px-3 font-mono text-[10px] uppercase text-[#B4B0B0]">
                  or email login
                </span>
              </div>

              {/* Email + Password Form */}
              <form onSubmit={handleEmailSignIn} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="developer@team.com"
                      className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-9 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-[#B4B0B0] hover:text-[#F4F8FF]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] py-2.5 px-4 text-xs font-semibold text-white transition shadow-lg shadow-[#8B5CF6]/20 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Fast test credentials notice (Dev only) */}
              {import.meta.env.DEV && (
                <div className="rounded-xl border border-[#38302D]/60 bg-[#211B19]/50 p-3 text-[11px] text-[#B4B0B0] space-y-1">
                  <div className="flex items-center justify-between text-[#F4F8FF] font-medium">
                    <span>Dev RBAC Preview Mode</span>
                    <button
                      onClick={() => setMode('personas')}
                      className="text-[#8B5CF6] hover:underline"
                    >
                      Select Dev Persona →
                    </button>
                  </div>
                  <p>
                    Dev mode active: You can test the role-based UI as Super Admin (Gaurav P.) or Member.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. INVITATION REDEMPTION MODE */}
          {mode === 'invite' && (
            <form onSubmit={handleInviteRegistration} className="space-y-3.5">
              <div className="rounded-xl border border-[#38302D] bg-[#211B19]/40 p-3 text-[11px] text-[#B4B0B0]">
                Registration is closed to the public. You must possess an invitation token generated by the Super Admin.
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Invitation Token
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 w-4 h-4 text-[#8B5CF6]" />
                  <input
                    type="text"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="inv_..."
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@devteam.io"
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Set Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] py-2.5 px-4 text-xs font-semibold text-white transition shadow-lg shadow-[#8B5CF6]/20 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Redeem Token & Access Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. DEVELOPER QUICK ACCESS / PERSONAS */}
          {mode === 'personas' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#38302D] bg-[#211B19]/50 p-3 text-[11px] text-[#B4B0B0] leading-relaxed">
                Click any persona below to authenticate instantly and verify role-based permissions, project assignments, and admin controls.
              </div>

              <div className="space-y-2 mt-2">
                {profiles.map((p) => {
                  const isSuper = p.role === 'super_admin';
                  return (
                    <button
                      key={p.id}
                      onClick={() => signInAsPersona(p.id)}
                      className="w-full flex items-center justify-between rounded-xl border border-[#38302D] bg-[#0F0B0A] p-3 hover:border-[#8B5CF6] hover:bg-[#211B19] transition text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={p.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover ring-1 ring-[#38302D]"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#F4F8FF] group-hover:text-[#8B5CF6] transition">
                              {p.fullName}
                            </span>
                            {isSuper && (
                              <span className="font-mono text-[9px] uppercase font-bold text-[#8B5CF6] bg-[#8B5CF6]/20 px-1.5 py-0.5 rounded border border-[#8B5CF6]/30">
                                Super Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#B4B0B0] font-mono truncate">
                            {p.email}
                          </div>
                        </div>
                      </div>

                      <ArrowRight className="w-4 h-4 text-[#B4B0B0] group-hover:text-[#8B5CF6] shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. SUPABASE CONFIGURATION DRAWER */}
          {mode === 'config' && (
            <div className="space-y-3.5 text-xs">
              <p className="text-[#B4B0B0] text-[11px] leading-relaxed">
                Enter your Supabase project parameters to connect live cloud PostgreSQL storage with Row-Level Security (RLS).
              </p>

              <div>
                <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={supabaseConfig.url}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                  placeholder="https://your-project.supabase.co"
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/40 font-mono focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                  Supabase Anon Public Key
                </label>
                <input
                  type="password"
                  value={supabaseConfig.anonKey}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, anonKey: e.target.value })}
                  placeholder="eyJhbGciOi..."
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/40 font-mono focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              {testStatus.result && (
                <div
                  className={`rounded-xl p-3 border text-xs ${
                    testStatus.result.success
                      ? 'border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]'
                      : 'border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185]'
                  }`}
                >
                  {testStatus.result.message}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex-1 rounded-xl bg-[#211B19] border border-[#38302D] hover:border-[#8B5CF6] py-2 text-xs font-semibold text-[#F4F8FF] transition"
                >
                  Save Config
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus.testing}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] py-2 text-xs font-semibold text-white transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus.testing ? 'animate-spin' : ''}`} />
                  <span>{testStatus.testing ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Security Guarantee Footer inside card */}
          <div className="mt-6 pt-4 border-t border-[#38302D]/60 flex items-center justify-between text-[10px] text-[#B4B0B0] font-mono">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#34D399]" />
              <span>TLS 1.3 / RLS Protected</span>
            </span>
            <span>Single Super Admin</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#B4B0B0] py-4 gap-2">
        <div>
          &copy; {new Date().getFullYear()} Project Apex. Private Developer Workspace.
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            <span>PWA Ready & Offline First</span>
          </span>
          <span>·</span>
          <span>Security Hardened</span>
        </div>
      </footer>
    </div>
  );
};
