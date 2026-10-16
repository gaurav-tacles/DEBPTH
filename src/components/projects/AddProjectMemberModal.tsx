import React, { useState } from 'react';
import { X, UserPlus, Shield, Check } from 'lucide-react';
import { UserProfile, ProjectRole, ProjectPermission } from '../../types';

interface AddProjectMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProfiles: UserProfile[];
  onAddMember: (userId: string, role: ProjectRole, permissions: ProjectPermission) => void;
}

export const AddProjectMemberModal: React.FC<AddProjectMemberModalProps> = ({
  isOpen,
  onClose,
  availableProfiles,
  onAddMember,
}) => {
  const [selectedUserId, setSelectedUserId] = useState(availableProfiles[0]?.id || '');
  const [role, setRole] = useState<ProjectRole>('collaborator');
  const [canManageTasks, setCanManageTasks] = useState(true);
  const [canUploadDocs, setCanUploadDocs] = useState(true);
  const [canViewMetrics, setCanViewMetrics] = useState(true);
  const [canManageMembers, setCanManageMembers] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    onAddMember(selectedUserId, role, {
      canManageTasks,
      canUploadDocs,
      canViewMetrics,
      canManageMembers,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl text-slate-100 max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm">Add Project Collaborator</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {availableProfiles.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            All active workspace members are already members of this project.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Select Member</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {availableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.email}) — Labels: {p.labels.join(', ') || 'None'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Project Role</label>
              <select
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value as ProjectRole;
                  setRole(newRole);
                  if (newRole === 'lead') {
                    setCanManageTasks(true);
                    setCanUploadDocs(true);
                    setCanViewMetrics(true);
                    setCanManageMembers(true);
                  } else if (newRole === 'viewer') {
                    setCanManageTasks(false);
                    setCanUploadDocs(false);
                    setCanViewMetrics(true);
                    setCanManageMembers(false);
                  }
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="lead">Lead (Full control over project)</option>
                <option value="maintainer">Maintainer (Manage tasks & docs)</option>
                <option value="collaborator">Collaborator (Standard team member)</option>
                <option value="viewer">Viewer (Read-only access)</option>
              </select>
            </div>

            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Granular Permissions
              </div>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canManageTasks}
                  onChange={(e) => setCanManageTasks(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <span>Can create & modify project tasks</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canUploadDocs}
                  onChange={(e) => setCanUploadDocs(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <span>Can upload & share project documents</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canViewMetrics}
                  onChange={(e) => setCanViewMetrics(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <span>Can view project metrics & telemetry</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canManageMembers}
                  onChange={(e) => setCanManageMembers(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <span>Can add / modify project team members</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Assign Member
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
