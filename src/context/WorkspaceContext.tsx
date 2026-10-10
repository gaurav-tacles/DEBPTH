import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserProfile,
  Project,
  ProjectMember,
  Task,
  Milestone,
  ProjectDocument,
  DocumentAccessGrant,
  Suggestion,
  Announcement,
  AppNotification,
  ActivityEvent,
  Invitation,
  ProjectRole,
  UserRole,
} from '../types';
import { workspaceRepo } from '../services/workspaceRepository';
import { logger } from '../lib/logger';

interface WorkspaceContextValue {
  currentUser: UserProfile | null;
  profiles: UserProfile[];
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  tasks: Task[];
  milestones: Milestone[];
  documents: ProjectDocument[];
  documentGrants: DocumentAccessGrant[];
  suggestions: Suggestion[];
  announcements: Announcement[];
  notifications: AppNotification[];
  invitations: Invitation[];
  activityLogs: ActivityEvent[];
  isSuperAdmin: boolean;
  canAccessActiveProject: boolean;

  // Actions
  setActiveProjectId: (id: string | null) => void;
  switchUser: (userId: string) => void;
  createProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => Project;
  addProjectMember: (projectId: string, userId: string, role: ProjectRole, permissions: ProjectMember['permissions']) => void;
  updateProjectMember: (memberId: string, role: ProjectRole, permissions: ProjectMember['permissions']) => void;
  removeProjectMember: (memberId: string) => void;
  createInvitation: (email: string, role: UserRole, initialLabels: string[], assignedProjectIds: string[], expiresInDays: number) => Invitation;
  redeemInvitation: (token: string, fullName: string) => UserProfile;
  createTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => Task;
  deleteTask: (id: string) => void;
  createMilestone: (data: Omit<Milestone, 'id' | 'createdAt'>) => Milestone;
  createDocument: (data: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>) => ProjectDocument;
  requestDocumentAccess: (documentId: string, reason: string) => void;
  reviewDocumentAccess: (grantId: string, status: 'approved' | 'rejected', grantedUntil?: string, notes?: string) => void;
  createSuggestion: (data: Omit<Suggestion, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Suggestion;
  updateSuggestionStatus: (id: string, status: Suggestion['status'], adminNotes?: string, adminResponse?: string) => void;
  convertSuggestionToTask: (suggestionId: string, projectId: string, priority: Task['priority'], assigneeId?: string) => Task;
  broadcastAnnouncement: (data: Omit<Announcement, 'id' | 'createdAt'>) => Announcement;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateProfileLabels: (userId: string, label: string, action: 'add' | 'remove') => void;
  resetWorkspaceData: () => void;
  refreshWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'devforge_active_user_id';

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>(() => workspaceRepo.getProfiles());
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (saved && workspaceRepo.getProfileById(saved)) return saved;
    // Default to Super Admin (Gaurav P.)
    const admin = workspaceRepo.getProfiles().find((p) => p.role === 'super_admin');
    return admin ? admin.id : workspaceRepo.getProfiles()[0]?.id || '';
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refreshWorkspace = useCallback(() => {
    setProfiles(workspaceRepo.getProfiles());
    setTick((t) => t + 1);
  }, []);

  const currentUser = useMemo(() => {
    return profiles.find((p) => p.id === currentUserId) || null;
  }, [profiles, currentUserId]);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Projects filtered by user permissions (SuperAdmin sees all; Member only sees assigned!)
  const projects = useMemo(() => {
    return workspaceRepo.getProjects(currentUserId);
  }, [currentUserId, tick]);

  // Sync active project: if none or inaccessible, pick first accessible
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    } else if (activeProjectId && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects.length > 0 ? projects[0].id : null);
    }
  }, [projects, activeProjectId]);

  const activeProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((p) => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const canAccessActiveProject = useMemo(() => {
    if (!activeProjectId) return false;
    if (isSuperAdmin) return true;
    return projects.some((p) => p.id === activeProjectId);
  }, [activeProjectId, isSuperAdmin, projects]);

  const tasks = useMemo(() => {
    if (activeProjectId) {
      return workspaceRepo.getTasks(activeProjectId);
    }
    // Return all tasks for projects the user has access to
    const accessibleProjIds = new Set(projects.map((p) => p.id));
    return workspaceRepo.getTasks().filter((t) => accessibleProjIds.has(t.projectId));
  }, [activeProjectId, projects, tick]);

  const milestones = useMemo(() => {
    if (!activeProjectId) return [];
    return workspaceRepo.getMilestones(activeProjectId);
  }, [activeProjectId, tick]);

  const documents = useMemo(() => {
    if (!activeProjectId) return [];
    return workspaceRepo.getDocuments(activeProjectId, currentUserId);
  }, [activeProjectId, currentUserId, tick]);

  const documentGrants = useMemo(() => {
    return workspaceRepo.getDocumentGrants();
  }, [tick]);

  const suggestions = useMemo(() => {
    return workspaceRepo.getSuggestions(currentUserId);
  }, [currentUserId, tick]);

  const announcements = useMemo(() => {
    return workspaceRepo.getAnnouncements();
  }, [tick]);

  const notifications = useMemo(() => {
    if (!currentUserId) return [];
    return workspaceRepo.getNotifications(currentUserId);
  }, [currentUserId, tick]);

  const invitations = useMemo(() => {
    return workspaceRepo.getInvitations();
  }, [tick]);

  const activityLogs = useMemo(() => {
    return workspaceRepo.getActivityLogs(activeProjectId || undefined);
  }, [activeProjectId, tick]);

  // Switch active persona
  const switchUser = useCallback((userId: string) => {
    const target = workspaceRepo.getProfileById(userId);
    if (target) {
      setCurrentUserId(userId);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
      logger.info('WorkspaceContext', `Switched active user to ${target.fullName} (${target.role})`);
      setTick((t) => t + 1);
    }
  }, []);

  // Project Actions
  const createProject = useCallback(
    (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>) => {
      const proj = workspaceRepo.createProject(data, currentUserId);
      refreshWorkspace();
      setActiveProjectId(proj.id);
      return proj;
    },
    [currentUserId, refreshWorkspace]
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<Project>) => {
      const proj = workspaceRepo.updateProject(id, updates, currentUserId);
      refreshWorkspace();
      return proj;
    },
    [currentUserId, refreshWorkspace]
  );

  const addProjectMember = useCallback(
    (projectId: string, userId: string, role: ProjectRole, permissions: ProjectMember['permissions']) => {
      workspaceRepo.addProjectMember(projectId, userId, role, permissions, currentUserId);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  const updateProjectMember = useCallback(
    (memberId: string, role: ProjectRole, permissions: ProjectMember['permissions']) => {
      workspaceRepo.updateProjectMember(memberId, role, permissions, currentUserId);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  const removeProjectMember = useCallback(
    (memberId: string) => {
      workspaceRepo.removeProjectMember(memberId, currentUserId);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  // Invitations
  const createInvitation = useCallback(
    (email: string, role: UserRole, initialLabels: string[], assignedProjectIds: string[], expiresInDays: number) => {
      const inv = workspaceRepo.createInvitation(email, role, initialLabels, assignedProjectIds, expiresInDays, currentUserId);
      refreshWorkspace();
      return inv;
    },
    [currentUserId, refreshWorkspace]
  );

  const redeemInvitation = useCallback(
    (token: string, fullName: string) => {
      const profile = workspaceRepo.redeemInvitation(token, fullName);
      refreshWorkspace();
      setCurrentUserId(profile.id);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, profile.id);
      return profile;
    },
    [refreshWorkspace]
  );

  // Tasks
  const createTask = useCallback(
    (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      const task = workspaceRepo.createTask(data, currentUserId);
      refreshWorkspace();
      return task;
    },
    [currentUserId, refreshWorkspace]
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      const task = workspaceRepo.updateTask(id, updates, currentUserId);
      refreshWorkspace();
      return task;
    },
    [currentUserId, refreshWorkspace]
  );

  const deleteTask = useCallback(
    (id: string) => {
      workspaceRepo.deleteTask(id);
      refreshWorkspace();
    },
    [refreshWorkspace]
  );

  const createMilestone = useCallback(
    (data: Omit<Milestone, 'id' | 'createdAt'>) => {
      const ms = workspaceRepo.createMilestone(data);
      refreshWorkspace();
      return ms;
    },
    [refreshWorkspace]
  );

  // Documents
  const createDocument = useCallback(
    (data: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>) => {
      const doc = workspaceRepo.createDocument(data);
      refreshWorkspace();
      return doc;
    },
    [refreshWorkspace]
  );

  const requestDocumentAccess = useCallback(
    (documentId: string, reason: string) => {
      workspaceRepo.requestDocumentAccess(documentId, currentUserId, reason);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  const reviewDocumentAccess = useCallback(
    (grantId: string, status: 'approved' | 'rejected', grantedUntil?: string, notes?: string) => {
      workspaceRepo.reviewDocumentAccess(grantId, status, currentUserId, grantedUntil, notes);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  // Suggestions
  const createSuggestion = useCallback(
    (data: Omit<Suggestion, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
      const sug = workspaceRepo.createSuggestion(data);
      refreshWorkspace();
      return sug;
    },
    [refreshWorkspace]
  );

  const updateSuggestionStatus = useCallback(
    (id: string, status: Suggestion['status'], adminNotes?: string, adminResponse?: string) => {
      workspaceRepo.updateSuggestionStatus(id, status, adminNotes, adminResponse, currentUserId);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  const convertSuggestionToTask = useCallback(
    (suggestionId: string, projectId: string, priority: Task['priority'], assigneeId?: string) => {
      const task = workspaceRepo.convertSuggestionToTask(suggestionId, projectId, priority, assigneeId, currentUserId);
      refreshWorkspace();
      return task;
    },
    [currentUserId, refreshWorkspace]
  );

  // Announcements & Notifications
  const broadcastAnnouncement = useCallback(
    (data: Omit<Announcement, 'id' | 'createdAt'>) => {
      const anc = workspaceRepo.broadcastAnnouncement(data);
      refreshWorkspace();
      return anc;
    },
    [refreshWorkspace]
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      workspaceRepo.markNotificationRead(id);
      refreshWorkspace();
    },
    [refreshWorkspace]
  );

  const markAllNotificationsRead = useCallback(() => {
    if (currentUserId) {
      workspaceRepo.markAllNotificationsRead(currentUserId);
      refreshWorkspace();
    }
  }, [currentUserId, refreshWorkspace]);

  const updateProfileLabels = useCallback(
    (userId: string, label: string, action: 'add' | 'remove') => {
      if (action === 'add') {
        workspaceRepo.addProfileLabel(userId, label);
      } else {
        workspaceRepo.removeProfileLabel(userId, label);
      }
      refreshWorkspace();
    },
    [refreshWorkspace]
  );

  const resetWorkspaceData = useCallback(() => {
    workspaceRepo.resetToDefaults();
    const admin = workspaceRepo.getProfiles().find((p) => p.role === 'super_admin');
    if (admin) {
      setCurrentUserId(admin.id);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, admin.id);
    }
    refreshWorkspace();
  }, [refreshWorkspace]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentUser,
        profiles,
        projects,
        activeProjectId,
        activeProject,
        tasks,
        milestones,
        documents,
        documentGrants,
        suggestions,
        announcements,
        notifications,
        invitations,
        activityLogs,
        isSuperAdmin,
        canAccessActiveProject,

        setActiveProjectId,
        switchUser,
        createProject,
        updateProject,
        addProjectMember,
        updateProjectMember,
        removeProjectMember,
        createInvitation,
        redeemInvitation,
        createTask,
        updateTask,
        deleteTask,
        createMilestone,
        createDocument,
        requestDocumentAccess,
        reviewDocumentAccess,
        createSuggestion,
        updateSuggestionStatus,
        convertSuggestionToTask,
        broadcastAnnouncement,
        markNotificationRead,
        markAllNotificationsRead,
        updateProfileLabels,
        resetWorkspaceData,
        refreshWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
