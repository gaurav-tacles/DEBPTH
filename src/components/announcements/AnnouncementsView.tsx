import React, { useState } from 'react';
import {
  Bell,
  Plus,
  Send,
  AlertCircle,
  Users,
  FolderKanban,
  Tag,
  Shield,
  Check,
  X,
  Radio,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Announcement } from '../../types';

export const AnnouncementsView: React.FC = () => {
  const {
    announcements,
    isSuperAdmin,
    projects,
    profiles,
    broadcastAnnouncement,
  } = useWorkspace();

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important'>('normal');
  const [targetType, setTargetType] = useState<Announcement['targetType']>('all');
  const [targetProjectId, setTargetProjectId] = useState(projects[0]?.id || '');
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [targetLabels, setTargetLabels] = useState<string[]>([]);
  const [confirmStep, setConfirmStep] = useState(false);

  // Collect unique member labels
  const allLabels = Array.from(new Set(profiles.flatMap((p) => p.labels)));

  const handleComposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    broadcastAnnouncement({
      title: title.trim(),
      content: content.trim(),
      priority,
      targetType,
      targetMeta: {
        projectId: targetType === 'project' ? targetProjectId : undefined,
        userIds: targetType === 'individuals' ? targetUserIds : undefined,
        labels: targetType === 'labels' ? targetLabels : undefined,
      },
      createdBy: '', // workspace repository sets current user
    });

    setTitle('');
    setContent('');
    setConfirmStep(false);
    setIsComposeOpen(false);
  };

  const handleToggleUser = (userId: string) => {
    setTargetUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleLabel = (lbl: string) => {
    setTargetLabels((prev) =>
      prev.includes(lbl) ? prev.filter((l) => l !== lbl) : [...prev, lbl]
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F8FF]">Workspace Announcements</h1>
          <p className="text-xs text-[#B4B0B0] mt-1">
            Broadcast technical announcements, schema migration schedules, and critical security notices.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => {
              setConfirmStep(false);
              setIsComposeOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED] shadow-sm transition-all focus:ring-2 focus:ring-[#8B5CF6]/40"
          >
            <Send className="w-4 h-4" />
            <span>Compose announcement</span>
          </button>
        )}
      </div>

      {/* 2. Announcements Feed */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#38302D] bg-[#191311]/50 p-12 text-center space-y-2">
            <Bell className="w-8 h-8 text-[#B4B0B0] mx-auto opacity-40" />
            <h3 className="text-sm font-semibold text-[#F4F8FF]">No announcements broadcast yet</h3>
            <p className="text-xs text-[#B4B0B0] max-w-sm mx-auto">
              Announcements composed by the Super Admin appear here and trigger in-app notifications.
            </p>
          </div>
        ) : (
          announcements.map((anc) => {
            const isImportant = anc.priority === 'important';

            return (
              <div
                key={anc.id}
                className={`rounded-2xl p-5 border transition-all ${
                  isImportant
                    ? 'border-[#FB7185]/60 bg-[#191311] shadow-[0_0_20px_rgba(251,113,133,0.06)]'
                    : 'border-[#38302D] bg-[#191311]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#38302D]/60">
                  <div className="flex items-center gap-2">
                    {isImportant ? (
                      <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-[#FB7185] bg-[#FB7185]/10 px-2 py-0.5 rounded border border-[#FB7185]/30">
                        <AlertCircle className="w-3 h-3" /> IMPORTANT PRIORITY
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] font-bold text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded border border-[#3B82F6]/30">
                        NORMAL
                      </span>
                    )}

                    <span className="text-[11px] font-mono text-[#B4B0B0] uppercase">
                      Target: {anc.targetType}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-[#B4B0B0]">
                    {new Date(anc.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="text-base font-semibold text-[#F4F8FF]">{anc.title}</h3>
                  <p className="mt-2 text-xs text-[#B4B0B0] leading-relaxed whitespace-pre-line">
                    {anc.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Compose Announcement Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#38302D] bg-[#191311] p-6 shadow-2xl text-[#F4F8FF]">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#8B5CF6]" />
                <h3 className="font-semibold text-sm">
                  {confirmStep ? 'Confirm Announcement Broadcast' : 'Compose Targeted Announcement'}
                </h3>
              </div>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="rounded p-1 text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleComposeSubmit} className="mt-4 space-y-4 text-xs">
              {confirmStep ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#FBBF24]/50 bg-[#FBBF24]/10 p-4 text-xs space-y-2">
                    <div className="font-semibold text-[#FBBF24] flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>Workspace Confirmation Step</span>
                    </div>
                    <p className="text-[#F4F8FF] leading-relaxed">
                      You are about to broadcast <strong className="text-white">"{title}"</strong> to{' '}
                      <span className="font-mono text-[#22D3EE] uppercase font-bold">{targetType}</span>. This will send in-app notifications to all targeted members.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0F0B0A] border border-[#38302D]">
                    <div className="font-semibold text-white">{title}</div>
                    <p className="text-[#B4B0B0] text-xs mt-1 line-clamp-3">{content}</p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#38302D]">
                    <button
                      type="button"
                      onClick={() => setConfirmStep(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
                    >
                      Back to Edit
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED]"
                    >
                      Confirm & Send Broadcast
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#B4B0B0]">Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Infrastructure Maintenance & Database Schema Freeze"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[#B4B0B0]">Announcement Content *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Enter announcement details..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-[#B4B0B0]">Priority</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as 'normal' | 'important')}
                        className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                      >
                        <option value="normal">Normal</option>
                        <option value="important">Important (High Priority Banner)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-[#B4B0B0]">Target Audience</label>
                      <select
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value as Announcement['targetType'])}
                        className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                      >
                        <option value="all">All Workspace Members</option>
                        <option value="project">Selected Project Members</option>
                        <option value="individuals">Specific Individuals</option>
                        <option value="labels">By Custom Member Labels</option>
                      </select>
                    </div>
                  </div>

                  {/* Target details */}
                  {targetType === 'project' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-medium text-[#B4B0B0]">Select Project</label>
                      <select
                        value={targetProjectId}
                        onChange={(e) => setTargetProjectId(e.target.value)}
                        className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {targetType === 'individuals' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-medium text-[#B4B0B0]">
                        Select Targeted Members
                      </label>
                      <div className="space-y-1 max-h-36 overflow-y-auto rounded-xl border border-[#38302D] bg-[#0F0B0A] p-2">
                        {profiles.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 p-1 rounded hover:bg-[#191311] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={targetUserIds.includes(p.id)}
                              onChange={() => handleToggleUser(p.id)}
                              className="rounded border-[#38302D] bg-[#0F0B0A] text-[#8B5CF6]"
                            />
                            <span>{p.fullName} ({p.email})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {targetType === 'labels' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-medium text-[#B4B0B0]">
                        Select Member Labels
                      </label>
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-[#38302D] bg-[#0F0B0A]">
                        {allLabels.map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => handleToggleLabel(lbl)}
                            className={`px-2.5 py-1 rounded-md text-xs font-mono transition ${
                              targetLabels.includes(lbl)
                                ? 'bg-[#8B5CF6] text-white'
                                : 'bg-[#191311] text-[#B4B0B0] border border-[#38302D]'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#38302D]">
                    <button
                      type="button"
                      onClick={() => setIsComposeOpen(false)}
                      className="rounded px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED]"
                    >
                      Continue to Review
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
