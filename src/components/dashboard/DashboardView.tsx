import React from 'react';
import {
  FolderKanban,
  CheckSquare,
  Users,
  Lightbulb,
  Clock,
  ArrowRight,
  Shield,
  AlertTriangle,
  GitCommit,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface DashboardViewProps {
  onNavigateToProjects: () => void;
  onNavigateToTasks: () => void;
  onNavigateToTeam: () => void;
  onNavigateToSuggestions: () => void;
  onSelectProject: (projectId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToProjects,
  onNavigateToTasks,
  onNavigateToTeam,
  onNavigateToSuggestions,
  onSelectProject,
}) => {
  const {
    currentUser,
    projects,
    tasks,
    profiles,
    suggestions,
    activityLogs,
    isSuperAdmin,
  } = useWorkspace();

  const myTasks = tasks.filter((t) => t.assigneeId === currentUser?.id);
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const openSuggestions = suggestions.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review'
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Developer Workspace Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Logged in as <strong className="text-slate-200">{currentUser?.fullName}</strong> ({currentUser?.email}) ·{' '}
            <span className="font-mono text-indigo-400 uppercase">{currentUser?.role}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-slate-300">
            <span className="text-slate-400">Accessible Projects:</span>{' '}
            <strong className="text-white font-mono">{projects.length}</strong>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-slate-300">
            <span className="text-slate-400">My Assigned Tasks:</span>{' '}
            <strong className="text-white font-mono">{myTasks.length}</strong>
          </div>
        </div>
      </div>

      {/* Metrics Row (Anti-slop: clean subtle borders, no neon pills) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={onNavigateToProjects}
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Projects</span>
            <FolderKanban className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{projects.length}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            {projects.filter((p) => p.status === 'in_progress').length} In Progress
          </div>
        </div>

        <div
          onClick={onNavigateToTasks}
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Tasks</span>
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{tasks.length}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            {inProgressTasks.length} currently in flight
          </div>
        </div>

        <div
          onClick={onNavigateToTeam}
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Team Members</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{profiles.length}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            {profiles.filter((p) => p.mfaEnabled).length} MFA protected
          </div>
        </div>

        <div
          onClick={onNavigateToSuggestions}
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Suggestions</span>
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{suggestions.length}</div>
          <div className="mt-1 text-[11px] text-slate-400">
            {openSuggestions.length} under review
          </div>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Tasks & Project Summaries */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Tasks Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <h2 className="font-semibold text-sm text-white">My Assigned Tasks ({myTasks.length})</h2>
              </div>
              <button
                onClick={onNavigateToTasks}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                View all tasks →
              </button>
            </div>

            {myTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                You have no pending tasks assigned in your active projects.
              </div>
            ) : (
              <div className="space-y-2">
                {myTasks.map((task) => {
                  const proj = projects.find((p) => p.id === task.projectId);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-800/80 bg-slate-950/60 text-xs hover:border-slate-700 transition"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-slate-200">{task.title}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="text-indigo-400 font-medium">{proj?.name || 'Project'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono uppercase text-[10px]">
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        {task.dueDate && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        <span className="font-mono text-[10px] uppercase text-amber-400">
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Project Summaries Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-indigo-400" />
                <h2 className="font-semibold text-sm text-white">Active Projects Overview</h2>
              </div>
              <button
                onClick={onNavigateToProjects}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                View all projects →
              </button>
            </div>

            <div className="space-y-3">
              {projects.map((proj) => {
                const members = proj.members || [];
                const isSolo = members.length === 1 && members[0].role === 'lead';

                return (
                  <div
                    key={proj.id}
                    onClick={() => onSelectProject(proj.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition cursor-pointer gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100">{proj.name}</span>
                        {isSolo && (
                          <span className="font-mono text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-900/40">
                            Solo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-1">{proj.summary}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                      <span className="font-mono uppercase text-[10px] text-indigo-400 font-medium">
                        {proj.status.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-slate-500 text-[11px]">
                        {members.length} members
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed & Upcoming Deadlines */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
            <h2 className="font-semibold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Recent Activity Feed</span>
            </h2>

            <div className="space-y-3">
              {activityLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="text-xs border-b border-slate-800/60 pb-3 last:border-b-0">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-medium text-slate-200">
                      {log.user?.fullName || 'Workspace Member'}
                    </span>
                    <span className="font-mono text-slate-500 text-[10px]">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-300 font-mono text-[11px] leading-relaxed">
                    {log.details}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Workspace Security Model</span>
            </div>
            <p className="leading-relaxed">
              Independent project membership is enforced. Non-members cannot view tasks, repositories, or documents for private projects. Restricted documents require Super Admin authorization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
