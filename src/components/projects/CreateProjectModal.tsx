import React, { useState } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setName('');
    setSummary('');
    setProblemStatement('');
    setDescription('');
    setStatus('planned');
    setPriority('medium');
    setTechStackInput('');
    setGoalsInput('');
    setFeaturesInput('');
    setRepoName('');
    setRepoBranch('main');
    setStartDate('');
    setTargetDate('');
    setErrorMessage(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage('Please enter a Project Name.');
      return;
    }
    if (!summary.trim()) {
      setErrorMessage('Please enter a short Summary for the project.');
      return;
    }

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

    handleClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="w-full max-w-2xl rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Pinned Header (Never cut off or scrolled away) */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 shrink-0 bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 id="create-project-title" className="font-semibold text-sm sm:text-base text-slate-100 leading-tight">
                Create New Project
              </h2>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                Provision a repository track & task board
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="create-project-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs">
            {/* Validation Error Alert */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-white">Missing Information: </span>
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Name & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-medium text-slate-300">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Core Gateway"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className={`w-full rounded-md border bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none min-h-[38px] ${
                    errorMessage && !name.trim()
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                  }`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none min-h-[38px]"
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
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none min-h-[38px]"
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
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none min-h-[38px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Target Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none min-h-[38px]"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">
                Summary (One-line pitch) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Concise overview of purpose and outcome"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className={`w-full rounded-md border bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none min-h-[38px] ${
                  errorMessage && !summary.trim()
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-700 focus:border-indigo-500'
                }`}
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
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none min-h-[38px]"
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
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none min-h-[38px]"
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
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none font-mono min-h-[38px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Branch</label>
                <input
                  type="text"
                  placeholder="main"
                  value={repoBranch}
                  onChange={(e) => setRepoBranch(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none font-mono min-h-[38px]"
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
          </div>

          {/* Pinned Footer (Always visible & reachable on mobile and desktop) */}
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-xs shrink-0 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition cursor-pointer min-h-[38px] flex items-center justify-center gap-1.5"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
