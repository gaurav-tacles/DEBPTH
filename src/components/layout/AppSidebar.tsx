import React from 'react';
import {
  ChevronRight,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NavView, NAVIGATION_ITEMS } from '../../config/navigation';

export type { NavView };

interface AppSidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentView, onNavigate }) => {
  const { isSuperAdmin, currentUser, projects, notifications, suggestions, ideas, signOut } = useWorkspace();

  const unreadNotifs = notifications.filter((n) => !n.isRead).length;
  const pendingSuggestions = suggestions.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review'
  ).length;
  const activeIdeasCount = ideas.filter((i) => !i.isArchived).length;

  const getBadgeValue = (badgeKey?: 'projects' | 'ideas' | 'suggestions' | 'announcements') => {
    switch (badgeKey) {
      case 'projects':
        return projects.length > 0 ? projects.length : undefined;
      case 'ideas':
        return activeIdeasCount > 0 ? activeIdeasCount : undefined;
      case 'suggestions':
        return pendingSuggestions > 0 ? pendingSuggestions : undefined;
      case 'announcements':
        return unreadNotifs > 0 ? unreadNotifs : undefined;
      default:
        return undefined;
    }
  };

  return (
    <aside
      aria-label="Desktop Navigation Sidebar"
      className="hidden md:flex flex-col w-64 shrink-0 border-r border-[#38302D] bg-[#0F0B0A] h-[calc(100vh-3.5rem)] sticky top-14 justify-between select-none p-3.5 z-20 overflow-y-auto"
    >
      <div className="space-y-5">
        {/* Workspace Brand Identity */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#38302D] bg-[#191311]/90 shadow-xs">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] text-white font-mono font-bold text-xs shadow-xs">
            <span>▲</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs tracking-tight text-[#F4F8FF]">ProjectHub</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" title="Cluster Active" />
            </div>
            <span className="text-[10px] font-mono text-[#B4B0B0] truncate">Engineering Workspace</span>
          </div>
        </div>

        {/* Grouped Navigation List */}
        <nav className="space-y-4">
          {[
            { key: 'workspace' as const, label: 'Workspace' },
            { key: 'showcase' as const, label: 'Showcase' },
            { key: 'collaboration' as const, label: 'Collaboration' },
            { key: 'system' as const, label: 'System' },
          ].map((section) => {
            const sectionItems = NAVIGATION_ITEMS.filter((item) => item.section === section.key);
            if (sectionItems.length === 0) return null;

            return (
              <div key={section.key} className="space-y-1">
                <div className="px-3 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#B4B0B0]/50 font-medium">
                  {section.label}
                </div>
                {sectionItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    currentView === item.id ||
                    (item.id === 'projects' && currentView === 'project-detail');
                  const badge = getBadgeValue(item.badgeKey);

                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all group cursor-pointer ${
                        isActive
                          ? 'bg-[#211B19] text-[#F4F8FF] font-semibold border border-[#38302D] shadow-xs'
                          : 'text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#8B5CF6]' : 'text-[#B4B0B0] group-hover:text-[#F4F8FF]'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.id === 'built-by-us' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30">
                            New
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {badge !== undefined && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                              isActive
                                ? 'bg-[#8B5CF6]/25 text-[#8B5CF6] font-semibold'
                                : 'bg-[#191311] text-[#B4B0B0] border border-[#38302D]/60'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Current User Profile Area at Bottom */}
      <div className="pt-3 border-t border-[#38302D] mt-4">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#191311] border border-[#38302D]/80 hover:border-[#38302D] transition">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <img
                src={
                  currentUser?.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                }
                alt={currentUser?.fullName || 'User'}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#38302D]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#34D399] ring-2 ring-[#191311]" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#F4F8FF] truncate leading-tight">
                {currentUser?.fullName || 'Super Admin'}
              </span>
              <span className="text-[10px] font-mono text-[#B4B0B0] truncate">
                {isSuperAdmin ? 'SUPER ADMIN' : 'MEMBER'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onNavigate('settings')}
              className="p-1 rounded-lg text-[#B4B0B0] hover:text-[#F4F8FF] hover:bg-[#211B19] transition cursor-pointer"
              title="Settings & Database"
              aria-label="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => signOut()}
              className="p-1 rounded-lg text-[#B4B0B0] hover:text-[#FB7185] hover:bg-[#FB7185]/10 transition cursor-pointer"
              title="Sign Out of Workspace"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
