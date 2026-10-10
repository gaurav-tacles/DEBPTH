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
      tags: [],
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
    <div className="space-y-6">
      {/* Top Header & CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Tasks & Kanban Board</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage development deliverables across accessible projects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition ${
                viewMode === 'kanban' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Kanban Board"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition ${
                viewMode === 'list' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter By:</span>
        </div>

        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
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
          className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
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
                className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3 min-h-[400px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="font-semibold text-xs text-slate-300">{col.label}</span>
                  <span className="font-mono text-[11px] rounded bg-slate-900 px-2 py-0.5 text-slate-400">
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
                        className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3 text-xs space-y-2 hover:border-slate-700 transition shadow-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-medium text-indigo-400 truncate max-w-[130px]">
                            {proj?.name || 'Project'}
                          </span>
                          <span className="font-mono uppercase font-semibold text-amber-400">
                            {task.priority}
                          </span>
                        </div>

                        <div className="font-medium text-slate-100 leading-snug">{task.title}</div>

                        {task.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                          <span className="text-slate-300">
                            {task.assignee?.fullName || 'Unassigned'}
                          </span>

                          {/* Quick move dropdown */}
                          <select
                            value={task.status}
                            onChange={(e) =>
                              updateTask(task.id, { status: e.target.value as Task['status'] })
                            }
                            className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none"
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
                    <div className="py-8 text-center text-xs text-slate-600">No tasks</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Project</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Assignee</th>
                  <th className="p-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredTasks.map((task) => {
                  const proj = projects.find((p) => p.id === task.projectId);
                  return (
                    <tr key={task.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-medium text-slate-100">{task.title}</td>
                      <td className="p-3 text-indigo-400">{proj?.name || 'Project'}</td>
                      <td className="p-3">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            updateTask(task.id, { status: e.target.value as Task['status'] })
                          }
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 capitalize"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td className="p-3 font-mono uppercase text-amber-400 text-[11px]">
                        {task.priority}
                      </td>
                      <td className="p-3">{task.assignee?.fullName || 'Unassigned'}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-sm">Create New Task</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Target Project *</label>
                <select
                  value={newTaskProjectId}
                  onChange={(e) => setNewTaskProjectId(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement token bucket rate limiter"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Technical acceptance criteria..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300">Assignee</label>
                  <select
                    value={newTaskAssigneeId}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:outline-none"
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
                <label className="text-[11px] font-medium text-slate-300">Due Date</label>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
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
