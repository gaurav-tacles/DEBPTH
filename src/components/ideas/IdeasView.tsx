import React, { useState, useMemo } from 'react';
import {
  Brain,
  Plus,
  Search,
  Filter,
  Trash2,
  Archive,
  ArchiveRestore,
  Tag,
  Clock,
  Sparkles,
  Edit3,
  X,
  Check,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Idea, IdeaCategory, IdeaPriority, IdeaStatus } from '../../types';
import { IdeaCaptureModal } from './IdeaCaptureModal';

export const IdeasView: React.FC = () => {
  const { ideas, createIdea, updateIdea, deleteIdea } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      // Archive filter
      if (selectedStatus === 'active' && idea.isArchived) return false;
      if (selectedStatus === 'archived' && !idea.isArchived) return false;

      // Category filter
      if (selectedCategory !== 'all' && idea.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = idea.title.toLowerCase().includes(q);
        const matchDesc = idea.description.toLowerCase().includes(q);
        const matchTags = idea.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchTags) return false;
      }

      return true;
    });
  }, [ideas, searchQuery, selectedCategory, selectedStatus]);

  const activeCount = ideas.filter((i) => !i.isArchived).length;
  const archivedCount = ideas.filter((i) => i.isArchived).length;

  const handleStartEdit = (idea: Idea) => {
    setEditingIdeaId(idea.id);
    setEditTitle(idea.title);
    setEditDescription(idea.description);
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim()) return;
    updateIdea(id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
    });
    setEditingIdeaId(null);
  };

  const categoryBadgeColors: Record<IdeaCategory, string> = {
    product: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30',
    startup: 'bg-[#3B82F6]/15 text-[#60A5FA] border-[#3B82F6]/30',
    feature: 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30',
    architecture: 'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/30',
    note: 'bg-[#6B7280]/20 text-[#D1D5DB] border-[#6B7280]/30',
    random: 'bg-[#EC4899]/15 text-[#F472B6] border-[#EC4899]/30',
  };

  const priorityColors: Record<IdeaPriority, string> = {
    low: 'text-[#94A3B8]',
    medium: 'text-[#38BDF8]',
    high: 'text-[#FBBF24]',
    urgent: 'text-[#FB7185]',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F4F8FF]">
                Ideas & Concepts
              </h1>
              <p className="text-xs text-[#B4B0B0] mt-0.5">
                Private digital thought vault. Encrypted and accessible only to your account.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#8B5CF6] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#7C3AED] shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Capture Idea</span>
        </button>
      </div>

      {/* 2. Controls & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B4B0B0]" />
          <input
            type="text"
            placeholder="Search ideas, thoughts, notes, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[#38302D] bg-[#191311] pl-10 pr-4 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#B4B0B0] hover:text-[#F4F8FF]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-[#38302D] bg-[#191311] px-3 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="product">Product</option>
            <option value="startup">Startup</option>
            <option value="feature">Feature</option>
            <option value="architecture">Architecture</option>
            <option value="note">Notes</option>
            <option value="random">Random</option>
          </select>

          <div className="flex rounded-xl bg-[#191311] p-1 border border-[#38302D]">
            <button
              onClick={() => setSelectedStatus('active')}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                selectedStatus === 'active'
                  ? 'bg-[#211B19] text-[#F4F8FF] border border-[#38302D]'
                  : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setSelectedStatus('archived')}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                selectedStatus === 'archived'
                  ? 'bg-[#211B19] text-[#F4F8FF] border border-[#38302D]'
                  : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
            >
              Archived ({archivedCount})
            </button>
          </div>
        </div>
      </div>

      {/* 3. Ideas Grid */}
      {filteredIdeas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#38302D] bg-[#191311]/40 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8B5CF6]/10 text-[#8B5CF6]">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[#F4F8FF]">No ideas found</h3>
          <p className="mt-1 text-xs text-[#B4B0B0] max-w-sm mx-auto">
            {searchQuery
              ? 'No thoughts match your current filters. Clear the search query to see all ideas.'
              : 'Have a startup concept, feature brainstorm, or quick architecture note? Tap Capture Idea or the brain floating button.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create your first idea</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIdeas.map((idea) => {
            const isEditing = editingIdeaId === idea.id;
            return (
              <div
                key={idea.id}
                className={`flex flex-col justify-between rounded-2xl border bg-[#191311] p-5 transition shadow-xs ${
                  idea.isArchived
                    ? 'border-[#38302D]/60 opacity-75'
                    : 'border-[#38302D] hover:border-[#8B5CF6]/50'
                }`}
              >
                <div>
                  {/* Card top badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border ${
                        categoryBadgeColors[idea.category] || categoryBadgeColors.note
                      }`}
                    >
                      {idea.category}
                    </span>

                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className={`font-semibold uppercase ${priorityColors[idea.priority]}`}>
                        {idea.priority}
                      </span>
                      <span className="text-[#38302D]">·</span>
                      <span className="text-[#B4B0B0] capitalize">{idea.status}</span>
                    </div>
                  </div>

                  {/* Title & Description or Edit Mode */}
                  {isEditing ? (
                    <div className="space-y-2 mt-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-[#38302D] bg-[#0F0B0A] px-2.5 py-1.5 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                        placeholder="Idea title"
                      />
                      <textarea
                        rows={3}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full rounded-lg border border-[#38302D] bg-[#0F0B0A] px-2.5 py-1.5 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none resize-none"
                        placeholder="Description..."
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => setEditingIdeaId(null)}
                          className="px-2.5 py-1 text-[11px] text-[#B4B0B0] hover:text-[#F4F8FF]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(idea.id)}
                          className="flex items-center gap-1 rounded bg-[#8B5CF6] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#7C3AED]"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-semibold text-sm text-[#F4F8FF] leading-snug">
                        {idea.title}
                      </h3>
                      {idea.description && (
                        <p className="mt-1.5 text-xs text-[#B4B0B0] leading-relaxed whitespace-pre-line">
                          {idea.description}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {idea.tags && idea.tags.length > 0 && !isEditing && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {idea.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-md bg-[#211B19] px-2 py-0.5 text-[10px] font-mono text-[#B4B0B0] border border-[#38302D]"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="mt-4 pt-3 border-t border-[#38302D]/60 flex items-center justify-between text-[11px] text-[#B4B0B0]">
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <Clock className="w-3 h-3 text-[#B4B0B0]" />
                    <span>{new Date(idea.createdAt).toLocaleDateString()}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <button
                        onClick={() => handleStartEdit(idea)}
                        className="rounded p-1.5 text-[#B4B0B0] hover:text-[#F4F8FF] hover:bg-[#211B19] transition"
                        title="Edit idea"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => updateIdea(idea.id, { isArchived: !idea.isArchived })}
                      className="rounded p-1.5 text-[#B4B0B0] hover:text-[#F4F8FF] hover:bg-[#211B19] transition"
                      title={idea.isArchived ? 'Restore to active' : 'Archive idea'}
                    >
                      {idea.isArchived ? (
                        <ArchiveRestore className="w-3.5 h-3.5 text-[#34D399]" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => deleteIdea(idea.id)}
                      className="rounded p-1.5 text-[#B4B0B0] hover:text-[#FB7185] hover:bg-[#FB7185]/10 transition"
                      title="Delete idea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Capture Modal */}
      <IdeaCaptureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(data) => createIdea(data)}
      />
    </div>
  );
};
