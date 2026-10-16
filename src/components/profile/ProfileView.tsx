import React, { useState } from 'react';
import {
  User,
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  Key,
  LogOut,
  Bell,
  Palette,
  Github,
  Lock,
  RefreshCw,
  QrCode,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getSupabaseClient } from '../../lib/supabase';

export const ProfileView: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    updateCurrentUserProfile,
    resetPassword,
    signOut,
  } = useWorkspace();

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [githubUsername, setGithubUsername] = useState(currentUser?.githubUsername || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');

  // Preferences
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);

  // States
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password reset flow
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // MFA Enrollment Flow
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Display name is required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      if (updateCurrentUserProfile) {
        await updateCurrentUserProfile({
          fullName: fullName.trim(),
          bio: bio.trim(),
          githubUsername: githubUsername.trim().replace(/^@/, ''),
          avatarUrl: avatarUrl.trim() || undefined,
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!currentUser?.email) return;
    setIsSendingReset(true);
    setError(null);
    try {
      const res = await resetPassword(currentUser.email);
      if (res.error) {
        setError(res.error.message);
      } else {
        setResetSent(true);
        setTimeout(() => setResetSent(false), 5000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send recovery email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleStartMfaEnrollment = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Supabase connection is required to configure TOTP Multi-Factor Authentication.');
      return;
    }

    setMfaLoading(true);
    setError(null);

    try {
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'DEBPTH Workspace',
      });

      if (enrollErr) {
        throw enrollErr;
      }

      if (data) {
        setMfaFactorId(data.id);
        setMfaQrCode(data.totp.qr_code);
        setMfaSecret(data.totp.secret);
        setIsEnrollingMfa(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initialize MFA enrollment.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMfaEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !mfaFactorId || !mfaVerifyCode) return;

    setMfaLoading(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });

      if (challengeErr) throw challengeErr;

      const { data: verifyData, error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaVerifyCode.trim(),
      });

      if (verifyErr) throw verifyErr;

      setMfaSuccess(true);
      setIsEnrollingMfa(false);
      // Update local profile MFA status
      if (updateCurrentUserProfile) {
        await updateCurrentUserProfile({ mfaEnabled: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid verification code. Please check your authenticator app.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (!mfaSecret) return;
    navigator.clipboard.writeText(mfaSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* 1. Header Card */}
      <section className="relative overflow-hidden rounded-2xl border border-[#38302D] bg-[#191311] p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative shrink-0">
            <img
              src={
                currentUser?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
              }
              alt={currentUser?.fullName || 'User Profile'}
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-[#8B5CF6]/40 shadow-lg bg-[#0F0B0A]"
            />
            <span
              className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-[#191311] ${
                currentUser?.mfaEnabled ? 'bg-[#34D399]' : 'bg-[#FB7185]'
              }`}
              title={currentUser?.mfaEnabled ? 'MFA Enabled' : 'MFA Inactive'}
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#F4F8FF]">
                  {currentUser?.fullName || 'Workspace Member'}
                </h1>
                <p className="text-xs font-mono text-[#B4B0B0]">
                  {currentUser?.email}
                </p>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono uppercase font-semibold border ${
                    isSuperAdmin
                      ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30'
                      : 'bg-[#211B19] text-[#B4B0B0] border-[#38302D]'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{isSuperAdmin ? 'Super Admin' : 'Workspace Member'}</span>
                </span>
              </div>
            </div>

            <p className="text-xs text-[#B4B0B0] max-w-xl">
              {currentUser?.bio || 'No personal bio added yet. Tell your team about your engineering domain.'}
            </p>
          </div>
        </div>
      </section>

      {/* Global Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-[#FB7185]/30 bg-[#FB7185]/10 text-xs text-[#FB7185]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-[#34D399]/30 bg-[#34D399]/10 text-xs text-[#34D399]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profile changes saved and synchronized successfully.</span>
        </div>
      )}

      {resetSent && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-[#34D399]/30 bg-[#34D399]/10 text-xs text-[#34D399]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Password recovery link dispatched to {currentUser?.email}. Check your inbox.</span>
        </div>
      )}

      {mfaSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-[#34D399]/30 bg-[#34D399]/10 text-xs text-[#34D399]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Authenticator app verified! Two-Factor Authentication is now active.</span>
        </div>
      )}

      {/* 2. Profile Details Form */}
      <section className="rounded-2xl border border-[#38302D] bg-[#191311] p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#38302D] pb-3">
          <h2 className="text-base font-semibold text-[#F4F8FF]">Profile Information</h2>
          <p className="text-xs text-[#B4B0B0]">
            Update your public persona within the engineering workspace.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                Display Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Patel Gaurav"
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                GitHub Username
              </label>
              <div className="relative">
                <Github className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
                <input
                  type="text"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  placeholder="e.g. gaurav-tacles"
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
              Avatar Image URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
              Short Bio & Technical Focus
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Lead architect focusing on full-stack systems, RLS security policies, and performance."
              className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
            />
          </div>

          {/* Read-Only Account Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#38302D]/60">
            <div>
              <span className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                Account Email (Protected)
              </span>
              <div className="p-2 rounded-xl bg-[#0F0B0A] border border-[#38302D] text-xs font-mono text-[#B4B0B0]">
                {currentUser?.email}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                Authorization Role (Database Enforced)
              </span>
              <div className="p-2 rounded-xl bg-[#0F0B0A] border border-[#38302D] text-xs font-mono text-[#8B5CF6] flex items-center justify-between">
                <span>{currentUser?.role === 'super_admin' ? 'SUPER_ADMIN' : 'MEMBER'}</span>
                <span className="text-[10px] text-[#34D399] font-sans">Verified</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Account Security & MFA */}
      <section className="rounded-2xl border border-[#38302D] bg-[#191311] p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#38302D] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#F4F8FF]">Account Security & MFA</h2>
            <p className="text-xs text-[#B4B0B0]">
              Protect destructive workspace operations with verified Two-Factor Authentication.
            </p>
          </div>

          {currentUser?.mfaEnabled ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>MFA Enrolled</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#FB7185]/15 text-[#FB7185] border border-[#FB7185]/30">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>MFA Required for Deletions</span>
            </span>
          )}
        </div>

        {/* MFA Setup Panel */}
        {isEnrollingMfa ? (
          <div className="rounded-xl border border-[#8B5CF6]/40 bg-[#0F0B0A] p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-[#8B5CF6] font-semibold text-sm">
              <Smartphone className="w-4 h-4" />
              <span>Configure Authenticator App (TOTP)</span>
            </div>

            <p className="text-[#B4B0B0] leading-relaxed">
              Scan this QR code with Google Authenticator, Apple Passwords, or 1Password, then enter the 6-digit confirmation code below.
            </p>

            {mfaQrCode && (
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#191311] p-4 rounded-xl border border-[#38302D]">
                <img
                  src={mfaQrCode}
                  alt="MFA QR Code"
                  className="w-36 h-36 rounded-lg bg-white p-2"
                />

                <div className="space-y-2 flex-1">
                  <span className="text-[11px] text-[#B4B0B0] block">
                    Can&apos;t scan? Copy your manual setup key:
                  </span>
                  <div className="flex items-center gap-2 bg-[#0F0B0A] p-2 rounded-lg border border-[#38302D]">
                    <code className="text-[#8B5CF6] font-mono text-[11px] truncate flex-1">
                      {mfaSecret}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="px-2 py-1 rounded bg-[#211B19] text-[#F4F8FF] hover:bg-[#38302D] text-[11px]"
                    >
                      {copiedSecret ? <Check className="w-3 h-3 text-[#34D399]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyMfaEnrollment} className="flex items-center gap-3">
              <input
                type="text"
                required
                maxLength={6}
                value={mfaVerifyCode}
                onChange={(e) => setMfaVerifyCode(e.target.value)}
                placeholder="Enter 6-digit code (e.g. 123456)"
                className="flex-1 rounded-xl border border-[#38302D] bg-[#191311] px-3 py-2 text-xs text-[#F4F8FF] font-mono text-center tracking-widest focus:border-[#8B5CF6] focus:outline-none"
              />
              <button
                type="submit"
                disabled={mfaLoading || mfaVerifyCode.length < 6}
                className="rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {mfaLoading ? 'Verifying...' : 'Verify & Enable'}
              </button>
              <button
                type="button"
                onClick={() => setIsEnrollingMfa(false)}
                className="rounded-xl bg-[#211B19] px-3 py-2 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                Cancel
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#38302D] bg-[#0F0B0A]">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#F4F8FF]">
                Two-Factor Authenticator (TOTP)
              </div>
              <p className="text-[11px] text-[#B4B0B0]">
                {currentUser?.mfaEnabled
                  ? 'Your account requires TOTP challenge verification for all destructive project deletions.'
                  : 'Enroll a TOTP authenticator app to enable protected deletion of projects, tasks, and notes.'}
              </p>
            </div>

            <button
              onClick={handleStartMfaEnrollment}
              disabled={mfaLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-xs font-medium text-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition shrink-0 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{currentUser?.mfaEnabled ? 'Reconfigure MFA' : 'Enroll MFA Authenticator'}</span>
            </button>
          </div>
        )}

        {/* Password Reset Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#38302D] bg-[#0F0B0A]">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#F4F8FF]">Password Management</div>
            <p className="text-[11px] text-[#B4B0B0]">
              Send a cryptographically secure Supabase password recovery link to your registered email.
            </p>
          </div>

          <button
            onClick={handleSendPasswordReset}
            disabled={isSendingReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#38302D] bg-[#211B19] text-xs font-medium text-[#F4F8FF] hover:border-[#8B5CF6] transition shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isSendingReset ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5 text-[#8B5CF6]" />}
            <span>Send Password Reset Link</span>
          </button>
        </div>
      </section>

      {/* 4. Workspace Preferences */}
      <section className="rounded-2xl border border-[#38302D] bg-[#191311] p-6 sm:p-8 space-y-4">
        <div className="border-b border-[#38302D] pb-3">
          <h2 className="text-base font-semibold text-[#F4F8FF]">Workspace Preferences</h2>
          <p className="text-xs text-[#B4B0B0]">
            Customize notifications and presentation options.
          </p>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-xl bg-[#0F0B0A] border border-[#38302D] cursor-pointer">
            <div>
              <span className="font-medium text-[#F4F8FF] block">Project Activity Alerts</span>
              <span className="text-[11px] text-[#B4B0B0]">Receive updates when tasks or milestones change</span>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="rounded border-[#38302D] bg-[#191311] text-[#8B5CF6] focus:ring-[#8B5CF6]"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#0F0B0A] border border-[#38302D] cursor-pointer">
            <div>
              <span className="font-medium text-[#F4F8FF] block">Direct Task Assignments</span>
              <span className="text-[11px] text-[#B4B0B0]">Notify me when assigned to a task or issue</span>
            </div>
            <input
              type="checkbox"
              checked={taskReminders}
              onChange={(e) => setTaskReminders(e.target.checked)}
              className="rounded border-[#38302D] bg-[#191311] text-[#8B5CF6] focus:ring-[#8B5CF6]"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#0F0B0A] border border-[#38302D] cursor-pointer">
            <div>
              <span className="font-medium text-[#F4F8FF] block">Security & Access Events</span>
              <span className="text-[11px] text-[#B4B0B0]">Alert me immediately on new sessions or deletions</span>
            </div>
            <input
              type="checkbox"
              checked={securityAlerts}
              onChange={(e) => setSecurityAlerts(e.target.checked)}
              className="rounded border-[#38302D] bg-[#191311] text-[#8B5CF6] focus:ring-[#8B5CF6]"
            />
          </label>
        </div>
      </section>

      {/* 5. Account Sign Out */}
      <section className="rounded-2xl border border-[#FB7185]/30 bg-[#FB7185]/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#FB7185]">Sign Out of Workspace</h3>
          <p className="text-xs text-[#B4B0B0] mt-0.5">
            Terminate your active Supabase session and secure token storage on this device.
          </p>
        </div>

        <button
          onClick={() => signOut()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#FB7185] hover:bg-[#F43F5E] text-white text-xs font-semibold shadow-md transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </section>
    </div>
  );
};
