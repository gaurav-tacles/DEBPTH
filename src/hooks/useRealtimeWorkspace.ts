import { useEffect, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { workspaceRepo } from '../services/workspaceRepository';
import { logger } from '../lib/logger';
import { displayLocalNotification } from '../lib/webPush';

interface RealtimeWorkspaceOptions {
  currentUserId: string;
  isAuthenticated: boolean;
  onRefresh: () => void;
}

/**
 * Subscribes to Supabase Realtime postgres_changes channels for live multi-user sync.
 * Automatically synchronizes changes to announcements, suggestions, tasks, projects,
 * milestones, documents, and user notifications without requiring manual page reloads.
 */
export function useRealtimeWorkspace({
  currentUserId,
  isAuthenticated,
  onRefresh,
}: RealtimeWorkspaceOptions) {
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    let isDisposed = false;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let retryAttempt = 0;

    // Debounced sync function to avoid thrashing on batch operations
    const scheduleSync = () => {
      if (isDisposed) return;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(async () => {
        if (isDisposed) return;
        try {
          await workspaceRepo.syncWithSupabase(currentUserId);
          onRefreshRef.current();
        } catch (err) {
          logger.warn('Realtime', 'Failed to background sync workspace after realtime event', err);
        }
      }, 300);
    };

    const subscribeChannel = () => {
      if (isDisposed) return;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }

      const channelName = `workspace_realtime_${currentUserId}_${Date.now()}`;
      logger.info('Realtime', `Subscribing to realtime channel ${channelName}`);

      activeChannel = supabase
        .channel(channelName)
        // Announcements broadcast
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'announcements' },
          (payload) => {
            logger.info('Realtime', 'Announcement event received', payload.eventType);
            if (payload.eventType === 'INSERT' && payload.new) {
              const newAnc = payload.new as { id?: string; title?: string; content?: string; created_by?: string };
              if (newAnc.created_by !== currentUserId) {
                displayLocalNotification(`Announcement: ${newAnc.title || 'New Announcement'}`, {
                  body: newAnc.content || 'A new workspace announcement was published.',
                  tag: `debpth-announcement-${newAnc.id || Date.now()}`,
                });
              }
            }
            scheduleSync();
          }
        )
        // Suggestions updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'suggestions' },
          (payload) => {
            logger.info('Realtime', 'Suggestion event received', payload.eventType);
            if (payload.eventType === 'INSERT' && payload.new) {
              const newSug = payload.new as { id?: string; title?: string; submitter_id?: string };
              if (newSug.submitter_id !== currentUserId) {
                displayLocalNotification('New Workspace Suggestion', {
                  body: newSug.title || 'A team member shared a new suggestion.',
                  tag: `debpth-suggestion-${newSug.id || Date.now()}`,
                });
              }
            }
            scheduleSync();
          }
        )
        // Profiles updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          (payload) => {
            logger.info('Realtime', 'Profile event received', payload.eventType);
            scheduleSync();
          }
        )
        // Workspace membership updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'workspace_members' },
          (payload) => {
            logger.info('Realtime', 'Workspace membership event received', payload.eventType);
            scheduleSync();
          }
        )
        // Invitations updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invitations' },
          (payload) => {
            logger.info('Realtime', 'Invitation event received', payload.eventType);
            scheduleSync();
          }
        )
        // Tasks updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload) => {
            logger.info('Realtime', 'Task event received', payload.eventType);
            scheduleSync();
          }
        )
        // Projects updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          (payload) => {
            logger.info('Realtime', 'Project event received', payload.eventType);
            scheduleSync();
          }
        )
        // Project members updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'project_members' },
          (payload) => {
            logger.info('Realtime', 'Project membership event received', payload.eventType);
            scheduleSync();
          }
        )
        // Milestones updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'milestones' },
          (payload) => {
            logger.info('Realtime', 'Milestone event received', payload.eventType);
            scheduleSync();
          }
        )
        // Documents updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents' },
          (payload) => {
            logger.info('Realtime', 'Document event received', payload.eventType);
            scheduleSync();
          }
        )
        // Document access grants
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'document_access_grants' },
          (payload) => {
            logger.info('Realtime', 'Document access grant event received', payload.eventType);
            scheduleSync();
          }
        )
        // Personal ideas isolated to current user
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ideas',
            filter: `user_id=eq.${currentUserId}`,
          },
          (payload) => {
            logger.info('Realtime', 'Personal idea event received', payload.eventType);
            scheduleSync();
          }
        )
        // Direct user notifications
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${currentUserId}`,
          },
          (payload) => {
            logger.info('Realtime', 'Notification event received for user', payload.eventType);
            if (payload.eventType === 'INSERT' && payload.new) {
              const notif = payload.new as { id?: string; type?: string; title?: string; body?: string };
              displayLocalNotification(notif.title || 'New Notification', {
                body: notif.body || 'You have an update in DEBPTH.',
                tag: `debpth-${notif.type || 'notification'}-${notif.id || Date.now()}`,
              });
            }
            scheduleSync();
          }
        )
        .subscribe((status) => {
          logger.info('Realtime', `Channel ${channelName} status: ${status}`);
          if (status === 'SUBSCRIBED') {
            retryAttempt = 0;
          } else if (
            !isDisposed &&
            (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
          ) {
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
            }
            const delayMs = Math.min(30000, 1500 * Math.pow(2, retryAttempt));
            retryAttempt = Math.min(retryAttempt + 1, 5);
            reconnectTimerRef.current = setTimeout(() => {
              if (!isDisposed && (typeof navigator === 'undefined' || navigator.onLine)) {
                scheduleSync();
                subscribeChannel();
              }
            }, delayMs);
          }
        });
    };

    subscribeChannel();

    const handleOnline = () => {
      logger.info('Realtime', 'Network reconnected; syncing workspace & realtime channel');
      scheduleSync();
      subscribeChannel();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        scheduleSync();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isDisposed = true;
      logger.info('Realtime', 'Unsubscribing from realtime workspace channel');
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [currentUserId, isAuthenticated]);
}
