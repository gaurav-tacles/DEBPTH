import React, { useState } from 'react';
import {
  Bell,
  Menu,
  ChevronDown,
  Check,
  UserCheck,
  Shield,
  Layers,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { NavView } from './AppSidebar';

interface AppHeaderProps {
  currentView: NavView;
  onToggleMobileNav: () => void;
  onOpenNotifications: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentView,
  onToggleMobileNav,
  onOpenNotifications,
}) => {
  const {
    currentUser,
    profiles,
    switchUser,
    notifications,
    isSuperAdmin,
    signOut,
  } = useWorkspace();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getBreadcrumbLabel = (view: NavView) => {
    switch (view) {
      case 'overview':
        return 'Overview';
      case 'projects':
      case 'project-detail':
        return 'Projects';
      case 'team':
        return 'Team';
      case 'suggestions':
        return 'Suggestions Center';
      case 'tasks':
        return 'Tasks & Kanban';
      case 'documents':
        return 'Private Documents';
      case 'announcements':
        return 'Announcements';
      case 'security':
        return 'Access & Security';
      case 'settings':
        return 'Settings';
      default:
        return 'Workspace';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#38302D] bg-[#0F0B0A]/95 px-4 backdrop-blur-md">
      {/* Left: Mobile Toggle, Workspace Selector, Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="rounded-lg p-2 text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF] md:hidden"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Workspace Selector */}
        <div className="relative">
          <button
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className="flex items-center gap-2 rounded-lg border border-[#38302D] bg-[#191311] px-2.5 py-1 text-xs font-medium text-[#F4F8FF] hover:border-[#8B5CF6]/50 transition"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#8B5CF6]" />
            <span className="font-semibold tracking-tight">Project Apex</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#B4B0B0]" />
          </button>

          {showWorkspaceMenu && (
            <div
              className="absolute left-0 mt-1 w-64 rounded-xl border border-[#38302D] bg-[#191311] p-1.5 shadow-2xl z-50 text-xs"
              onMouseLeave={() => setShowWorkspaceMenu(false)}
            >
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-[#B4B0B0]">
                Private Developer Workspace
              </div>
              <div className="p-2 rounded-lg bg-[#211B19] text-xs text-[#F4F8FF] border border-[#38302D]/60 mt-1">
                <div className="font-semibold">Project Apex Cluster</div>
                <div className="text-[11px] text-[#B4B0B0] mt-0.5">Single Super Admin · Private Access</div>
              </div>
            </div>
          )}
        </div>

        <span className="text-[#38302D]">/</span>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[#B4B0B0] hidden sm:inline">Workspace</span>
          <span className="text-[#38302D] hidden sm:inline">/</span>
          <span className="font-semibold text-[#F4F8FF]">{getBreadcrumbLabel(currentView)}</span>
        </div>
      </div>

      {/* Right Controls: PWA Install, Notification Bell, Persona Switcher */}
      <div className="flex items-center gap-2.5">
        <PWAInstallButton />

        {/* Notification Button */}
        <button
          onClick={onOpenNotifications}
          className="relative rounded-lg p-2 text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF] transition border border-transparent hover:border-[#38302D]"
          aria-label="Open notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-[#8B5CF6] ring-2 ring-[#0F0B0A]" />
          )}
        </button>

        {/* Persona Switcher Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg border border-[#38302D] bg-[#191311] p-1 pl-2 hover:border-[#8B5CF6]/50 transition"
          >
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-[#F4F8FF] flex items-center gap-1.5 justify-end">
                <span>{currentUser?.fullName || 'User'}</span>
                {isSuperAdmin && (
                  <span className="text-[9px] font-mono uppercase bg-[#8B5CF6]/20 text-[#8B5CF6] px-1 rounded border border-[#8B5CF6]/30">
                    Admin
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#B4B0B0] font-mono truncate max-w-[120px]">
                {currentUser?.email}
              </div>
            </div>

            <div className="relative">
              <img
                src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser?.fullName}
                className="w-7 h-7 rounded-md object-cover ring-1 ring-[#38302D]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#34D399] ring-2 ring-[#191311]" />
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-[#B4B0B0] mr-1" />
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 mt-1 w-72 rounded-xl border border-[#38302D] bg-[#191311] p-2 shadow-2xl z-50 text-xs"
              onMouseLeave={() => setShowUserMenu(false)}
            >
              <div className="px-2 py-1.5 border-b border-[#38302D]">
                <div className="font-semibold text-[#F4F8FF]">{currentUser?.fullName}</div>
                <div className="text-[#B4B0B0] text-[11px] font-mono">{currentUser?.email}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[#B4B0B0]">
                  <span>Role:</span>
                  <span className="font-mono text-[#8B5CF6] font-semibold uppercase">
                    {currentUser?.role}
                  </span>
                  <span>·</span>
                  <span className="text-[#34D399]">MFA: {currentUser?.mfaEnabled ? 'Verified' : 'Disabled'}</span>
                </div>
              </div>

              {/* Persona Switcher for Quick Verification (Isolated to Dev/Demo Mode) */}
              {import.meta.env.DEV && (
                <div className="mt-2">
                  <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[#B4B0B0]">
                    Dev Personas (Local RBAC Preview)
                  </div>
                  <div className="space-y-1 mt-1">
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          switchUser(p.id);
                          setShowUserMenu(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition ${
                          p.id === currentUser?.id
                            ? 'bg-[#8B5CF6]/15 text-[#F4F8FF] font-medium border border-[#8B5CF6]/30'
                            : 'text-[#B4B0B0] hover:bg-[#211B19] hover:text-[#F4F8FF]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={p.avatarUrl}
                            alt=""
                            className="w-5 h-5 rounded object-cover ring-1 ring-[#38302D]"
                          />
                          <span className="truncate text-xs">{p.fullName}</span>
                          <span className="text-[10px] font-mono text-[#B4B0B0]">
                            ({p.role === 'super_admin' ? 'Super Admin' : 'Member'})
                          </span>
                        </div>
                        {p.id === currentUser?.id && <Check className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sign Out Button */}
              <div className="mt-2 pt-2 border-t border-[#38302D]">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#FB7185] hover:bg-[#FB7185]/10 transition cursor-pointer font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
