import React, { useState } from 'react';
import { X, UserCheck, Key } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface RedeemInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialToken?: string;
}

export const RedeemInviteModal: React.FC<RedeemInviteModalProps> = ({
  isOpen,
  onClose,
  initialToken = '',
}) => {
  const { redeemInvitation, invitations } = useWorkspace();
  const [token, setToken] = useState(initialToken);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      redeemInvitation(token.trim(), fullName.trim());
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const pendingInvitations = invitations.filter(
    (inv) => !inv.acceptedAt && new Date(inv.expiresAt) > new Date()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#38302D] bg-[#191311] p-6 shadow-2xl text-[#F4F8FF]">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#8B5CF6]" />
            <h3 className="font-semibold text-sm">Redeem Workspace Token</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#B4B0B0] hover:text-[#F4F8FF]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#34D399]/20 text-[#34D399]">
              <UserCheck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-[#34D399]">Welcome to Project Apex!</h4>
            <p className="text-xs text-[#B4B0B0]">
              Invitation successfully accepted. You are now logged in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            {error && (
              <div className="rounded-xl bg-[#FB7185]/10 border border-[#FB7185]/30 p-2.5 text-[#FB7185] text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0]">Invitation Token *</label>
              <input
                type="text"
                required
                placeholder="df_inv_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none font-mono"
              />
            </div>

            {import.meta.env.DEV && pendingInvitations.length > 0 && (
              <div className="rounded-xl border border-[#38302D] bg-[#0F0B0A] p-2.5 space-y-1">
                <span className="text-[10px] text-[#B4B0B0] font-mono uppercase tracking-wider block">
                  Dev Preview — Pending Tokens:
                </span>
                {pendingInvitations.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => {
                      setToken(inv.token);
                      setFullName(inv.email.split('@')[0].replace('.', ' ').toUpperCase());
                    }}
                    className="w-full text-left font-mono text-[11px] text-[#8B5CF6] hover:underline truncate"
                  >
                    {inv.email} ({inv.token})
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0]">Your Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Jordan Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#38302D]">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED]"
              >
                Join Workspace
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
