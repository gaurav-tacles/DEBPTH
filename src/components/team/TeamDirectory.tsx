import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Key,
  ShieldCheck,
  ShieldAlert,
  Search,
  MoreVertical,
  Plus,
  X,
  Copy,
  Check,
  Mail,
  ExternalLink,
  Shield,
  Tag,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { UserProfile } from '../../types';
import { InviteMemberModal } from './InviteMemberModal';
import { RedeemInviteModal } from './RedeemInviteModal';

export const TeamDirectory: React.FC = () => {
  const {
    profiles,
    isSuperAdmin,
    currentUser,
    invitations,
    createInvitation,
    updateProfileLabels,
    projects,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [newLabelUserId, setNewLabelUserId] = useState<string | null>(null);
  const [newLabelText, setNewLabelText] = useState('');
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Predefined filter chips specified in requirements
  const filterChips = [
    { label: 'All members (4)', value: 'All' },
    { label: 'Architecture', value: 'Architecture' },
    { label: 'Security', value: 'Security' },
    { label: 'Frontend', value: 'Frontend' },
    { label: 'UI/UX', value: 'UI/UX' },
    { label: 'Backend', value: 'Backend' },
    { label: 'DevOps', value: 'DevOps' },
    { label: 'Mobile', value: 'Mobile' },
  ];

  // Filter profiles based on search and selected filter chip
  const filteredProfiles = useMemo(() => {
    return profiles.filter((member) => {
      // Filter chip
      const matchesFilter =
        selectedFilter === 'All' || member.labels.some((l) => l.toLowerCase() === selectedFilter.toLowerCase());

      // Search query (name, email, handle, skills/labels)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        member.fullName.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        (member.githubUsername && member.githubUsername.toLowerCase().includes(q)) ||
        member.labels.some((l) => l.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [profiles, selectedFilter, searchQuery]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const handleAddLabel = (userId: string) => {
    if (!newLabelText.trim()) return;
    updateProfileLabels(userId, newLabelText.trim(), 'add');
    setNewLabelText('');
    setNewLabelUserId(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F8FF]">Team directory</h1>
          <p className="text-xs text-[#B4B0B0] mt-1">
            Manage collaborators, roles, and technical expertise.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRedeemModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-[#38302D] bg-[#191311] px-3.5 py-2 text-xs font-semibold text-[#F4F8FF] hover:bg-[#211B19] hover:border-[#8B5CF6]/50 transition-all shadow-xs"
          >
            <Key className="w-3.5 h-3.5 text-[#B4B0B0]" />
            <span>Redeem token</span>
          </button>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED] shadow-sm transition-all focus:ring-2 focus:ring-[#8B5CF6]/40"
          >
            <UserPlus className="w-3.5 h-3.5 text-white" />
            <span>Invite member</span>
          </button>
        </div>
      </div>

      {/* 2. Full-Width Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B4B0B0]" />
        <input
          type="text"
          placeholder="Search members, handles, or skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-[#38302D] bg-[#191311] pl-10 pr-4 py-2.5 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] transition-all"
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

      {/* 3. Compact Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterChips.map((chip) => {
          const isActive = selectedFilter === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setSelectedFilter(chip.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#8B5CF6] text-white shadow-xs'
                  : 'border border-[#38302D] bg-[#191311] text-[#B4B0B0] hover:bg-[#211B19] hover:text-[#F4F8FF]'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 4. Team Member Cards Grid */}
      {filteredProfiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#38302D] bg-[#191311]/60 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#211B19] text-[#B4B0B0] border border-[#38302D]">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#F4F8FF]">No members found</h3>
          <p className="text-xs text-[#B4B0B0] max-w-sm mx-auto">
            No team members matched "{searchQuery}". Try searching for another skill, handle, or clear filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedFilter('All');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#38302D] bg-[#211B19] px-3 py-1.5 text-xs text-[#F4F8FF] hover:bg-[#38302D]"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProfiles.map((member) => {
            const isCurrentUser = member.id === currentUser?.id || member.email === 'gauravp18189@gmail.com';
            const isSuperAdminRole = member.role === 'super_admin';

            return (
              <div
                key={member.id}
                className={`relative rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between ${
                  isCurrentUser
                    ? 'border border-[#8B5CF6]/70 bg-[#191311] shadow-[0_0_24px_rgba(139,92,246,0.08)]'
                    : 'border border-[#38302D] bg-[#191311] hover:border-[#4A423F] hover:bg-[#1C1614]'
                }`}
              >
                <div>
                  {/* Top: Avatar, Names, Role Badge, Menu */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <img
                          src={member.avatarUrl}
                          alt={member.fullName}
                          className="w-12 h-12 rounded-xl object-cover ring-1 ring-[#38302D]"
                        />
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#34D399] ring-2 ring-[#191311]"
                          title="Online & Active"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#F4F8FF] truncate leading-tight">
                            {member.fullName}
                          </h3>
                          {isCurrentUser && (
                            <span className="rounded-md bg-[#8B5CF6]/20 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[#8B5CF6] border border-[#8B5CF6]/30">
                              You
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#B4B0B0] font-mono truncate mt-0.5">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    {/* Right: Role Badge & Context Menu */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider ${
                          isSuperAdminRole
                            ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30'
                            : 'bg-[#211B19] text-[#B4B0B0] border border-[#38302D]'
                        }`}
                      >
                        {isSuperAdminRole ? 'SUPER ADMIN' : 'MEMBER'}
                      </span>

                      {/* Three-dot context menu */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMenuUserId(activeMenuUserId === member.id ? null : member.id)
                          }
                          className="rounded-lg p-1.5 text-[#B4B0B0] hover:bg-[#211B19] hover:text-[#F4F8FF] transition"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuUserId === member.id && (
                          <div
                            className="absolute right-0 mt-1 w-48 rounded-xl border border-[#38302D] bg-[#211B19] p-1.5 shadow-2xl z-40 text-xs"
                            onMouseLeave={() => setActiveMenuUserId(null)}
                          >
                            <button
                              onClick={() => {
                                handleCopy(member.email);
                                setActiveMenuUserId(null);
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF] transition"
                            >
                              <Mail className="w-3.5 h-3.5 text-[#B4B0B0]" />
                              <span>Copy email</span>
                            </button>

                            {member.githubUsername && (
                              <button
                                onClick={() => {
                                  handleCopy(`@${member.githubUsername}`);
                                  setActiveMenuUserId(null);
                                }}
                                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF] transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-[#B4B0B0]" />
                                <span>Copy handle</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setNewLabelUserId(member.id);
                                setActiveMenuUserId(null);
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF] transition"
                            >
                              <Tag className="w-3.5 h-3.5 text-[#B4B0B0]" />
                              <span>Add label</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle row: MFA status & Developer handle */}
                  <div className="mt-4 flex items-center justify-between text-xs border-t border-[#38302D]/60 pt-3">
                    {/* MFA Status */}
                    <div className="flex items-center gap-1.5">
                      {member.mfaEnabled ? (
                        <div className="flex items-center gap-1.5 text-[#34D399]">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
                          <span className="font-medium text-xs">MFA Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[#FB7185]">
                          <ShieldAlert className="w-3.5 h-3.5 text-[#FB7185]" />
                          <span className="font-medium text-xs">MFA Disabled</span>
                        </div>
                      )}
                    </div>

                    {/* Developer handle */}
                    {member.githubUsername && (
                      <span className="font-mono text-xs text-[#22D3EE] bg-[#0F0B0A] px-2 py-0.5 rounded-md border border-[#38302D]">
                        @{member.githubUsername}
                      </span>
                    )}
                  </div>

                  {/* Metadata Labels Section */}
                  <div className="mt-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {member.labels.map((lbl, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-md border border-[#38302D] bg-[#0F0B0A] px-2 py-1 text-[11px] font-mono text-[#F4F8FF]"
                        >
                          <span>{lbl}</span>
                          {isSuperAdmin && (
                            <button
                              onClick={() => updateProfileLabels(member.id, lbl, 'remove')}
                              className="text-[#B4B0B0] hover:text-[#FB7185] ml-0.5"
                              title={`Remove ${lbl}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}

                      {/* Add Label Trigger Button */}
                      {newLabelUserId !== member.id && (
                        <button
                          onClick={() => setNewLabelUserId(member.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#38302D] px-2 py-1 text-[11px] text-[#B4B0B0] hover:border-[#8B5CF6] hover:text-[#8B5CF6] transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Label</span>
                        </button>
                      )}
                    </div>

                    {/* Inline input for adding label */}
                    {newLabelUserId === member.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="e.g. Distributed Systems"
                          value={newLabelText}
                          onChange={(e) => setNewLabelText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddLabel(member.id)}
                          className="flex-1 rounded-lg border border-[#8B5CF6] bg-[#0F0B0A] px-2.5 py-1 text-xs text-[#F4F8FF] focus:outline-none"
                        />
                        <button
                          onClick={() => handleAddLabel(member.id)}
                          className="rounded-lg bg-[#8B5CF6] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#7C3AED]"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setNewLabelUserId(null)}
                          className="text-[#B4B0B0] hover:text-[#F4F8FF] text-xs px-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Modals for Inviting and Redeeming */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        projects={projects}
        onInvite={(email, role, initialLabels, assignedProjectIds, expiresInDays) =>
          createInvitation(email, role, initialLabels, assignedProjectIds, expiresInDays)
        }
      />

      <RedeemInviteModal
        isOpen={isRedeemModalOpen}
        onClose={() => setIsRedeemModalOpen(false)}
      />

      {/* Copy notification toast */}
      {copiedText && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-[#211B19] border border-[#8B5CF6] text-[#F4F8FF] px-3.5 py-2 text-xs shadow-xl animate-fade-in">
          <Check className="w-3.5 h-3.5 text-[#34D399]" />
          <span>Copied to clipboard: {copiedText}</span>
        </div>
      )}
    </div>
  );
};
