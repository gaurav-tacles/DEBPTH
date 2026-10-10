import React, { useState } from 'react';
import {
  X,
  CheckCheck,
  Bell,
  ArrowRight,
  CheckSquare,
  FileText,
  Lightbulb,
  Mail,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTo: (view: string, projectId?: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateTo,
}) => {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useWorkspace();
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const displayedNotifications = filterUnreadOnly
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <CheckSquare className="w-3.5 h-3.5 text-[#34D399]" />;
      case 'doc_request':
        return <FileText className="w-3.5 h-3.5 text-[#22D3EE]" />;
      case 'suggestion_update':
        return <Lightbulb className="w-3.5 h-3.5 text-[#FBBF24]" />;
      case 'invitation':
        return <Mail className="w-3.5 h-3.5 text-[#8B5CF6]" />;
      case 'announcement':
        return <Bell className="w-3.5 h-3.5 text-[#FB7185]" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#191311] border-l border-[#38302D] p-5 shadow-2xl flex flex-col justify-between z-10 h-full text-[#F4F8FF]">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#38302D]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="font-semibold text-sm text-[#F4F8FF]">Notifications</h2>
              <span className="text-[10px] font-mono rounded bg-[#211B19] px-2 py-0.5 text-[#8B5CF6] border border-[#38302D]">
                {unreadCount} Unread
              </span>
            </div>

            <button
              onClick={onClose}
              className="rounded p-1 text-[#B4B0B0] hover:text-[#F4F8FF] hover:bg-[#211B19] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subheader action bar */}
          <div className="flex items-center justify-between py-2 text-xs border-b border-[#38302D]/60">
            <button
              onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
              className={`text-[11px] font-medium transition ${
                filterUnreadOnly ? 'text-[#8B5CF6]' : 'text-[#B4B0B0] hover:text-[#F4F8FF]'
              }`}
            >
              {filterUnreadOnly ? 'Showing unread only' : 'Show all'}
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-[11px] text-[#8B5CF6] hover:text-[#7C3AED] font-semibold flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="mt-3 space-y-2.5 overflow-y-auto max-h-[calc(100vh-9rem)] pr-1">
            {displayedNotifications.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#B4B0B0] space-y-1">
                <Bell className="w-6 h-6 mx-auto opacity-30 text-[#B4B0B0]" />
                <p>No {filterUnreadOnly ? 'unread ' : ''}notifications.</p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const dateStr = new Date(notif.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={notif.id}
                    className={`rounded-xl border p-3.5 text-xs transition ${
                      notif.isRead
                        ? 'border-[#38302D]/70 bg-[#0F0B0A] text-[#B4B0B0]'
                        : 'border-[#8B5CF6]/50 bg-[#211B19] text-[#F4F8FF] shadow-[0_0_12px_rgba(139,92,246,0.06)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-[#F4F8FF] flex items-center gap-2">
                        {getNotifIcon(notif.type)}
                        <span className="truncate">{notif.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#B4B0B0] shrink-0">{dateStr}</span>
                    </div>

                    <p className="mt-1.5 text-[11px] text-[#B4B0B0] leading-relaxed">{notif.body}</p>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#38302D]/60">
                      {!notif.isRead ? (
                        <button
                          onClick={() => markNotificationRead(notif.id)}
                          className="text-[10px] text-[#B4B0B0] hover:text-[#F4F8FF]"
                        >
                          Mark read
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-[#38302D]">Read</span>
                      )}

                      {notif.link && (
                        <button
                          onClick={() => {
                            if (notif.link?.includes('tasks')) onNavigateTo('tasks');
                            else if (notif.link?.includes('suggestions')) onNavigateTo('suggestions');
                            else if (notif.link?.includes('projects')) onNavigateTo('projects');
                            onClose();
                          }}
                          className="ml-auto text-[10px] text-[#8B5CF6] hover:text-[#7C3AED] flex items-center gap-1 font-semibold"
                        >
                          View <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-[#38302D] pt-2.5 text-[10px] text-[#B4B0B0] text-center font-mono">
          Recipient-Level Row Security (RLS) Enforced
        </div>
      </div>
    </div>
  );
};
