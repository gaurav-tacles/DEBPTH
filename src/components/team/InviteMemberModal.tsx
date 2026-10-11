import React, { useState } from 'react';
import { X, Send, Copy, Check, Shield, Clock, UserPlus } from 'lucide-react';
import { UserRole, Project } from '../../types';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onInvite: (
    email: string,
    role: UserRole,
    initialLabels: string[],
    assignedProjectIds: string[],
    expiresInDays: number
  ) => { token: string };
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  projects,
  onInvite,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [labelsInput, setLabelsInput] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const labels = labelsInput
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);

    const inv = onInvite(email.trim(), role, labels, selectedProjects, expiresInDays);
    setGeneratedToken(inv.token);
  };

  const handleCopy = () => {
    if (!generatedToken) return;
    const inviteLink = `${window.location.origin}/#invite=${generatedToken}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleProject = (projId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projId) ? prev.filter((id) => id !== projId) : [...prev, projId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#38302D] bg-[#191311] p-6 shadow-2xl text-[#F4F8FF]">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="font-semibold text-sm">Invite Team Member</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#B4B0B0] hover:text-[#F4F8FF]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {generatedToken ? (
          <div className="mt-4 space-y-4 text-xs">
            <div className="rounded-xl bg-[#34D399]/10 border border-[#34D399]/30 p-4">
              <div className="font-semibold text-[#34D399] text-sm mb-1">
                Single-Use Invitation Generated
              </div>
              <p className="text-[#F4F8FF] leading-relaxed">
                This token is cryptographically tied to <strong className="text-white">{email}</strong> and expires in {expiresInDays} days. Self-registration without an invitation is strictly blocked.
              </p>

              <div className="mt-3 flex items-center gap-2 bg-[#0F0B0A] p-2.5 rounded-lg border border-[#38302D]">
                <code className="text-[#8B5CF6] font-mono text-[11px] truncate flex-1">
                  {generatedToken}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-3 py-1 rounded-md text-xs font-semibold shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Token'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="rounded-lg bg-[#211B19] border border-[#38302D] px-4 py-2 text-xs font-semibold text-[#F4F8FF] hover:bg-[#38302D]"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0]">Email Address *</label>
              <input
                type="email"
                required
                placeholder="colleague@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Workspace Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="member">Standard Member</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Token Expiration</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value={1}>24 Hours</option>
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0]">
                Initial Member Labels (comma-separated skills)
              </label>
              <input
                type="text"
                placeholder="e.g. Backend, Security, Rust"
                value={labelsInput}
                onChange={(e) => setLabelsInput(e.target.value)}
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>

            <div className="space-y-2 border-t border-[#38302D] pt-3">
              <label className="text-[11px] font-medium text-[#B4B0B0]">
                Assign to Initial Projects
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {projects.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#211B19] text-[#F4F8FF] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(p.id)}
                      onChange={() => handleToggleProject(p.id)}
                      className="rounded border-[#38302D] bg-[#0F0B0A] text-[#8B5CF6]"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-[#38302D]">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED] shadow-sm transition"
              >
                Generate Single-Use Invitation
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
