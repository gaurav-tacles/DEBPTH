import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  Key,
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
  RefreshCw,
  ArrowLeft,
  Info,
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
    signInWithEmail,
    signUpWithEmail,
    redeemInvitation,
    resetPassword,
    updatePassword,
    isPasswordRecovery,
    clearPasswordRecovery,
  } = useWorkspace();

  const [mode, setMode] = useState<'signin' | 'invite' | 'forgot' | 'reset-password' | 'config'>(() => {
    return isPasswordRecovery ? 'reset-password' : 'signin';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  // Switch to reset-password mode if password recovery hash/event is detected
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('reset-password');
      setError(null);
    }
  }, [isPasswordRecovery]);

  // Handle Email + Password Sign In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    if (!hasConfiguredSupabase) {
      setError(
        'Supabase authentication is not configured yet. Please enter your project URL and Anon key in the Database Config panel (top right) or configure .env.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
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
    if (!password || password.length < 6) {
      setError('Please choose a password with at least 6 characters.');
      return;
    }

    if (!hasConfiguredSupabase) {
      setError('Supabase credentials are required to complete account registration.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // 1. Redeem invitation and verify matching email and token validity
      try {
        redeemInvitation(inviteToken.trim(), fullName.trim(), email.trim());
      } catch (repoErr: unknown) {
        setError(repoErr instanceof Error ? repoErr.message : 'Invalid or expired invitation token.');
        setLoading(false);
        return;
      }

      setSuccessMessage('Invitation token verified! Registering account...');
      const res = await signUpWithEmail(email.trim(), password, fullName.trim(), inviteToken.trim());
      if (res.error) {
        setError(res.error.message || 'Failed to complete registration.');
      } else if (res.emailConfirmationRequired) {
        setSuccessMessage(
          'Registration submitted! A confirmation email has been sent. Please verify your email or sign in once confirmed.'
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to redeem invitation.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Requesting Password Reset Link
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    if (!hasConfiguredSupabase) {
      setError('Supabase is not configured. Please configure your project credentials to enable password recovery.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await resetPassword(email.trim());
      if (res.error) {
        setError(res.error.message || 'Failed to send password reset email.');
      } else {
        setSuccessMessage(
          `Password reset link sent to ${email.trim()}. Please check your email inbox (and spam folder) for instructions.`
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate password reset.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Setting New Password during Recovery
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await updatePassword(password);
      if (res.error) {
        setError(res.error.message || 'Failed to update password.');
      } else {
        setSuccessMessage('Password updated successfully! Signing you into your workspace...');
        setTimeout(() => {
          setMode('signin');
          clearPasswordRecovery();
        }, 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password update failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle saving Supabase credentials in browser storage
  const handleSaveConfig = () => {
    saveSupabaseConfig(supabaseConfig.url.trim(), supabaseConfig.anonKey.trim());
    setSuccessMessage('Supabase credentials saved successfully!');
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
              <span>ProjectHub</span>
              <span className="font-mono text-[9px] uppercase font-semibold text-[#8B5CF6] bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 px-1.5 py-0.5 rounded">
                Unified Portal
              </span>
            </div>
            <p className="text-[11px] text-[#B4B0B0] font-mono">Single Entry Authentication</p>
          </div>
        </div>

        {/* Database Status Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMode(mode === 'config' ? 'signin' : 'config');
              setError(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition cursor-pointer ${
              hasConfiguredSupabase
                ? 'border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20'
                : 'border-[#FB7185]/40 bg-[#FB7185]/10 text-[#FB7185] hover:border-[#FB7185]/60 hover:text-white'
            }`}
            title="Configure or test Supabase connection"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {hasConfiguredSupabase ? 'Supabase Connected' : 'Supabase Not Configured'}
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
              {mode === 'signin' && 'Sign In to Workspace'}
              {mode === 'invite' && 'Redeem Team Invitation'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset-password' && 'Set New Password'}
              {mode === 'config' && 'Database & Auth Config'}
            </h1>
            <p className="text-xs text-[#B4B0B0] mt-1.5 leading-relaxed">
              {mode === 'signin' &&
                'Single login portal for the Super Admin and all invited team members. Sign in with your email and password.'}
              {mode === 'invite' &&
                'Join the workspace using your single-use invitation token provided by the Super Admin.'}
              {mode === 'forgot' &&
                'Enter your account email. Supabase Auth will send you a secure password recovery link.'}
              {mode === 'reset-password' &&
                'Enter a new password for your account to complete password recovery.'}
              {mode === 'config' &&
                'Provide your Supabase URL and anon/publishable key to connect to live authentication.'}
            </p>
          </div>

          {/* Unconfigured Alert Banner */}
          {!hasConfiguredSupabase && mode !== 'config' && (
            <div className="mb-4 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-[#F59E0B]">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Supabase credentials needed</div>
                  <p className="mt-0.5 text-[11px] text-[#F59E0B]/90">
                    Live email & password authentication requires your Supabase project parameters. Click below to configure them.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode('config')}
                    className="mt-2 text-[11px] font-semibold underline hover:text-white"
                  >
                    Open Database & Auth Config →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs (Only in signin & invite modes) */}
          {(mode === 'signin' || mode === 'invite') && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#0F0B0A] p-1 border border-[#38302D] mb-6 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMessage(null);
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
                type="button"
                onClick={() => {
                  setMode('invite');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`rounded-lg py-1.5 transition ${
                  mode === 'invite'
                    ? 'bg-[#211B19] text-[#F4F8FF] font-semibold shadow-xs border border-[#38302D]'
                    : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
                }`}
              >
                Redeem Invitation
              </button>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#FB7185]/40 bg-[#FB7185]/10 p-3 text-xs text-[#FB7185]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#34D399]/40 bg-[#34D399]/10 p-3 text-xs text-[#34D399]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="realgauravpatel@gmail.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#B4B0B0]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-[#8B5CF6] hover:text-[#A78BFA] transition"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-9 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#B4B0B0] hover:text-[#F4F8FF] transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
          )}

          {/* 2. INVITATION REDEMPTION MODE */}
          {mode === 'invite' && (
            <form onSubmit={handleInviteRegistration} className="space-y-3.5">
              <div className="rounded-xl border border-[#38302D] bg-[#211B19]/40 p-3 text-[11px] text-[#B4B0B0] leading-relaxed">
                Registration is reserved for invited team members. Enter the invitation token issued by the Super Admin to activate your standard member access.
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Invitation Token *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 w-4 h-4 text-[#8B5CF6]" />
                  <input
                    type="text"
                    required
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="inv_..."
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Invited Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@domain.com"
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Account Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="•••••••••••• (min 6 chars)"
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-9 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#B4B0B0] hover:text-[#F4F8FF] transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                    <span>Verify Token & Complete Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. FORGOT PASSWORD MODE */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="realgauravpatel@gmail.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
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
                    <span>Send Password Reset Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF] transition pt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </form>
          )}

          {/* 4. SET NEW PASSWORD (RECOVERY) MODE */}
          {mode === 'reset-password' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="•••••••••••• (min 6 chars)"
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-9 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#B4B0B0] hover:text-[#F4F8FF] transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B4B0B0] mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-9 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-[#B4B0B0] hover:text-[#F4F8FF] transition cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    <span>Update Password & Enter Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  clearPasswordRecovery();
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF] transition pt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </form>
          )}

          {/* 5. SUPABASE CONFIGURATION DRAWER */}
          {mode === 'config' && (
            <div className="space-y-3.5 text-xs">
              <p className="text-[#B4B0B0] text-[11px] leading-relaxed">
                Configure your Supabase project parameters below to connect to live authentication and PostgreSQL storage.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={supabaseConfig.url}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                  placeholder="https://xyzcompany.supabase.co"
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
                  className="flex-1 rounded-xl bg-[#211B19] border border-[#38302D] hover:border-[#8B5CF6] py-2 text-xs font-semibold text-[#F4F8FF] transition cursor-pointer"
                >
                  Save Config
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus.testing}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] py-2 text-xs font-semibold text-white transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus.testing ? 'animate-spin' : ''}`} />
                  <span>{testStatus.testing ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF] transition pt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          )}

          {/* Security Guarantee Footer inside card */}
          <div className="mt-6 pt-4 border-t border-[#38302D]/60 flex items-center justify-between text-[10px] text-[#B4B0B0] font-mono">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#34D399]" />
              <span>TLS / PostgreSQL RLS Enforced</span>
            </span>
            <span>Single Super Admin</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#B4B0B0] py-4 gap-2">
        <div>
          &copy; {new Date().getFullYear()} ProjectHub. Private Developer Workspace.
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            <span>PWA Ready & Offline First</span>
          </span>
          <span>·</span>
          <span>Server-Side Super Admin</span>
        </div>
      </footer>
    </div>
  );
};
