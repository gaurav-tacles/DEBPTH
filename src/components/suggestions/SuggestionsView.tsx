import React, { useState } from 'react';
import {
  Lightbulb,
  Plus,
  ArrowRight,
  MessageSquare,
  CheckCircle,
  Clock,
  Check,
  X,
  Filter,
  CheckSquare,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  ShieldAlert,
  FolderKanban,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Suggestion, Task, Priority } from '../../types';

export const SuggestionsView: React.FC = () => {
  const {
    suggestions,
    projects,
    currentUser,
    isSuperAdmin,
    createSuggestion,
    updateSuggestionStatus,
    convertSuggestionToTask,
    profiles,
  } = useWorkspace();

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Submit form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Suggestion['category']>('feature');
  const [projectId, setProjectId] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // Admin response modal state
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [newStatus, setNewStatus] = useState<Suggestion['status']>('under_review');

  // Convert to task modal state
  const [convertModalSug, setConvertModalSug] = useState<Suggestion | null>(null);
  const [convertTargetProjectId, setConvertTargetProjectId] = useState<string>('');
  const [convertPriority, setConvertPriority] = useState<Priority>('medium');
  const [convertAssigneeId, setConvertAssigneeId] = useState<string>('');

  // Image lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const filteredSuggestions = suggestions.filter((s) => {
    const matchCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchStatus = selectedStatus === 'all' || s.status === selectedStatus;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.submitter?.fullName && s.submitter.fullName.toLowerCase().includes(q));

    return matchCat && matchStatus && matchSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    createSuggestion({
      title: title.trim(),
      description: description.trim(),
      category,
      projectId: projectId || undefined,
      submitterId: currentUser?.id || '',
      attachmentUrl: attachmentUrl.trim() || undefined,
      attachmentName: attachmentName.trim() || (attachmentUrl ? 'screenshot.png' : undefined),
    });

    setTitle('');
    setDescription('');
    setAttachmentUrl('');
    setAttachmentName('');
    setIsSubmitModalOpen(false);
  };

  const handleAdminUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSuggestion) return;

    updateSuggestionStatus(activeSuggestion.id, newStatus, adminNotes, adminResponse);
    setActiveSuggestion(null);
  };

  const handleExecuteConvert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertModalSug || !convertTargetProjectId) return;

    convertSuggestionToTask(
      convertModalSug.id,
      convertTargetProjectId,
      convertPriority,
      convertAssigneeId || undefined
    );

    setConvertModalSug(null);
  };

  const getStatusBadge = (status: Suggestion['status']) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="font-mono text-[10px] uppercase font-bold text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded border border-[#3B82F6]/30">
            Submitted
          </span>
        );
      case 'under_review':
        return (
          <span className="font-mono text-[10px] uppercase font-bold text-[#FBBF24] bg-[#FBBF24]/10 px-2 py-0.5 rounded border border-[#FBBF24]/30">
            Under Review
          </span>
        );
      case 'accepted':
        return (
          <span className="font-mono text-[10px] uppercase font-bold text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded border border-[#34D399]/30">
            Accepted
          </span>
        );
      case 'planned':
        return (
          <span className="font-mono text-[10px] uppercase font-bold text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded border border-[#8B5CF6]/30">
            Planned
          </span>
        );
      case 'declined':
        return (
          <span className="font-mono text-[10px] uppercase font-bold text-[#FB7185] bg-[#FB7185]/10 px-2 py-0.5 rounded border border-[#FB7185]/30">
            Declined
          </span>
        );
      case 'implemented':
        return (
          <span className="font-mono text-[10px] uppercase font-bold text-[#22D3EE] bg-[#22D3EE]/10 px-2 py-0.5 rounded border border-[#22D3EE]/30">
            Implemented
          </span>
        );
    }
  };

  const getCategoryLabel = (category: Suggestion['category']) => {
    switch (category) {
      case 'idea':
        return 'Project Idea';
      case 'feature':
        return 'Feature Request';
      case 'bug':
        return 'Bug Report';
      case 'workflow':
        return 'Workflow Change';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F8FF]">Suggestions Center</h1>
          <p className="text-xs text-[#B4B0B0] mt-1">
            Submit new project proposals, feature enhancements, workflow improvements, or bug reports with screenshot attachments.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED] shadow-sm transition-all focus:ring-2 focus:ring-[#8B5CF6]/40"
        >
          <Plus className="w-4 h-4" />
          <span>New suggestion</span>
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#38302D] pb-3.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: 'all', label: 'All Categories' },
              { id: 'idea', label: 'Project Ideas' },
              { id: 'feature', label: 'Feature Requests' },
              { id: 'bug', label: 'Bug Reports' },
              { id: 'workflow', label: 'Workflows' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#8B5CF6] text-white shadow-xs'
                  : 'border border-[#38302D] bg-[#191311] text-[#B4B0B0] hover:bg-[#211B19] hover:text-[#F4F8FF]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Status filter dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#B4B0B0]">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-[#38302D] bg-[#191311] px-2.5 py-1.5 text-xs text-[#F4F8FF] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="accepted">Accepted</option>
            <option value="planned">Planned</option>
            <option value="declined">Declined</option>
            <option value="implemented">Implemented</option>
          </select>
        </div>
      </div>

      {/* 3. Suggestions List */}
      <div className="space-y-4">
        {filteredSuggestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#38302D] bg-[#191311]/50 p-12 text-center space-y-3">
            <Lightbulb className="w-8 h-8 text-[#B4B0B0] mx-auto opacity-40" />
            <h3 className="text-sm font-semibold text-[#F4F8FF]">No suggestions found</h3>
            <p className="text-xs text-[#B4B0B0] max-w-sm mx-auto">
              Be the first to propose a project idea, architectural feature, or defect report.
            </p>
          </div>
        ) : (
          filteredSuggestions.map((sug) => {
            const proj = projects.find((p) => p.id === sug.projectId);

            return (
              <div
                key={sug.id}
                className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-4 hover:border-[#4A423F] transition-all"
              >
                {/* Header row: Category, Project tag, Status badge, Submitter info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] uppercase font-bold text-[#22D3EE] bg-[#22D3EE]/10 px-2 py-0.5 rounded border border-[#22D3EE]/30">
                      {getCategoryLabel(sug.category)}
                    </span>

                    {proj ? (
                      <span className="text-xs text-[#8B5CF6] font-medium flex items-center gap-1">
                        <span>{proj.name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[#B4B0B0]">General Workspace</span>
                    )}

                    <span className="text-[#38302D]">·</span>
                    <span className="text-xs text-[#B4B0B0]">
                      Submitted by <strong className="text-[#F4F8FF]">{sug.submitter?.fullName || 'Member'}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(sug.status)}
                    {sug.convertedTaskId && (
                      <span className="text-[10px] font-mono text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded border border-[#34D399]/30">
                        Converted to Task
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-semibold text-[#F4F8FF]">{sug.title}</h3>
                  <p className="mt-1.5 text-xs text-[#B4B0B0] leading-relaxed whitespace-pre-line">
                    {sug.description}
                  </p>
                </div>

                {/* Attachment / Screenshot preview */}
                {sug.attachmentUrl && (
                  <div className="pt-2">
                    <div className="text-[11px] font-mono text-[#B4B0B0] mb-1.5 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      <span>Attachment: {sug.attachmentName || 'screenshot.png'}</span>
                    </div>

                    <div
                      onClick={() => setLightboxImage(sug.attachmentUrl || null)}
                      className="relative inline-block max-w-sm rounded-xl overflow-hidden border border-[#38302D] bg-[#0F0B0A] cursor-pointer hover:border-[#8B5CF6] transition group"
                    >
                      <img
                        src={sug.attachmentUrl}
                        alt="Screenshot"
                        className="max-h-48 w-full object-cover group-hover:scale-102 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-semibold text-white">
                        Click to expand
                      </div>
                    </div>
                  </div>
                )}

                {/* Official Responses & Admin Notes */}
                {(sug.adminResponse || (isSuperAdmin && sug.adminNotes)) && (
                  <div className="rounded-xl border border-[#38302D] bg-[#211B19] p-4 text-xs space-y-2.5">
                    {sug.adminResponse && (
                      <div>
                        <div className="text-[10px] font-mono uppercase font-bold text-[#8B5CF6] tracking-wider">
                          Official Admin Response
                        </div>
                        <p className="text-[#F4F8FF] mt-1 leading-relaxed">{sug.adminResponse}</p>
                      </div>
                    )}

                    {isSuperAdmin && sug.adminNotes && (
                      <div className="border-t border-[#38302D] pt-2">
                        <div className="text-[10px] font-mono uppercase font-bold text-[#FBBF24] tracking-wider">
                          Private Admin Notes (Super Admin Only)
                        </div>
                        <p className="text-[#B4B0B0] mt-1 leading-relaxed">{sug.adminNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#38302D]/60 text-xs">
                  <span className="text-[11px] font-mono text-[#B4B0B0]">
                    Submitted: {new Date(sug.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2.5">
                    {/* Super Admin: Convert to Task Button */}
                    {isSuperAdmin && !sug.convertedTaskId && (
                      <button
                        onClick={() => {
                          setConvertModalSug(sug);
                          setConvertTargetProjectId(sug.projectId || projects[0]?.id || '');
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-[#34D399]/40 bg-[#34D399]/10 px-3 py-1.5 text-xs font-semibold text-[#34D399] hover:bg-[#34D399]/20 transition"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Convert to project task</span>
                      </button>
                    )}

                    {/* Super Admin: Manage & Respond */}
                    {isSuperAdmin && (
                      <button
                        onClick={() => {
                          setActiveSuggestion(sug);
                          setAdminNotes(sug.adminNotes || '');
                          setAdminResponse(sug.adminResponse || '');
                          setNewStatus(sug.status);
                        }}
                        className="rounded-lg bg-[#211B19] border border-[#38302D] px-3 py-1.5 text-xs font-semibold text-[#F4F8FF] hover:bg-[#38302D] transition"
                      >
                        Manage & Respond
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Submit Suggestion Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#38302D] bg-[#191311] p-6 shadow-2xl text-[#F4F8FF]">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#8B5CF6]" />
                <h3 className="font-semibold text-sm">Submit New Suggestion</h3>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="rounded p-1 text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Suggestion['category'])}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="feature">Feature Request</option>
                  <option value="idea">Project Idea</option>
                  <option value="bug">Bug Report / Defect</option>
                  <option value="workflow">Workflow Change</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Related Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="">General Workspace Proposal</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Suggestion Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement distributed trace sampling"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail the technical rationale, reproduction steps, or workflow impact..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              {/* Optional Attachment / Screenshot */}
              <div className="space-y-2 border-t border-[#38302D] pt-3">
                <label className="text-[11px] font-medium text-[#B4B0B0] flex items-center justify-between">
                  <span>Screenshot Attachment (Image URL or Mock Attachment)</span>
                  <span className="text-[10px] text-[#22D3EE]">Optional</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/screenshot.png"
                  value={attachmentUrl}
                  onChange={(e) => {
                    setAttachmentUrl(e.target.value);
                    if (e.target.value && !attachmentName) setAttachmentName('screenshot.png');
                  }}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none font-mono"
                />

                {/* Quick mock image presets for rapid testing */}
                <div className="flex items-center gap-2 pt-1 text-[11px] text-[#B4B0B0]">
                  <span>Quick samples:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentUrl('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80');
                      setAttachmentName('benchmark-metrics.png');
                    }}
                    className="text-[#8B5CF6] hover:underline"
                  >
                    Benchmark Diagram
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentUrl('https://images.unsplash.com/photo-1526498460520-4c246339dccb?w=800&auto=format&fit=crop&q=80');
                      setAttachmentName('mobile-ui-flow.png');
                    }}
                    className="text-[#8B5CF6] hover:underline"
                  >
                    Mobile Flow
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#38302D]">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED]"
                >
                  Submit Suggestion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Super Admin Review & Respond Modal */}
      {activeSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#38302D] bg-[#191311] p-6 shadow-2xl text-[#F4F8FF]">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
              <h3 className="font-semibold text-sm">Review & Respond to Suggestion</h3>
              <button
                onClick={() => setActiveSuggestion(null)}
                className="rounded p-1 text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminUpdate} className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#0F0B0A] border border-[#38302D]">
                <div className="font-semibold text-[#F4F8FF]">{activeSuggestion.title}</div>
                <p className="text-[#B4B0B0] text-xs mt-1 line-clamp-2">{activeSuggestion.description}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Lifecycle Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Suggestion['status'])}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="accepted">Accepted</option>
                  <option value="planned">Planned</option>
                  <option value="implemented">Implemented</option>
                  <option value="declined">Declined</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">
                  Official Submitter Response (Visible to Submitter)
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide architectural feedback or next steps..."
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">
                  Private Admin Notes (Super Admin Only)
                </label>
                <textarea
                  rows={2}
                  placeholder="Internal evaluation notes..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#38302D]">
                <button
                  type="button"
                  onClick={() => setActiveSuggestion(null)}
                  className="rounded px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED]"
                >
                  Save Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Convert to Task Modal */}
      {convertModalSug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#38302D] bg-[#191311] p-6 shadow-2xl text-[#F4F8FF]">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#34D399]" />
                <h3 className="font-semibold text-sm">Convert Suggestion to Task</h3>
              </div>
              <button
                onClick={() => setConvertModalSug(null)}
                className="rounded p-1 text-[#B4B0B0] hover:text-[#F4F8FF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteConvert} className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#0F0B0A] border border-[#38302D]">
                <div className="font-semibold text-[#F4F8FF]">{convertModalSug.title}</div>
                <div className="text-[11px] text-[#B4B0B0] mt-1 line-clamp-2">
                  {convertModalSug.description}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">Target Project *</label>
                <select
                  required
                  value={convertTargetProjectId}
                  onChange={(e) => setConvertTargetProjectId(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#B4B0B0]">Priority</label>
                  <select
                    value={convertPriority}
                    onChange={(e) => setConvertPriority(e.target.value as Priority)}
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:outline-none"
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
                    value={convertAssigneeId}
                    onChange={(e) => setConvertAssigneeId(e.target.value)}
                    className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:outline-none"
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

              <p className="text-[11px] text-[#B4B0B0]">
                The new task will inherit all suggestion context and notify the assignee automatically.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#38302D]">
                <button
                  type="button"
                  onClick={() => setConvertModalSug(null)}
                  className="rounded px-3 py-1.5 text-xs text-[#B4B0B0] hover:text-[#F4F8FF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#34D399] px-4 py-2 text-xs font-semibold text-[#0F0B0A] hover:bg-[#34D399]/90"
                >
                  Create Project Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Image Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={lightboxImage} alt="Attachment" className="max-h-[85vh] rounded-xl object-contain" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
