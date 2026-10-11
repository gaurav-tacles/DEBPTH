import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Lock,
  RefreshCw,
  X,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';

interface SecureDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'Project' | 'Task' | 'Personal Idea';
  itemName: string;
  itemId: string;
  cascadingNotes?: string[];
  onConfirmDelete: () => Promise<void>;
  onNavigateToSecurity?: () => void;
}

export const SecureDeleteConfirmModal: React.FC<SecureDeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemName,
  itemId,
  cascadingNotes,
  onConfirmDelete,
  onNavigateToSecurity,
}) => {
  const { currentUser, isSuperAdmin } = useWorkspace();
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase MFA factors state
  const [hasEnrolledMfa, setHasEnrolledMfa] = useState<boolean | null>(null);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [checkingMfa, setCheckingMfa] = useState(false);

  // Check MFA status when modal opens
  useEffect(() => {
    if (!isOpen) {
      setTypedConfirmation('');
      setTotpCode('');
      setError(null);
      return;
    }

    const checkMfaStatus = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Local mode
        setHasEnrolledMfa(currentUser?.mfaEnabled ?? false);
        return;
      }

      setCheckingMfa(true);
      try {
        const { data, error: factorsErr } = await supabase.auth.mfa.listFactors();
        if (factorsErr) throw factorsErr;

        const verifiedTotp = data?.totp?.find((f) => f.status === 'verified');
        if (verifiedTotp) {
          setHasEnrolledMfa(true);
          setTotpFactorId(verifiedTotp.id);
        } else {
          // Check if unverified factor exists or none
          setHasEnrolledMfa(currentUser?.mfaEnabled ?? false);
          if (data?.totp?.[0]) {
            setTotpFactorId(data.totp[0].id);
          }
        }
      } catch (err) {
        setHasEnrolledMfa(currentUser?.mfaEnabled ?? false);
      } finally {
        setCheckingMfa(false);
      }
    };

    checkMfaStatus();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const isSuperAdminAuthorized =
    isSuperAdmin && currentUser?.email.toLowerCase() === 'realgauravpatel@gmail.com';

  const handleExecuteDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typedConfirmation.trim().toUpperCase() !== 'DELETE') {
      setError('Please type DELETE to confirm destructive intent.');
      return;
    }

    if (!isSuperAdminAuthorized) {
      setError('Destructive operations are restricted exclusively to the Super Admin account (realgauravpatel@gmail.com).');
      return;
    }

    if (!hasEnrolledMfa) {
      setError('MFA verification is required. You must enroll an authenticator app before performing deletions.');
      return;
    }

    if (!totpCode.trim() || totpCode.trim().length < 6) {
      setError('Please enter your 6-digit authenticator TOTP verification code.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      if (supabase && totpFactorId) {
        // Step-up verification via Supabase MFA challenge
        const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
          factorId: totpFactorId,
        });

        if (challengeErr) throw challengeErr;

        const { error: verifyErr } = await supabase.auth.mfa.verify({
          factorId: totpFactorId,
          challengeId: challengeData.id,
          code: totpCode.trim(),
        });

        if (verifyErr) {
          throw new Error('MFA challenge rejected. The 6-digit TOTP code is incorrect or expired.');
        }
      }

      // Execute authorized deletion
      await onConfirmDelete();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-[#FB7185]/40 bg-[#191311] p-6 shadow-2xl text-[#F4F8FF] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#38302D]">
          <div className="flex items-center gap-2.5 text-[#FB7185]">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h3 className="font-bold text-sm tracking-tight text-[#F4F8FF]">
              Super Admin Protected Deletion
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isVerifying}
            className="rounded-lg p-1 text-[#B4B0B0] hover:text-[#F4F8FF] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Information */}
        <div className="rounded-xl border border-[#FB7185]/30 bg-[#FB7185]/5 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-[#FB7185]">
            <AlertTriangle className="w-4 h-4" />
            <span>Permanent Irreversible Deletion</span>
          </div>
          <p className="text-[#F4F8FF] leading-relaxed">
            You are about to permanently delete the {itemType}:{' '}
            <strong className="text-white font-mono bg-[#0F0B0A] px-1.5 py-0.5 rounded border border-[#38302D]">
              {itemName}
            </strong>
          </p>

          {cascadingNotes && cascadingNotes.length > 0 && (
            <div className="pt-2 border-t border-[#FB7185]/20 space-y-1">
              <span className="text-[11px] font-medium text-[#B4B0B0] block">
                Cascading dependencies that will be removed:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#B4B0B0]">
                {cascadingNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3 rounded-xl border border-[#FB7185]/40 bg-[#FB7185]/10 text-xs text-[#FB7185]">
            {error}
          </div>
        )}

        {/* Security Warning if user is not Super Admin */}
        {!isSuperAdminAuthorized ? (
          <div className="p-4 rounded-xl border border-[#FB7185]/40 bg-[#0F0B0A] text-xs space-y-2">
            <span className="font-semibold text-[#FB7185] block">Access Denied</span>
            <p className="text-[#B4B0B0]">
              Destructive actions are protected by database policy and restricted exclusively to{' '}
              <span className="font-mono text-white">realgauravpatel@gmail.com</span>.
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-[#211B19] text-xs font-semibold text-[#F4F8FF]"
              >
                Close
              </button>
            </div>
          </div>
        ) : !hasEnrolledMfa && !checkingMfa ? (
          /* MFA Enrollment Blocker */
          <div className="p-4 rounded-xl border border-[#F59E0B]/40 bg-[#0F0B0A] text-xs space-y-3">
            <div className="flex items-center gap-2 text-[#F59E0B] font-semibold">
              <Smartphone className="w-4 h-4" />
              <span>Multi-Factor Authentication Required</span>
            </div>
            <p className="text-[#B4B0B0] leading-relaxed">
              Super Admin destructive operations require a verified second factor. Your account has not yet enrolled an active TOTP authenticator app.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-[#211B19] text-xs text-[#B4B0B0]"
              >
                Cancel
              </button>
              {onNavigateToSecurity && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToSecurity();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-semibold text-white cursor-pointer"
                >
                  <span>Enroll MFA in Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Full Deletion & MFA Form */
          <form onSubmit={handleExecuteDelete} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                Type <span className="font-mono text-white font-bold">DELETE</span> to confirm *
              </label>
              <input
                type="text"
                required
                value={typedConfirmation}
                onChange={(e) => setTypedConfirmation(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] font-mono tracking-wider focus:border-[#FB7185] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#B4B0B0] mb-1">
                Enter 6-Digit Authenticator TOTP Code *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#8B5CF6]" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="e.g. 849201"
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] font-mono tracking-widest focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-[#B4B0B0]/70 mt-1 block">
                Fresh second-factor challenge verified with Supabase Auth.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#38302D]">
              <button
                type="button"
                onClick={onClose}
                disabled={isVerifying}
                className="px-3.5 py-2 rounded-xl text-xs text-[#B4B0B0] hover:text-[#F4F8FF] transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isVerifying ||
                  typedConfirmation.trim().toUpperCase() !== 'DELETE' ||
                  totpCode.trim().length < 6
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FB7185] hover:bg-[#F43F5E] text-xs font-semibold text-white shadow-lg shadow-[#FB7185]/20 transition disabled:opacity-40 cursor-pointer"
              >
                {isVerifying ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                <span>Verify MFA & Delete Permanently</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
