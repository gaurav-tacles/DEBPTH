import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Shield,
  Clock,
  UserPlus,
  Mail,
  AlertCircle,
  FolderPlus,
  Info,
} from 'lucide-react';
import { UserRole, Project, ProjectRole } from '../../types';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  isSuperAdmin: boolean;
  preselectedProjectId?: string;
  onInvite: (
    email: string,
    role: UserRole,
    initialLabels: string[],
    assignedProjectIds: string[],
    expiresInDays: number,
    invitedProjectRole?: ProjectRole
  ) => { token?: string };
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  projects,
  isSuperAdmin,
  preselectedProjectId,
  onInvite,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [invitedProjectRole, setInvitedProjectRole] = useState<ProjectRole>('collaborator');
  const [labelsInput, setLabelsInput] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>(
    preselectedProjectId ? [preselectedProjectId] : []
  );
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }

    const labels = labelsInput
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const inv = onInvite(
        email.trim().toLowerCase(),
        role,
        labels,
        selectedProjects,
        expiresInDays,
        invitedProjectRole
      );
      if (inv.token) {
        setGeneratedToken(inv.token);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation.');
    }
  };

  const inviteLink = generatedToken
    ? `${window.location.origin}/#invite=${generatedToken}`
    : '';

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyToken = () => {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleToggleProject = (projId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projId) ? prev.filter((id) => id !== projId) : [...prev, projId]
    );
  };

  const handleResetAndClose = () => {
    setEmail('');
    setLabelsInput('');
    setGeneratedToken(null);
    setError(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#38302D] bg-[#191311] p-5 sm:p-6 shadow-2xl text-[#F4F8FF] max-h-[calc(100dvh-1.5rem)] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="invite-modal-title" className="font-semibold text-sm sm:text-base">
                {preselectedProjectId ? 'Invite Member to Project' : 'Invite Team Member'}
              </h3>
              <p className="text-[11px] text-[#B4B0B0] font-mono">
                Cryptographic single-use token authorization
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="rounded-lg p-1.5 text-[#B4B0B0] hover:bg-[#211B19] hover:text-[#F4F8FF] transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>{error}</div>
          </div>
        )}

        {generatedToken ? (
          <div className="mt-4 space-y-4 text-xs">
            {/* Success Card */}
            <div className="rounded-xl bg-[#34D399]/10 border border-[#34D399]/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-[#34D399]" />
                <span className="font-semibold text-[#34D399] text-sm">
                  Secure Invitation Generated
                </span>
              </div>
              <p className="text-[#F4F8FF] leading-relaxed text-xs">
                This token is cryptographically bound to <strong className="text-white underline">{email}</strong> and expires in {expiresInDays} days. Acceptance is atomic and single-use only.
              </p>

              {/* Direct Invitation Link */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-medium text-[#34D399]">
                  Copyable Direct Invitation Link:
                </label>
                <div className="flex items-center gap-2 bg-[#0F0B0A] p-2 rounded-lg border border-[#38302D]">
                  <code className="text-[#8B5CF6] font-mono text-[11px] truncate flex-1 select-all">
                    {inviteLink}
                  </code>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 transition cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Raw Token */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">
                  Raw Token (for manual entry on registration screen):
                </label>
                <div className="flex items-center gap-2 bg-[#0F0B0A] p-2 rounded-lg border border-[#38302D]">
                  <code className="text-[#B4B0B0] font-mono text-[11px] truncate flex-1 select-all">
                    {generatedToken}
                  </code>
                  <button
                    onClick={handleCopyToken}
                    className="flex items-center gap-1 bg-[#211B19] hover:bg-[#38302D] text-[#F4F8FF] border border-[#38302D] px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 transition cursor-pointer"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Email Provider Notice */}
            <div className="rounded-xl border border-[#38302D] bg-[#211B19]/50 p-3.5 space-y-1.5 text-[11px] text-[#B4B0B0] leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-[#F4F8FF]">
                <Mail className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Email Delivery Notice</span>
              </div>
              <p>
                No free email provider is currently configured with authenticated SMTP / API credentials. The invitation link has been safely generated above. Provide this link directly to <strong className="text-white">{email}</strong> to complete registration.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleResetAndClose}
                className="rounded-xl bg-[#211B19] border border-[#38302D] px-4 py-2 text-xs font-semibold text-[#F4F8FF] hover:bg-[#38302D] transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0] flex items-center justify-between">
                <span>Invitee Email Address <span className="text-rose-400">*</span></span>
                <span className="text-[10px] text-[#B4B0B0]/60 font-mono">Bound to invited account</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#B4B0B0]" />
                <input
                  type="email"
                  required
                  placeholder="colleague@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] pl-9 pr-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Workspace Role & Expiration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Workspace Membership Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="member">Standard Workspace Member</option>
                  {isSuperAdmin && (
                    <option value="super_admin">Super Admin (System Owner)</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Token Lifetime</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value={1}>24 Hours (High Security)</option>
                  <option value={7}>7 Days (Standard)</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </div>

            {/* Project Role if project attached */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0]">
                Project Role (for assigned projects)
              </label>
              <select
                value={invitedProjectRole}
                onChange={(e) => setInvitedProjectRole(e.target.value as ProjectRole)}
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none capitalize"
              >
                <option value="collaborator">Collaborator (Can manage tasks & docs)</option>
                <option value="viewer">Viewer (Read-only access)</option>
                <option value="maintainer">Maintainer (Technical leadership)</option>
                {isSuperAdmin && <option value="lead">Lead (Full project administration)</option>}
              </select>
            </div>

            {/* Member Labels */}
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

            {/* Project Assignment */}
            <div className="space-y-2 border-t border-[#38302D] pt-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-[#B4B0B0]">
                  Assign to Target Projects
                </label>
                <span className="text-[10px] text-[#B4B0B0]/60">
                  {selectedProjects.length} selected
                </span>
              </div>
              {projects.length === 0 ? (
                <p className="text-[11px] text-[#B4B0B0]/60 italic py-1">
                  No projects currently exist. Member will join workspace only.
                </p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
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
              )}
            </div>

            {/* Form Actions */}
            <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-[#38302D]">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="rounded px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED] shadow-sm transition cursor-pointer"
              >
                Generate Secure Invitation
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
