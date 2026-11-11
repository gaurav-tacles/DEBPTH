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
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Debounced sync function to avoid thrashing on batch operations
    const scheduleSync = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await workspaceRepo.syncWithSupabase(currentUserId);
          onRefresh();
        } catch (err) {
          logger.warn('Realtime', 'Failed to background sync workspace after realtime event', err);
        }
      }, 300);
    };

    const channelName = `workspace_realtime_${currentUserId}_${Date.now()}`;
    logger.info('Realtime', `Subscribing to realtime channel ${channelName}`);

    const channel = supabase
      .channel(channelName)
      // Announcements broadcast
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        (payload) => {
          logger.info('Realtime', 'Announcement event received', payload.eventType);
          if (payload.eventType === 'INSERT' && payload.new) {
            const newAnc = payload.new as { title?: string; content?: string; created_by?: string };
            if (newAnc.created_by !== currentUserId) {
              displayLocalNotification(`📢 Announcement: ${newAnc.title || 'New Announcement'}`, {
                body: newAnc.content || 'A new workspace announcement was published.',
                tag: 'announcement',
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
            const newSug = payload.new as { title?: string; submitter_id?: string };
            if (newSug.submitter_id !== currentUserId) {
              displayLocalNotification('💡 New Workspace Suggestion', {
                body: newSug.title || 'A team member shared a new suggestion.',
                tag: 'suggestion',
              });
            }
          }
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
            const notif = payload.new as { title?: string; body?: string };
            displayLocalNotification(notif.title || 'New Notification', {
              body: notif.body || 'You have an update in DEBPTH.',
              tag: 'notification',
            });
          }
          scheduleSync();
        }
      )
      .subscribe((status) => {
        logger.info('Realtime', `Channel ${channelName} status: ${status}`);
      });

    return () => {
      logger.info('Realtime', `Unsubscribing from realtime channel ${channelName}`);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [currentUserId, isAuthenticated, onRefresh]);
}
