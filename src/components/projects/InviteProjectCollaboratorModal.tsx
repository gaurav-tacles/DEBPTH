import React, { useState } from 'react';
import { X, Send, Copy, Check, Clock, UserPlus, Mail, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ProjectRole, ProjectPermission, Project } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';

interface InviteProjectCollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const InviteProjectCollaboratorModal: React.FC<InviteProjectCollaboratorModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const { createProjectInvitation } = useWorkspace();

  const [email, setEmail] = useState('');
  const [projectRole, setProjectRole] = useState<ProjectRole>('collaborator');
  const [canManageTasks, setCanManageTasks] = useState(true);
  const [canUploadDocs, setCanUploadDocs] = useState(true);
  const [canViewMetrics, setCanViewMetrics] = useState(true);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(7);

  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [expiresAtDate, setExpiresAtDate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: ProjectRole) => {
    setProjectRole(newRole);
    if (newRole === 'lead') {
      setCanManageTasks(true);
      setCanUploadDocs(true);
      setCanViewMetrics(true);
      setCanManageMembers(true);
    } else if (newRole === 'maintainer') {
      setCanManageTasks(true);
      setCanUploadDocs(true);
      setCanViewMetrics(true);
      setCanManageMembers(false);
    } else if (newRole === 'collaborator') {
      setCanManageTasks(true);
      setCanUploadDocs(true);
      setCanViewMetrics(true);
      setCanManageMembers(false);
    } else if (newRole === 'viewer') {
      setCanManageTasks(false);
      setCanUploadDocs(false);
      setCanViewMetrics(true);
      setCanManageMembers(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please provide an email address.');
      return;
    }

    try {
      const permissions: ProjectPermission = {
        canManageTasks,
        canUploadDocs,
        canViewMetrics,
        canManageMembers,
      };

      const inv = createProjectInvitation(
        project.id,
        email.trim(),
        projectRole,
        permissions,
        expiresInDays
      );

      const token = inv.token || '';
      const inviteLink = `${window.location.origin}/#invite=${token}`;
      setGeneratedInviteLink(inviteLink);
      setExpiresAtDate(inv.expiresAt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project invitation.');
    }
  };

  const handleCopy = () => {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoUrl = generatedInviteLink
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
        `Invitation to collaborate on ${project.name}`
      )}&body=${encodeURIComponent(
        `Hello,\n\nYou have been invited to collaborate on "${project.name}" as a ${projectRole}.\n\nAccept your secure invitation here (expires in ${expiresInDays} days):\n${generatedInviteLink}\n\nNote: You must accept this invitation with this email address (${email}).\n\nBest regards,\n${project.name} Team`
      )}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#120D0B] p-5 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Invite Project Collaborator</h3>
              <p className="text-[11px] text-slate-400">
                Direct collaborator access to <strong className="text-white">{project.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {generatedInviteLink ? (
          /* Result Screen */
          <div className="mt-4 space-y-4 text-xs animate-fade-in">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Collaborator Invitation Created</span>
              </div>
              <p className="text-slate-200 text-[11px] leading-relaxed">
                Single-use invite issued to <strong className="text-white underline">{email}</strong> as{' '}
                <strong className="text-white capitalize">{projectRole}</strong>.
              </p>

              {expiresAtDate && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Expires on {new Date(expiresAtDate).toLocaleDateString()} at{' '}
                    {new Date(expiresAtDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              {/* Secure Link Box */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Secure Invitation Link
                </label>
                <div className="flex items-center gap-2 bg-[#0A0706] p-2 rounded-lg border border-slate-800">
                  <input
                    readOnly
                    value={generatedInviteLink}
                    className="bg-transparent text-indigo-400 font-mono text-[11px] truncate flex-1 outline-none select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md text-xs font-semibold shrink-0 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Email Client Option */}
              <div className="pt-1">
                <a
                  href={mailtoUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
                >
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open in Mail Client</span>
                </a>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-rose-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Collaborator Email *</label>
              <input
                type="email"
                required
                placeholder="developer@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#0A0706] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Project Role</label>
                <select
                  value={projectRole}
                  onChange={(e) => handleRoleChange(e.target.value as ProjectRole)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0A0706] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="collaborator">Collaborator</option>
                  <option value="maintainer">Maintainer</option>
                  <option value="lead">Lead</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Token Expiry</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#0A0706] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value={1}>24 Hours</option>
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </div>

            {/* Granular Permissions */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="text-[10px] uppercase font-mono text-slate-400">
                Collaborator Permissions
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={canManageTasks}
                  onChange={(e) => setCanManageTasks(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                />
                <span>Can create and update project tasks</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={canUploadDocs}
                  onChange={(e) => setCanUploadDocs(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                />
                <span>Can upload project documents</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={canViewMetrics}
                  onChange={(e) => setCanViewMetrics(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                />
                <span>Can view project activity and metrics</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={canManageMembers}
                  onChange={(e) => setCanManageMembers(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                />
                <span>Can invite and manage other project members</span>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition"
              >
                Generate Collaborator Invite
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
