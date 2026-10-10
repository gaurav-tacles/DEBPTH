import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  GitBranch,
  Shield,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Lock,
  Plus,
  Trash2,
  ExternalLink,
  Edit3,
  Check,
  UserPlus,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Project, ProjectRole, ProjectStatus, Priority } from '../../types';
import { AddProjectMemberModal } from './AddProjectMemberModal';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onNavigateToTasks: () => void;
  onNavigateToDocs: () => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  projectId,
  onBack,
  onNavigateToTasks,
  onNavigateToDocs,
}) => {
  const {
    projects,
    currentUser,
    isSuperAdmin,
    profiles,
    tasks,
    documents,
    activityLogs,
    updateProject,
    addProjectMember,
    updateProjectMember,
    removeProjectMember,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'tasks' | 'documents' | 'activity'>('overview');
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-400 text-sm">Project not found or access restricted.</div>
        <button
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
        </button>
      </div>
    );
  }

  const projectMembers = project.members || [];
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const projectDocs = documents.filter((d) => d.projectId === project.id);
  const projectLogs = activityLogs.filter((l) => l.projectId === project.id);

  // Available profiles not yet members
  const memberUserIds = new Set(projectMembers.map((m) => m.userId));
  const availableProfiles = profiles.filter((p) => !memberUserIds.has(p.id));

  // Determine current user's role on this project
  const currentMember = projectMembers.find((m) => m.userId === currentUser?.id);
  const canManageMembers = isSuperAdmin || currentMember?.role === 'lead' || currentMember?.permissions.canManageMembers;

  const handleStatusChange = (newStatus: ProjectStatus) => {
    if (!isSuperAdmin && currentMember?.role !== 'lead') return;
    updateProject(project.id, { status: newStatus });
  };

  const statusColors: Record<ProjectStatus, string> = {
    idea: 'text-amber-400',
    planned: 'text-blue-400',
    in_progress: 'text-emerald-400',
    completed: 'text-purple-400',
  };

  const priorityColors: Record<Priority, string> = {
    low: 'text-slate-400',
    medium: 'text-blue-400',
    high: 'text-amber-400',
    urgent: 'text-rose-400',
  };

  return (
    <div className="space-y-6">
      {/* Top Header Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to all projects
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">{project.name}</h1>
            <span className="font-mono text-xs text-slate-400">({project.slug})</span>
          </div>
          <p className="mt-1 text-xs text-slate-300 max-w-3xl leading-relaxed">{project.summary}</p>
        </div>

        {/* Quick status & Priority */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="text-slate-400">Status:</span>
            {isSuperAdmin || currentMember?.role === 'lead' ? (
              <select
                value={project.status}
                onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                className={`bg-transparent font-medium capitalize outline-none cursor-pointer ${statusColors[project.status]}`}
              >
                <option value="idea" className="bg-slate-900 text-slate-200">Idea</option>
                <option value="planned" className="bg-slate-900 text-slate-200">Planned</option>
                <option value="in_progress" className="bg-slate-900 text-slate-200">In Progress</option>
                <option value="completed" className="bg-slate-900 text-slate-200">Completed</option>
              </select>
            ) : (
              <span className={`font-medium capitalize ${statusColors[project.status]}`}>
                {project.status.replace('_', ' ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="text-slate-400">Priority:</span>
            <span className={`font-medium capitalize ${priorityColors[project.priority]}`}>
              {project.priority}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'members', label: `Members & Access (${projectMembers.length})` },
            { id: 'tasks', label: `Tasks (${projectTasks.length})` },
            { id: 'documents', label: `Documents (${projectDocs.length})` },
            { id: 'activity', label: 'Audit Activity' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Problem Statement */}
            {project.problemStatement && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Problem Statement
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">{project.problemStatement}</p>
              </div>
            )}

            {/* Detailed Description */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                Architecture & Scope
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                {project.description}
              </p>
            </div>

            {/* Goals & Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {project.goals && project.goals.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                    Key Objectives
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {project.goals.map((g, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {project.features && project.features.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                    Core Capabilities
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {project.features.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Connected Repositories */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
                Connected Git Repositories
              </h3>
              {project.repositories && project.repositories.length > 0 ? (
                <div className="space-y-2">
                  {project.repositories.map((repo, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-indigo-400" />
                        <span className="font-mono font-medium text-slate-200">{repo.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">[{repo.branch}]</span>
                      </div>
                      <a
                        href={`https://github.com/${repo.name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        GitHub <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No repositories mapped to this project yet.</div>
              )}
            </div>
          </div>

          {/* Right sidebar metadata */}
          <div className="space-y-6">
            {/* Tech Stack */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
                Tech Stack
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {project.techStack.map((tech, idx) => (
                  <span
                    key={idx}
                    className="font-mono text-xs text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            {/* Project Timeline & Owner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3 text-xs">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Project Metadata
              </h3>
              <div className="flex items-center justify-between text-slate-300 border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Created:</span>
                <span className="font-mono text-slate-200">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Target Date:</span>
                <span className="font-mono text-slate-200">
                  {project.targetDate ? new Date(project.targetDate).toLocaleDateString() : 'Continuous'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Owner:</span>
                <span className="font-medium text-slate-200">{project.owner?.fullName || 'Super Admin'}</span>
              </div>
            </div>

            {/* Quick Team Roster preview */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Assigned Members ({projectMembers.length})
                </h3>
                {canManageMembers && (
                  <button
                    onClick={() => setIsAddMemberOpen(true)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    + Add
                  </button>
                )}
              </div>

              {projectMembers.length === 1 && projectMembers[0].role === 'lead' ? (
                <div className="text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-900/40 p-2 rounded">
                  Solo Project: Only the Super Admin / Lead has access. Workspace members cannot view this project.
                </div>
              ) : (
                <div className="space-y-2">
                  {projectMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {m.user?.avatarUrl ? (
                          <img src={m.user.avatarUrl} alt="" className="w-5 h-5 rounded object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded bg-indigo-600 text-[10px] text-white flex items-center justify-center font-bold">
                            {m.user?.fullName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <span className="text-slate-200 font-medium">{m.user?.fullName}</span>
                      </div>
                      <span className="text-[10px] font-mono capitalize text-slate-400">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEMBERS & PERMISSIONS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Independent Project Membership</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Workspace membership does not automatically grant access to this project. Permissions are enforced independently.
              </p>
            </div>
            {canManageMembers && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Member</th>
                    <th className="p-3">Project Role</th>
                    <th className="p-3">Tasks</th>
                    <th className="p-3">Documents</th>
                    <th className="p-3">Metrics</th>
                    <th className="p-3">Manage Roster</th>
                    {canManageMembers && <th className="p-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {projectMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {member.user?.avatarUrl ? (
                            <img src={member.user.avatarUrl} alt="" className="w-7 h-7 rounded-md object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                              {member.user?.fullName?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-100">{member.user?.fullName}</div>
                            <div className="text-[10px] text-slate-400">{member.user?.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        {canManageMembers && member.role !== 'lead' ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateProjectMember(
                                member.id,
                                e.target.value as ProjectRole,
                                member.permissions
                              )
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:outline-none capitalize"
                          >
                            <option value="maintainer">Maintainer</option>
                            <option value="collaborator">Collaborator</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="font-mono text-xs uppercase text-indigo-400 font-semibold">
                            {member.role}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <input
                          type="checkbox"
                          disabled={!canManageMembers || member.role === 'lead'}
                          checked={member.permissions.canManageTasks}
                          onChange={(e) =>
                            updateProjectMember(member.id, member.role, {
                              ...member.permissions,
                              canManageTasks: e.target.checked,
                            })
                          }
                          className="rounded border-slate-700 bg-slate-950 text-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="checkbox"
                          disabled={!canManageMembers || member.role === 'lead'}
                          checked={member.permissions.canUploadDocs}
                          onChange={(e) =>
                            updateProjectMember(member.id, member.role, {
                              ...member.permissions,
                              canUploadDocs: e.target.checked,
                            })
                          }
                          className="rounded border-slate-700 bg-slate-950 text-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="checkbox"
                          disabled={!canManageMembers || member.role === 'lead'}
                          checked={member.permissions.canViewMetrics}
                          onChange={(e) =>
                            updateProjectMember(member.id, member.role, {
                              ...member.permissions,
                              canViewMetrics: e.target.checked,
                            })
                          }
                          className="rounded border-slate-700 bg-slate-950 text-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="checkbox"
                          disabled={!canManageMembers || member.role === 'lead'}
                          checked={member.permissions.canManageMembers}
                          onChange={(e) =>
                            updateProjectMember(member.id, member.role, {
                              ...member.permissions,
                              canManageMembers: e.target.checked,
                            })
                          }
                          className="rounded border-slate-700 bg-slate-950 text-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>

                      {canManageMembers && (
                        <td className="p-3 text-right">
                          {member.role !== 'lead' && (
                            <button
                              onClick={() => removeProjectMember(member.id)}
                              className="rounded p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                              title="Remove member from this project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TASKS QUICK LIST */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Project Tasks ({projectTasks.length})</h2>
            <button
              onClick={onNavigateToTasks}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Open Kanban Board →
            </button>
          </div>

          <div className="space-y-2">
            {projectTasks.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-500">
                No tasks logged for this project yet.
              </div>
            ) : (
              projectTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500 text-[11px]">{t.id}</span>
                    <span className="font-medium text-slate-200">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono uppercase text-[10px] text-slate-400">
                      {t.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-indigo-400">
                      {t.assignee?.fullName || 'Unassigned'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENTS QUICK LIST */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Project Documents ({projectDocs.length})</h2>
            <button
              onClick={onNavigateToDocs}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Go to Document Library →
            </button>
          </div>

          <div className="space-y-2">
            {projectDocs.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-500">
                No documents uploaded for this project yet.
              </div>
            ) : (
              projectDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-medium text-slate-200 flex items-center gap-2">
                        <span>{doc.title}</span>
                        {doc.isRestricted && (
                          <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/50">
                            <Lock className="w-2.5 h-2.5" /> RESTRICTED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{doc.fileName}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Project Activity & Audit Trail</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            {projectLogs.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No logged activity yet.</div>
            ) : (
              projectLogs.map((log) => (
                <div key={log.id} className="text-xs border-b border-slate-800/60 pb-2.5 last:border-b-0">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-medium text-slate-200">{log.user?.fullName || 'System'}</span>
                    <span className="font-mono text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-300 font-mono text-[11px]">{log.details}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal for adding member */}
      <AddProjectMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        availableProfiles={availableProfiles}
        onAddMember={(userId, role, permissions) =>
          addProjectMember(project.id, userId, role, permissions)
        }
      />
    </div>
  );
};
