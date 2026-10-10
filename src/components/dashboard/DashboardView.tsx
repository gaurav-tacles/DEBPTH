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
  Sparkles,
  Layers,
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#38302D]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#F4F8FF] tracking-tight">
              Developer Workspace Overview
            </h1>
            <span className="font-mono text-[9px] uppercase font-bold text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded border border-[#34D399]/30">
              Active Session
            </span>
          </div>
          <p className="text-xs text-[#B4B0B0] mt-1">
            Logged in as <strong className="text-[#F4F8FF]">{currentUser?.fullName}</strong> ({currentUser?.email}) ·{' '}
            <span className="font-mono text-[#8B5CF6] uppercase font-semibold">{currentUser?.role}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="rounded-xl border border-[#38302D] bg-[#191311] px-3 py-1.5 text-[#B4B0B0]">
            <span>Accessible Projects:</span>{' '}
            <strong className="text-[#F4F8FF] font-mono">{projects.length}</strong>
          </div>
          <div className="rounded-xl border border-[#38302D] bg-[#191311] px-3 py-1.5 text-[#B4B0B0]">
            <span>My Assigned Tasks:</span>{' '}
            <strong className="text-[#F4F8FF] font-mono">{myTasks.length}</strong>
          </div>
        </div>
      </div>

      {/* Metrics Row (Developer Aesthetic: clean surfaces, border #38302D, distinct accents) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={onNavigateToProjects}
          className="rounded-2xl border border-[#38302D] bg-[#191311] p-4 hover:border-[#8B5CF6]/50 hover:bg-[#211B19] transition cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-[#B4B0B0] text-xs">
            <span>Projects</span>
            <FolderKanban className="w-4 h-4 text-[#8B5CF6] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#F4F8FF]">{projects.length}</div>
          <div className="mt-1 text-[11px] text-[#B4B0B0]">
            {projects.filter((p) => p.status === 'in_progress').length} In Progress
          </div>
        </div>

        <div
          onClick={onNavigateToTasks}
          className="rounded-2xl border border-[#38302D] bg-[#191311] p-4 hover:border-[#3B82F6]/50 hover:bg-[#211B19] transition cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-[#B4B0B0] text-xs">
            <span>Active Tasks</span>
            <CheckSquare className="w-4 h-4 text-[#3B82F6] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#F4F8FF]">{tasks.length}</div>
          <div className="mt-1 text-[11px] text-[#B4B0B0]">
            {inProgressTasks.length} in flight
          </div>
        </div>

        <div
          onClick={onNavigateToTeam}
          className="rounded-2xl border border-[#38302D] bg-[#191311] p-4 hover:border-[#22D3EE]/50 hover:bg-[#211B19] transition cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-[#B4B0B0] text-xs">
            <span>Team Members</span>
            <Users className="w-4 h-4 text-[#22D3EE] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#F4F8FF]">{profiles.length}</div>
          <div className="mt-1 text-[11px] text-[#B4B0B0]">
            {profiles.filter((p) => p.mfaEnabled).length} MFA protected
          </div>
        </div>

        <div
          onClick={onNavigateToSuggestions}
          className="rounded-2xl border border-[#38302D] bg-[#191311] p-4 hover:border-[#FBBF24]/50 hover:bg-[#211B19] transition cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-[#B4B0B0] text-xs">
            <span>Suggestions</span>
            <Lightbulb className="w-4 h-4 text-[#FBBF24] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#F4F8FF]">{suggestions.length}</div>
          <div className="mt-1 text-[11px] text-[#B4B0B0]">
            {openSuggestions.length} under review
          </div>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Tasks & Project Summaries */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Tasks Section */}
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="font-semibold text-sm text-[#F4F8FF]">My Assigned Tasks ({myTasks.length})</h2>
              </div>
              <button
                onClick={onNavigateToTasks}
                className="text-xs text-[#8B5CF6] hover:text-[#7C3AED] font-medium cursor-pointer"
              >
                View all tasks →
              </button>
            </div>

            {myTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#B4B0B0]">
                You have no pending tasks assigned in your active projects.
              </div>
            ) : (
              <div className="space-y-2">
                {myTasks.map((task) => {
                  const proj = projects.find((p) => p.id === task.projectId);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#38302D] bg-[#211B19]/50 text-xs hover:border-[#8B5CF6]/40 transition"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-[#F4F8FF]">{task.title}</div>
                        <div className="flex items-center gap-2 text-[11px] text-[#B4B0B0]">
                          <span className="text-[#8B5CF6] font-medium">{proj?.name || 'Project'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono uppercase text-[10px]">
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        {task.dueDate && (
                          <div className="text-[11px] text-[#B4B0B0] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#B4B0B0]" />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        <span
                          className={`font-mono text-[10px] uppercase font-bold ${
                            task.priority === 'urgent'
                              ? 'text-[#FB7185]'
                              : task.priority === 'high'
                              ? 'text-[#FBBF24]'
                              : 'text-[#34D399]'
                          }`}
                        >
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
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#3B82F6]" />
                <h2 className="font-semibold text-sm text-[#F4F8FF]">Active Projects Overview</h2>
              </div>
              <button
                onClick={onNavigateToProjects}
                className="text-xs text-[#3B82F6] hover:text-[#60A5FA] font-medium cursor-pointer"
              >
                View all projects →
              </button>
            </div>

            <div className="space-y-2.5">
              {projects.map((proj) => {
                const members = proj.members || [];
                const isSolo = members.length === 1 && members[0].role === 'lead';

                return (
                  <div
                    key={proj.id}
                    onClick={() => onSelectProject(proj.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-[#38302D] bg-[#211B19]/50 hover:border-[#3B82F6]/40 hover:bg-[#211B19] transition cursor-pointer gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#F4F8FF]">{proj.name}</span>
                        {isSolo && (
                          <span className="font-mono text-[10px] text-[#FBBF24] bg-[#FBBF24]/10 px-1.5 py-0.2 rounded border border-[#FBBF24]/30">
                            Solo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#B4B0B0] line-clamp-1">{proj.summary}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#B4B0B0] shrink-0">
                      <span className="font-mono uppercase text-[10px] text-[#8B5CF6] font-medium bg-[#8B5CF6]/10 px-2 py-0.5 rounded border border-[#8B5CF6]/20">
                        {proj.status.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-[#B4B0B0] text-[11px]">
                        {members.length} members
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#B4B0B0]" />
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
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-4">
            <h2 className="font-semibold text-sm text-[#F4F8FF] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#8B5CF6]" />
              <span>Recent Activity Feed</span>
            </h2>

            <div className="space-y-3">
              {activityLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="text-xs border-b border-[#38302D]/60 pb-3 last:border-b-0">
                  <div className="flex items-center justify-between text-[#B4B0B0] text-[11px]">
                    <span className="font-medium text-[#F4F8FF]">
                      {log.user?.fullName || 'Workspace Member'}
                    </span>
                    <span className="font-mono text-[#B4B0B0]/60 text-[10px]">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 text-[#B4B0B0] font-mono text-[11px] leading-relaxed">
                    {log.details}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-4 text-xs text-[#B4B0B0] space-y-2">
            <div className="flex items-center gap-2 text-[#F4F8FF] font-semibold">
              <Shield className="w-4 h-4 text-[#34D399]" />
              <span>Workspace Security Model</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              Independent project membership is enforced. Non-members cannot view tasks, repositories, or documents for private projects. Restricted documents require Super Admin authorization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
