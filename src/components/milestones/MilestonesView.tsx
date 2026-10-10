import React, { useState } from 'react';
import {
  Milestone as MilestoneIcon,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const MilestonesView: React.FC = () => {
  const { milestones, projects, activeProjectId, createMilestone } = useWorkspace();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || projects[0]?.id || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const projectMilestones = milestones.filter((m) => m.projectId === selectedProjectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    createMilestone({
      projectId: selectedProjectId,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      status: 'open',
    });

    setTitle('');
    setDescription('');
    setDueDate('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#38302D]">
        <div>
          <h1 className="text-xl font-bold text-[#F4F8FF] tracking-tight">Milestones & Timeline</h1>
          <p className="text-xs text-[#B4B0B0] mt-0.5">
            Key architectural targets, stabilization sprints, and release phases.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#8B5CF6]/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Milestone</span>
        </button>
      </div>

      {/* Project Selector Bar */}
      <div className="flex items-center gap-3 border-b border-[#38302D] pb-3 text-xs">
        <span className="text-[#B4B0B0]">Project:</span>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="rounded-xl border border-[#38302D] bg-[#191311] px-3 py-1.5 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline view */}
      <div className="space-y-4">
        {projectMilestones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#38302D] p-12 text-center text-xs text-[#B4B0B0] bg-[#191311]/40">
            No milestones configured for this project yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#38302D]">
            {projectMilestones.map((ms) => {
              const isPast = new Date(ms.dueDate) < new Date();

              return (
                <div key={ms.id} className="relative group">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-[#0F0B0A] flex items-center justify-center ${
                      ms.status === 'completed'
                        ? 'bg-[#34D399] ring-2 ring-[#34D399]/20'
                        : isPast
                        ? 'bg-[#FB7185] ring-2 ring-[#FB7185]/20'
                        : 'bg-[#8B5CF6] ring-2 ring-[#8B5CF6]/20'
                    }`}
                  />

                  <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-[#F4F8FF]">{ms.title}</div>
                      <span className="font-mono text-[11px] text-[#B4B0B0] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#B4B0B0]" />
                        {new Date(ms.dueDate).toLocaleDateString()}
                      </span>
                    </div>

                    {ms.description && (
                      <p className="text-[#B4B0B0] leading-relaxed">{ms.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#38302D]/60 text-[10px] text-[#B4B0B0]">
                      <span className="font-mono uppercase text-[#8B5CF6] font-semibold">
                        Status: {ms.status}
                      </span>
                      <span>Target Phase</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Milestone Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#38302D] bg-[#191311] p-6 shadow-2xl text-[#F4F8FF]">
            <div className="flex items-center justify-between pb-3 border-b border-[#38302D]">
              <h3 className="font-semibold text-sm">Add Project Milestone</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Milestone Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. v1.0 Stabilization Freeze"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Description</label>
                <textarea
                  rows={2}
                  placeholder="Acceptance requirements for reaching this milestone..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Target Due Date *</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#38302D]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
