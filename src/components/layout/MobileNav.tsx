import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Menu,
  X,
  FileText,
  Lightbulb,
  Bell,
  ShieldCheck,
  Settings,
  LogOut,
} from 'lucide-react';
import { NavView } from './AppSidebar';
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
  const { isSuperAdmin, projects, notifications, suggestions, signOut } = useWorkspace();

  const unreadNotifs = notifications.filter((n) => !n.isRead).length;

  const bottomItems = [
    { id: 'team' as NavView, label: 'Team', icon: Users },
    { id: 'overview' as NavView, label: 'Overview', icon: LayoutDashboard },
    { id: 'projects' as NavView, label: 'Projects', icon: FolderKanban },
    { id: 'suggestions' as NavView, label: 'Suggestions', icon: Lightbulb },
    { id: 'announcements' as NavView, label: 'Alerts', icon: Bell, badge: unreadNotifs },
  ];

  const fullNavItems = [
    { id: 'team' as NavView, label: 'Team Directory', icon: Users },
    { id: 'overview' as NavView, label: 'Overview', icon: LayoutDashboard },
    { id: 'projects' as NavView, label: 'Projects', icon: FolderKanban, badge: projects.length },
    { id: 'suggestions' as NavView, label: 'Suggestions Center', icon: Lightbulb },
    { id: 'tasks' as NavView, label: 'Tasks & Kanban', icon: CheckSquare },
    { id: 'documents' as NavView, label: 'Document Library', icon: FileText },
    { id: 'announcements' as NavView, label: 'Announcements', icon: Bell, badge: unreadNotifs },
    { id: 'security' as NavView, label: 'Access & Security', icon: ShieldCheck },
    { id: 'settings' as NavView, label: 'Settings & Database', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs" onClick={onClose} />
          <div className="relative w-72 max-w-[80vw] bg-[#0F0B0A] border-r border-[#38302D] p-4 flex flex-col justify-between z-10 shadow-2xl h-full text-[#F4F8FF]">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#38302D]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] font-mono font-bold text-xs text-white">
                    ▲
                  </div>
                  <div>
                    <span className="font-semibold text-xs tracking-tight text-[#F4F8FF]">Project Apex</span>
                    <div className="text-[10px] text-[#B4B0B0] font-mono">Internal Workspace</div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded p-1.5 text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF]"
                  aria-label="Close Navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-1">
                {fullNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition ${
                        isActive
                          ? 'bg-[#211B19] text-[#F4F8FF] font-semibold border border-[#38302D]'
                          : 'text-[#B4B0B0] hover:bg-[#191311] hover:text-[#F4F8FF]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#8B5CF6]' : 'text-[#B4B0B0]'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="text-[10px] font-mono text-[#8B5CF6] bg-[#8B5CF6]/20 px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#38302D] pt-3 text-[11px] text-[#B4B0B0] flex items-center justify-between">
              <div>
                <div>Role: {isSuperAdmin ? 'Super Admin' : 'Member'}</div>
                <div className="text-[10px] text-[#B4B0B0]/60 mt-0.5 font-mono">Project Apex SaaS · 2026</div>
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
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-14 w-full items-center justify-around border-t border-[#38302D] bg-[#0F0B0A]/95 px-2 backdrop-blur-md md:hidden">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] transition relative ${
                isActive ? 'text-[#8B5CF6] font-semibold' : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#8B5CF6]" />
                )}
              </div>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
