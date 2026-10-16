import React, { useState } from 'react';
import { X, Sparkles, Brain, AlertCircle } from 'lucide-react';
import { Idea, IdeaCategory, IdeaPriority, IdeaStatus } from '../../types';

interface IdeaCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>) => void;
  initialCategory?: IdeaCategory;
}

export const IdeaCaptureModal: React.FC<IdeaCaptureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialCategory = 'note',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IdeaCategory>(initialCategory);
  const [priority, setPriority] = useState<IdeaPriority>('medium');
  const [status, setStatus] = useState<IdeaStatus>('inbox');
  const [tagInput, setTagInput] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasUnsavedContent = title.trim().length > 0 || description.trim().length > 10;

  const handleRequestClose = () => {
    if (hasUnsavedContent) {
      setShowDiscardConfirm(true);
    } else {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setCategory('note');
    setPriority('medium');
    setStatus('inbox');
    setTagInput('');
    setError(null);
    setShowDiscardConfirm(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title or quick summary for your idea.');
      return;
    }

    const tags = tagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    onSave({
      userId: '', // populated in context
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status,
      tags,
    });

    resetAndClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-[#38302D] bg-[#191311] p-5 sm:p-6 shadow-2xl text-[#F4F8FF] max-h-[calc(100dvh-1rem)] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#F4F8FF]">Capture an idea</h2>
              <p className="text-[11px] text-[#B4B0B0]">Personal & encrypted workspace thought</p>
            </div>
          </div>
          <button
            onClick={handleRequestClose}
            className="rounded-lg p-1.5 text-[#B4B0B0] hover:bg-[#211B19] hover:text-[#F4F8FF] transition"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Unsaved content warning */}
        {showDiscardConfirm ? (
          <div className="py-6 space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Discard unsaved idea?</p>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  You have entered content that will be lost if you leave without saving.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-[#B4B0B0] hover:text-[#F4F8FF] hover:bg-[#211B19]"
              >
                Continue editing
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                className="rounded-lg bg-[#FB7185] px-4 py-2 text-xs font-semibold text-white hover:bg-[#F43F5E]"
              >
                Discard idea
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            {error && (
              <div className="rounded-xl border border-[#FB7185]/30 bg-[#FB7185]/10 p-2.5 text-[#FB7185] text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0]">Idea title or thought *</label>
              <input
                type="text"
                required
                placeholder="e.g. AI-grounded architecture migration planner..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3.5 py-2.5 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0]">
                Notes, context, or technical details (optional)
              </label>
              <textarea
                rows={4}
                placeholder="Key hypothesis, architecture bullets, problem statement, revenue model..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3.5 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#B4B0B0]">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IdeaCategory)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="product">Product</option>
                  <option value="startup">Startup</option>
                  <option value="feature">Feature</option>
                  <option value="architecture">Architecture</option>
                  <option value="note">Quick Note</option>
                  <option value="random">Random</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#B4B0B0]">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as IdeaPriority)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#B4B0B0]">Stage</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IdeaStatus)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-2.5 py-2 text-xs text-[#F4F8FF] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="inbox">Inbox</option>
                  <option value="exploring">Exploring</option>
                  <option value="validated">Validated</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#B4B0B0]">
                Tags (comma-separated, optional)
              </label>
              <input
                type="text"
                placeholder="e.g. saas, ml, prototype, monetization"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3.5 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/50 focus:border-[#8B5CF6] focus:outline-none font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#38302D]">
              <span className="text-[10px] text-[#B4B0B0] font-mono">
                Private to your account
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="rounded-lg px-3.5 py-2 text-xs text-[#B4B0B0] hover:text-[#F4F8FF] hover:bg-[#211B19] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED] shadow-sm transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save Idea</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
