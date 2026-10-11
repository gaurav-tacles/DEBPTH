import React from 'react';
import {
  X,
  LogOut,
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  Users,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { NavView, NAVIGATION_ITEMS } from '../../config/navigation';
import { useWorkspace } from '../../context/WorkspaceContext';

interface MobileNavProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  isOpen: boolean;
  onClose: () => void;
  unreadCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentView,
  onNavigate,
  isOpen,
  onClose,
}) => {
  const { isSuperAdmin, projects, notifications, suggestions, ideas, signOut } = useWorkspace();

  const unreadNotifs = notifications.filter((n) => !n.isRead).length;
  const activeIdeasCount = ideas.filter((i) => !i.isArchived).length;
  const pendingSuggestions = suggestions.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review'
  ).length;

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

  const bottomItems = [
    { id: 'overview' as NavView, label: 'Overview', icon: LayoutDashboard },
    { id: 'projects' as NavView, label: 'Projects', icon: FolderKanban, badge: projects.length },
    { id: 'built-by-us' as NavView, label: 'Built by Us', icon: Sparkles },
    { id: 'team' as NavView, label: 'Team', icon: Users },
    { id: 'announcements' as NavView, label: 'Alerts', icon: Bell, badge: unreadNotifs },
  ];

  return (
    <>
      {/* Mobile Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs" onClick={onClose} />
          <div className="relative w-72 max-w-[85vw] bg-[#0F0B0A] border-r border-[#38302D] p-4 flex flex-col justify-between z-10 shadow-2xl h-full text-[#F4F8FF] overflow-y-auto">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#38302D]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] font-mono font-bold text-xs text-white">
                    ▲
                  </div>
                  <div>
                    <span className="font-semibold text-xs tracking-tight text-[#F4F8FF]">ProjectHub</span>
                    <div className="text-[10px] text-[#B4B0B0] font-mono">Mobile Workspace</div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF] cursor-pointer"
                  aria-label="Close Navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <div className="mt-4 space-y-1">
                {NAVIGATION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    currentView === item.id ||
                    (item.id === 'projects' && currentView === 'project-detail');
                  const badge = getBadgeValue(item.badgeKey);

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition cursor-pointer ${
                        isActive
                          ? 'bg-[#211B19] text-[#F4F8FF] font-semibold border border-[#38302D]'
                          : 'text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#8B5CF6]' : 'text-[#B4B0B0]'
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
            </div>

            {/* Footer */}
            <div className="border-t border-[#38302D] pt-3 mt-6 text-[11px] text-[#B4B0B0] flex items-center justify-between">
              <div>
                <div>Role: {isSuperAdmin ? 'Super Admin' : 'Member'}</div>
                <div className="text-[10px] text-[#B4B0B0]/60 mt-0.5 font-mono">DevLead Labs · 2026</div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  signOut();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#FB7185]/30 text-[#FB7185] hover:bg-[#FB7185]/10 text-xs font-medium cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (min 48px touch targets) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-14 w-full items-center justify-around border-t border-[#38302D] bg-[#0F0B0A]/95 px-2 backdrop-blur-md md:hidden"
      >
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentView === item.id ||
            (item.id === 'projects' && currentView === 'project-detail');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] transition relative cursor-pointer ${
                isActive ? 'text-[#8B5CF6] font-semibold' : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#8B5CF6]" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-[60px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
