import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  GitBranch,
  Users,
  Search,
  SlidersHorizontal,
  ArrowRight,
  Shield,
  Layers,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Project, ProjectStatus, Priority } from '../../types';
import { CreateProjectModal } from './CreateProjectModal';

interface ProjectListProps {
  onSelectProject: (projectId: string) => void;
  searchFilter: string;
}

export const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject, searchFilter }) => {
  const { projects, isSuperAdmin, createProject, currentUser } = useWorkspace();

  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Search
      const search = searchFilter.toLowerCase();
      const matchesSearch =
        !search ||
        project.name.toLowerCase().includes(search) ||
        project.summary.toLowerCase().includes(search) ||
        project.techStack.some((t) => t.toLowerCase().includes(search));

      // Status
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

      // Priority
      const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [projects, searchFilter, statusFilter, priorityFilter]);

  const statusCategories: { id: 'all' | ProjectStatus; label: string }[] = [
    { id: 'all', label: 'All Projects' },
    { id: 'idea', label: 'Idea' },
    { id: 'planned', label: 'Planned' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & New Project CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Software Projects</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Independent developer workspaces. Membership and authorization are scoped per project.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        {/* Status segmented controls */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-900/60 rounded-lg border border-slate-800/80">
          {statusCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setStatusFilter(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === cat.id
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Priority dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | Priority)}
            className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Grid of Projects */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center">
          <FolderKanban className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No projects match criteria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isSuperAdmin
              ? 'Create a new project to start collaborating with individual team members.'
              : 'You have only been assigned to projects where you are an active member.'}
          </p>
          {isSuperAdmin && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <Plus className="w-3.5 h-3.5" /> Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const members = project.members || [];
            const taskTotal = project.taskCount?.total || 0;
            const taskDone = project.taskCount?.done || 0;
            const progress = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

            const isSolo = members.length === 1 && members[0].role === 'lead';

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 hover:bg-slate-900/80 transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div>
                  {/* Clean unboxed metadata kicker */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono uppercase font-semibold text-indigo-400">
                        {project.status.replace('_', ' ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize font-mono">{project.priority} priority</span>
                      {isSolo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400 font-mono">Solo Project</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-slate-500 text-[10px]">
                      {project.repositories?.length || 0} repos
                    </span>
                  </div>

                  {/* Project Title */}
                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {project.name}
                  </h3>

                  {/* Summary */}
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {project.summary}
                  </p>

                  {/* Tech stack badges */}
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {project.techStack.slice(0, 4).map((tech, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-[11px] text-slate-400 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800"
                      >
                        {tech}
                      </span>
                    ))}
                    {project.techStack.length > 4 && (
                      <span className="font-mono text-[10px] text-slate-500 px-1 py-0.5">
                        +{project.techStack.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer: Task completion bar & team avatars */}
                <div className="mt-5 pt-3.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>
                      Tasks: {taskDone}/{taskTotal} completed
                    </span>
                    <span className="font-mono text-[11px]">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-3.5 flex items-center justify-between">
                    {/* Team avatars */}
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {members.map((m) => (
                        <div
                          key={m.id}
                          className="inline-block h-6 w-6 rounded-md ring-2 ring-slate-900 bg-slate-800 overflow-hidden text-[10px] font-bold text-white flex items-center justify-center"
                          title={`${m.user?.fullName} (${m.role})`}
                        >
                          {m.user?.avatarUrl ? (
                            <img src={m.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span>{m.user?.fullName?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    <span className="text-xs text-indigo-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform font-medium">
                      Manage <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for creating a new project */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createProject}
      />
    </div>
  );
};
