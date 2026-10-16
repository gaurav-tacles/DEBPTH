import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Kanban,
  List,
  Clock,
  User,
  AlertCircle,
  FolderKanban,
  X,
  Filter,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Task, Priority } from '../../types';

export const TasksView: React.FC = () => {
  const {
    tasks,
    projects,
    profiles,
    createTask,
    updateTask,
    deleteTask,
    currentUser,
    isSuperAdmin,
  } = useWorkspace();

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states for creating a task
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState(projects[0]?.id || '');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchProj = selectedProjectId === 'all' || t.projectId === selectedProjectId;
      const matchAssignee = selectedAssigneeId === 'all' || t.assigneeId === selectedAssigneeId;
      return matchProj && matchAssignee;
    });
  }, [tasks, selectedProjectId, selectedAssigneeId]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskProjectId) return;

    createTask({
      projectId: newTaskProjectId,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || undefined,
      status: 'todo',
      priority: newTaskPriority,
      assigneeId: newTaskAssigneeId || undefined,
      dueDate: newTaskDueDate || undefined,
    });

    setNewTaskTitle('');
    setNewTaskDesc('');
    setIsCreateModalOpen(false);
  };

  const columns: { id: Task['status']; label: string; count: number }[] = [
    { id: 'todo', label: 'To Do', count: filteredTasks.filter((t) => t.status === 'todo').length },
    { id: 'in_progress', label: 'In Progress', count: filteredTasks.filter((t) => t.status === 'in_progress').length },
    { id: 'review', label: 'In Review', count: filteredTasks.filter((t) => t.status === 'review').length },
    { id: 'done', label: 'Completed', count: filteredTasks.filter((t) => t.status === 'done').length },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#38302D]">
        <div>
          <h1 className="text-xl font-bold text-[#F4F8FF] tracking-tight">Tasks & Kanban Board</h1>
          <p className="text-xs text-[#B4B0B0] mt-0.5">
            Manage development deliverables across accessible projects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-[#191311] border border-[#38302D] rounded-xl p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[#211B19] text-[#F4F8FF] font-semibold border border-[#38302D]'
                  : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
              title="Kanban Board"
            >
              <Kanban className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#211B19] text-[#F4F8FF] font-semibold border border-[#38302D]'
                  : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#8B5CF6]/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#38302D] pb-3 text-xs">
        <div className="flex items-center gap-1.5 text-[#B4B0B0]">
          <Filter className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span>Filter By:</span>
        </div>

        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="rounded-xl border border-[#38302D] bg-[#191311] px-3 py-1.5 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
        >
          <option value="all">All Accessible Projects ({projects.length})</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={selectedAssigneeId}
          onChange={(e) => setSelectedAssigneeId(e.target.value)}
          className="rounded-xl border border-[#38302D] bg-[#191311] px-3 py-1.5 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
        >
          <option value="all">All Assignees ({profiles.length})</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} {p.id === currentUser?.id ? '(Me)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* KANBAN BOARD */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const columnTasks = filteredTasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className="rounded-2xl border border-[#38302D] bg-[#191311] p-3.5 space-y-3 min-h-[420px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#38302D]/80">
                  <span className="font-semibold text-xs text-[#F4F8FF]">{col.label}</span>
                  <span className="font-mono text-[11px] rounded-md bg-[#211B19] border border-[#38302D] px-2 py-0.5 text-[#B4B0B0]">
                    {col.count}
                  </span>
                </div>

                {/* Task Cards */}
                <div className="space-y-2.5">
                  {columnTasks.map((task) => {
                    const proj = projects.find((p) => p.id === task.projectId);

                    return (
                      <div
                        key={task.id}
                        className="rounded-xl border border-[#38302D] bg-[#211B19]/70 p-3 text-xs space-y-2 hover:border-[#8B5CF6]/40 transition shadow-sm"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-medium text-[#8B5CF6] truncate max-w-[130px]">
                            {proj?.name || 'Project'}
                          </span>
                          <span
                            className={`font-mono uppercase font-bold text-[10px] ${
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

                        <div className="font-medium text-[#F4F8FF] leading-snug">{task.title}</div>

                        {task.description && (
                          <p className="text-[11px] text-[#B4B0B0] line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-[#38302D]/60 text-[11px] text-[#B4B0B0]">
                          <span className="text-[#F4F8FF]">
                            {task.assignee?.fullName || 'Unassigned'}
                          </span>

                          {/* Quick move dropdown */}
                          <select
                            value={task.status}
                            onChange={(e) =>
                              updateTask(task.id, { status: e.target.value as Task['status'] })
                            }
                            className="bg-[#0F0B0A] border border-[#38302D] rounded-md px-1.5 py-0.5 text-[10px] text-[#B4B0B0] focus:border-[#8B5CF6] focus:outline-none"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}

                  {columnTasks.length === 0 && (
                    <div className="py-8 text-center text-xs text-[#B4B0B0]/60">No tasks</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-2xl border border-[#38302D] bg-[#191311] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#38302D] bg-[#0F0B0A] text-[10px] text-[#B4B0B0] uppercase tracking-wider font-mono">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Project</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Assignee</th>
                  <th className="p-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#38302D] text-[#B4B0B0]">
                {filteredTasks.map((task) => {
                  const proj = projects.find((p) => p.id === task.projectId);
                  return (
                    <tr key={task.id} className="hover:bg-[#211B19]/50 transition">
                      <td className="p-3 font-medium text-[#F4F8FF]">{task.title}</td>
                      <td className="p-3 text-[#8B5CF6]">{proj?.name || 'Project'}</td>
                      <td className="p-3">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            updateTask(task.id, { status: e.target.value as Task['status'] })
                          }
                          className="bg-[#0F0B0A] border border-[#38302D] rounded-lg px-2 py-1 text-xs text-[#F4F8FF] capitalize focus:border-[#8B5CF6] focus:outline-none"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td className="p-3 font-mono uppercase text-[#FBBF24] text-[11px]">
                        {task.priority}
                      </td>
                      <td className="p-3 text-[#F4F8FF]">{task.assignee?.fullName || 'Unassigned'}</td>
                      <td className="p-3 font-mono text-[11px] text-[#B4B0B0]">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#38302D] bg-[#191311] p-6 shadow-2xl text-[#F4F8FF]">
            <div className="flex items-center justify-between pb-3 border-b border-[#38302D]">
              <h3 className="font-semibold text-sm">Create New Task</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Target Project *</label>
                <select
                  value={newTaskProjectId}
                  onChange={(e) => setNewTaskProjectId(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement token bucket rate limiter"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Description</label>
                <textarea
                  rows={2}
                  placeholder="Technical acceptance criteria..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#B4B0B0]">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#B4B0B0]">Assignee</label>
                  <select
                    value={newTaskAssigneeId}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Due Date</label>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#38302D]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
