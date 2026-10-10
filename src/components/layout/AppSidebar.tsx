import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Lightbulb,
  ShieldCheck,
  Settings,
  Bell,
  CheckSquare,
  FileText,
  ChevronRight,
  Terminal,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export type NavView =
  | 'overview'
  | 'projects'
  | 'project-detail'
  | 'team'
  | 'suggestions'
  | 'tasks'
  | 'documents'
  | 'announcements'
  | 'security'
  | 'settings';

interface AppSidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentView, onNavigate }) => {
  const { isSuperAdmin, currentUser, projects, notifications, suggestions, signOut } = useWorkspace();

  const unreadNotifs = notifications.filter((n) => !n.isRead).length;
  const pendingSuggestions = suggestions.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review'
  ).length;

  const navItems = [
    { id: 'overview' as NavView, label: 'Overview', icon: LayoutDashboard },
    { id: 'projects' as NavView, label: 'Projects', icon: FolderKanban, badge: projects.length },
    { id: 'team' as NavView, label: 'Team', icon: Users, featured: true },
    {
      id: 'suggestions' as NavView,
      label: 'Suggestions',
      icon: Lightbulb,
      badge: pendingSuggestions > 0 ? pendingSuggestions : undefined,
    },
    { id: 'tasks' as NavView, label: 'Tasks', icon: CheckSquare },
    { id: 'documents' as NavView, label: 'Documents', icon: FileText },
    {
      id: 'announcements' as NavView,
      label: 'Announcements',
      icon: Bell,
      badge: unreadNotifs > 0 ? unreadNotifs : undefined,
    },
    { id: 'security' as NavView, label: 'Access & Security', icon: ShieldCheck },
    { id: 'settings' as NavView, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-[#38302D] bg-[#0F0B0A] h-[calc(100vh-3.5rem)] sticky top-14 justify-between select-none p-3.5 z-20">
      <div className="space-y-6">
        {/* Project Apex Brand Identity */}
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg border border-[#38302D]/60 bg-[#191311]">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] text-white font-mono font-bold text-xs shadow-xs">
            <span>▲</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs tracking-tight text-[#F4F8FF]">Project Apex</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" title="Cluster Active" />
            </div>
            <span className="text-[10px] font-mono text-[#B4B0B0] truncate">Internal Workspace</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id || (item.id === 'projects' && currentView === 'project-detail');

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-[#211B19] text-[#F4F8FF] font-semibold border border-[#38302D] shadow-xs'
                    : 'text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-[#8B5CF6]' : 'text-[#B4B0B0] group-hover:text-[#F4F8FF]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge !== undefined && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                        isActive
                          ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] font-semibold'
                          : 'bg-[#191311] text-[#B4B0B0] border border-[#38302D]/60'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Current User Profile Area at Bottom */}
      <div className="pt-3 border-t border-[#38302D]">
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#191311] border border-[#38302D]/70 hover:border-[#38302D] transition">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <img
                src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser?.fullName}
                className="w-7 h-7 rounded-md object-cover ring-1 ring-[#38302D]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#34D399] ring-2 ring-[#191311]" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#F4F8FF] truncate leading-tight">
                {currentUser?.fullName}
              </span>
              <span className="text-[10px] font-mono text-[#B4B0B0] truncate">
                {isSuperAdmin ? 'SUPER ADMIN' : 'MEMBER'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigate('settings')}
              className="p-1 rounded text-[#B4B0B0] hover:text-[#F4F8FF] hover:bg-[#211B19] transition"
              title="Account Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => signOut()}
              className="p-1 rounded text-[#B4B0B0] hover:text-[#FB7185] hover:bg-[#FB7185]/10 transition"
              title="Sign Out of Workspace"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
