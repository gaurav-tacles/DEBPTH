import React, { useState } from 'react';
import { X, Plus, Trash2, FolderPlus } from 'lucide-react';
import { Project, ProjectStatus, Priority } from '../../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planned');
  const [priority, setPriority] = useState<Priority>('medium');
  const [techStackInput, setTechStackInput] = useState('');
  const [goalsInput, setGoalsInput] = useState('');
  const [featuresInput, setFeaturesInput] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !summary.trim()) return;

    const techStack = techStackInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const goals = goalsInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const features = featuresInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const repositories = repoName.trim()
      ? [
          {
            name: repoName.trim(),
            branch: repoBranch.trim() || 'main',
            description: 'Primary repository',
            isPrivate: false,
          },
        ]
      : [];

    onCreate({
      name: name.trim(),
      slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      summary: summary.trim(),
      problemStatement: problemStatement.trim() || undefined,
      description: description.trim() || summary.trim(),
      status,
      priority,
      techStack: techStack.length > 0 ? techStack : ['TypeScript'],
      goals,
      features,
      repositories,
      links: [],
      startDate: startDate || undefined,
      targetDate: targetDate || undefined,
      ownerId: '', // Context assigns current user
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-base text-slate-100">Create New Project</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Name & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Project Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Project Apex: Core Gateway"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="idea">Idea</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Priority & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Summary (One-line pitch) *</label>
            <input
              type="text"
              required
              placeholder="Concise overview of purpose and outcome"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Problem Statement */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Problem Statement</label>
            <input
              type="text"
              placeholder="What technical problem or architectural gap does this address?"
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Detailed Description</label>
            <textarea
              rows={3}
              placeholder="Architecture details, design boundaries, and implementation plan..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Tech Stack */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Tech Stack (comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. Rust, TypeScript, Redis, PostgreSQL, Docker"
              value={techStackInput}
              onChange={(e) => setTechStackInput(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* GitHub Repo mapping */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Connected Repository (owner/repo)</label>
              <input
                type="text"
                placeholder="e.g. facebook/react or torvalds/linux"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Branch</label>
              <input
                type="text"
                placeholder="main"
                value={repoBranch}
                onChange={(e) => setRepoBranch(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Goals & Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Key Goals (one per line)</label>
              <textarea
                rows={2}
                placeholder="Sub-5ms p99 latency&#10;Zero regression guarantee"
                value={goalsInput}
                onChange={(e) => setGoalsInput(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Core Features (one per line)</label>
              <textarea
                rows={2}
                placeholder="Dynamic token limiter&#10;OpenTelemetry export"
                value={featuresInput}
                onChange={(e) => setFeaturesInput(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
