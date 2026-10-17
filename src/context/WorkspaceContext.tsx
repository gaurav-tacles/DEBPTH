import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
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
  Idea,
} from '../types';
import { workspaceRepo } from '../services/workspaceRepository';
import { logger } from '../lib/logger';
import { getSupabaseClient } from '../lib/supabase';

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
  ideas: Idea[];
  isSuperAdmin: boolean;
  canAccessActiveProject: boolean;

  // Auth State
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  isPasswordRecovery: boolean;
  session: Session | null;

  // Auth Actions
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string, inviteToken?: string) => Promise<{ error: Error | null; emailConfirmationRequired?: boolean }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  clearPasswordRecovery: () => void;
  signInAsPersona: (userId: string) => void;
  signOut: () => Promise<void>;

  // Workspace Actions
  setActiveProjectId: (id: string | null) => void;
  switchUser: (userId: string) => void;
  createProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => Project;
  deleteProject: (projectId: string) => Promise<boolean>;
  addProjectMember: (projectId: string, userId: string, role: ProjectRole, permissions: ProjectMember['permissions']) => void;
  updateProjectMember: (memberId: string, role: ProjectRole, permissions: ProjectMember['permissions']) => void;
  removeProjectMember: (memberId: string) => void;
  createInvitation: (
    email: string,
    role: UserRole,
    initialLabels: string[],
    assignedProjectIds: string[],
    expiresInDays: number,
    invitedProjectRole?: ProjectRole
  ) => Invitation;
  createProjectInvitation: (
    projectId: string,
    email: string,
    projectRole: ProjectRole,
    permissions?: ProjectMember['permissions'],
    expiresInDays?: number
  ) => Invitation;
  revokeInvitation: (invitationId: string) => void;
  redeemInvitation: (token: string, fullName: string, expectedEmail?: string) => UserProfile;
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
  updateCurrentUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  createIdea: (data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>) => Idea;
  updateIdea: (id: string, updates: Partial<Idea>) => Idea;
  deleteIdea: (id: string) => void;
  resetWorkspaceData: () => void;
  refreshWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'projecthub_active_user_id';
const AUTH_TOKEN_KEY = 'projecthub_auth_active';

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>(() => workspaceRepo.getProfiles());
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refreshWorkspace = useCallback(() => {
    setProfiles(workspaceRepo.getProfiles());
    setTick((t) => t + 1);
  }, []);

  // Initialize and verify authentication on app startup
  useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      try {
        const supabase = getSupabaseClient();

        if (supabase) {
          // Check live Supabase session
          const { data, error } = await supabase.auth.getSession();
          if (data?.session && !error) {
            const user = data.session.user;
            logger.info('Auth', 'Active Supabase session detected', { email: user.email });

            const profile = await workspaceRepo.ensureAuthenticatedProfile(
              user.id,
              user.email || '',
              user.user_metadata?.full_name,
              user.user_metadata?.avatar_url
            );

            if (isMounted) {
              setSession(data.session);
              setCurrentUserId(profile.id);
              setIsAuthenticated(true);
              setProfiles(workspaceRepo.getProfiles());
              setIsCheckingAuth(false);
            }
            return;
          }
        }

        // If Supabase is configured, session must come from Supabase Auth
        if (supabase) {
          if (isMounted) {
            setCurrentUserId('');
            setIsAuthenticated(false);
            setIsCheckingAuth(false);
            logger.info('Auth', 'No verified Supabase Auth session found - prompt login');
          }
          return;
        }

        // Strictly unauthenticated when no live Supabase session
        if (isMounted) {
          setCurrentUserId('');
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
          logger.info('Auth', 'No active session found - prompt login');
        }
      } catch (err) {
        logger.error('Auth', 'Error checking auth session', err);
        if (isMounted) {
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
      }
    }

    checkAuthSession();

    // Listen to Supabase Auth State changes if client available
    const supabase = getSupabaseClient();
    let authListenerSub: { unsubscribe: () => void } | null = null;

    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        logger.info('Auth', `Supabase auth event: ${event}`);
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && newSession?.user) {
          const user = newSession.user;
          const profile = await workspaceRepo.ensureAuthenticatedProfile(
            user.id,
            user.email || '',
            user.user_metadata?.full_name,
            user.user_metadata?.avatar_url
          );
          setSession(newSession);
          setCurrentUserId(profile.id);
          setIsAuthenticated(true);
          setProfiles(workspaceRepo.getProfiles());
          localStorage.setItem(AUTH_TOKEN_KEY, 'true');
          localStorage.setItem(CURRENT_USER_STORAGE_KEY, profile.id);
          refreshWorkspace();
        } else if (event === 'PASSWORD_RECOVERY') {
          logger.info('Auth', 'Password recovery event detected');
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setCurrentUserId('');
          setIsAuthenticated(false);
          setIsPasswordRecovery(false);
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        }
      });
      authListenerSub = authListener.subscription;
    }

    return () => {
      isMounted = false;
      if (authListenerSub) {
        authListenerSub.unsubscribe();
      }
    };
  }, [refreshWorkspace]);

  // Auth Operations
  // Password recovery and update operations
  const resetPassword = useCallback(async (email: string): Promise<{ error: Error | null }> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        error: new Error(
          'Supabase credentials are not configured. Please enter your Supabase URL and Anon Key in .env or via the Database & Auth Config panel.'
        ),
      };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ error: Error | null }> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        error: new Error('Supabase authentication is not configured. Please check your credentials.'),
      };
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) return { error: new Error(error.message) };
      setIsPasswordRecovery(false);
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    if (window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<{ error: Error | null }> => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          let errorMsg = error.message;
          const lower = errorMsg.toLowerCase();
          if (lower.includes('invalid login credentials')) {
            errorMsg = 'Invalid email or password. Please verify your credentials or use the password reset link below.';
          } else if (lower.includes('email not confirmed')) {
            errorMsg = 'Email address not confirmed. Please check your inbox for the verification email, or disable email verification in Supabase Dashboard (Authentication > Providers > Email).';
          }
          return { error: new Error(errorMsg) };
        }

        if (data.user) {
          const profile = await workspaceRepo.ensureAuthenticatedProfile(
            data.user.id,
            data.user.email || email,
            data.user.user_metadata?.full_name
          );
          setSession(data.session);
          setCurrentUserId(profile.id);
          setIsAuthenticated(true);

          // If user metadata had an invite_token that wasn't redeemed yet (e.g. after email confirmation)
          const pendingInviteToken = data.user.user_metadata?.invite_token;
          if (pendingInviteToken) {
            try {
              await supabase.rpc('redeem_invitation_atomic', {
                p_token_hash: pendingInviteToken.trim(),
                p_user_full_name: profile.fullName,
              });
            } catch (e) {
              // Expected if already redeemed
            }
          }

          const currentProfiles = workspaceRepo.getProfiles();
          setProfiles(currentProfiles);
          localStorage.setItem(AUTH_TOKEN_KEY, 'true');
          localStorage.setItem(CURRENT_USER_STORAGE_KEY, profile.id);
          refreshWorkspace();
          // Trigger asynchronous workspace data sync with Supabase
          workspaceRepo.syncWithSupabase(profile.id).catch((e) => {
            logger.warn('Auth', 'Background Supabase sync notice', e);
          });
          return { error: null };
        }
      } catch (err: unknown) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    }

    return {
      error: new Error(
        'Supabase authentication is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file or use Database & Auth Config above.'
      ),
    };
  }, [refreshWorkspace]);

  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      inviteToken?: string
    ): Promise<{ error: Error | null; emailConfirmationRequired?: boolean }> => {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: fullName,
                invite_token: inviteToken,
              },
            },
          });
          if (error) return { error: new Error(error.message) };
          if (data.user) {
            const profile = await workspaceRepo.ensureAuthenticatedProfile(
              data.user.id,
              data.user.email || email,
              fullName
            );
            if (data.session) {
              setSession(data.session);
              setCurrentUserId(profile.id);
              setIsAuthenticated(true);

              // Atomically redeem invitation in Supabase
              if (inviteToken) {
                try {
                  await supabase.rpc('redeem_invitation_atomic', {
                    p_token_hash: inviteToken.trim(),
                    p_user_full_name: fullName.trim(),
                  });
                } catch (rpcErr) {
                  logger.warn('WorkspaceContext', 'Could not redeem invitation via RPC on signUp', rpcErr);
                }
                try {
                  workspaceRepo.redeemInvitation(inviteToken, fullName, email);
                } catch (localErr) {
                  // already redeemed or only in remote
                }
              }

              const currentProfiles = workspaceRepo.getProfiles();
              setProfiles(currentProfiles);
              localStorage.setItem(AUTH_TOKEN_KEY, 'true');
              localStorage.setItem(CURRENT_USER_STORAGE_KEY, profile.id);
              refreshWorkspace();
              return { error: null, emailConfirmationRequired: false };
            } else {
              return { error: null, emailConfirmationRequired: true };
            }
          }
        } catch (err: unknown) {
          return { error: err instanceof Error ? err : new Error(String(err)) };
        }
      }

      return {
        error: new Error(
          'Supabase authentication is required for registration. Please configure your Supabase URL and Anon Key.'
        ),
      };
    },
    [refreshWorkspace]
  );

  const signInAsPersona = useCallback((userId: string) => {
    const target = workspaceRepo.getProfileById(userId);
    if (target) {
      setCurrentUserId(userId);
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_TOKEN_KEY, 'true');
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
      logger.info('Auth', `Signed in as persona ${target.fullName} (${target.role})`);
      setTick((t) => t + 1);
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        logger.warn('Auth', 'Error during Supabase signOut', err);
      }
    }
    setSession(null);
    setCurrentUserId('');
    setIsAuthenticated(false);
    setIsPasswordRecovery(false);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    logger.info('Auth', 'User successfully signed out');
  }, []);

  const currentUser = useMemo(() => {
    if (!isAuthenticated || !currentUserId) return null;
    const found = profiles.find((p) => p.id === currentUserId);
    if (found) return found;
    // Guaranteed fallback: read directly from repository store if React state has not flushed yet
    return workspaceRepo.getProfileById(currentUserId) || null;
  }, [profiles, currentUserId, isAuthenticated]);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Projects filtered by user permissions (SuperAdmin sees all; Member only sees assigned!)
  const projects = useMemo(() => {
    if (!currentUserId || !isAuthenticated) return [];
    return workspaceRepo.getProjects(currentUserId);
  }, [currentUserId, isAuthenticated, tick]);

  // Sync active project: if none or inaccessible, pick first accessible
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveProjectId(null);
      return;
    }
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    } else if (activeProjectId && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects.length > 0 ? projects[0].id : null);
    }
  }, [projects, activeProjectId, isAuthenticated]);

  const activeProject = useMemo(() => {
    if (!activeProjectId || !isAuthenticated) return null;
    return projects.find((p) => p.id === activeProjectId) || null;
  }, [projects, activeProjectId, isAuthenticated]);

  const canAccessActiveProject = useMemo(() => {
    if (!activeProjectId || !isAuthenticated) return false;
    if (isSuperAdmin) return true;
    return projects.some((p) => p.id === activeProjectId);
  }, [activeProjectId, isSuperAdmin, projects, isAuthenticated]);

  const tasks = useMemo(() => {
    if (!isAuthenticated) return [];
    if (activeProjectId) {
      return workspaceRepo.getTasks(activeProjectId);
    }
    const accessibleProjIds = new Set(projects.map((p) => p.id));
    return workspaceRepo.getTasks().filter((t) => accessibleProjIds.has(t.projectId));
  }, [activeProjectId, projects, isAuthenticated, tick]);

  const milestones = useMemo(() => {
    if (!isAuthenticated || !activeProjectId) return [];
    return workspaceRepo.getMilestones(activeProjectId);
  }, [activeProjectId, isAuthenticated, tick]);

  const documents = useMemo(() => {
    if (!isAuthenticated || !activeProjectId || !currentUserId) return [];
    return workspaceRepo.getDocuments(activeProjectId, currentUserId);
  }, [activeProjectId, currentUserId, isAuthenticated, tick]);

  const documentGrants = useMemo(() => {
    if (!isAuthenticated) return [];
    return workspaceRepo.getDocumentGrants();
  }, [isAuthenticated, tick]);

  const suggestions = useMemo(() => {
    if (!isAuthenticated || !currentUserId) return [];
    return workspaceRepo.getSuggestions(currentUserId);
  }, [currentUserId, isAuthenticated, tick]);

  const announcements = useMemo(() => {
    if (!isAuthenticated) return [];
    return workspaceRepo.getAnnouncements();
  }, [isAuthenticated, tick]);

  const notifications = useMemo(() => {
    if (!isAuthenticated || !currentUserId) return [];
    return workspaceRepo.getNotifications(currentUserId);
  }, [currentUserId, isAuthenticated, tick]);

  const invitations = useMemo(() => {
    if (!isAuthenticated) return [];
    return workspaceRepo.getInvitations();
  }, [isAuthenticated, tick]);

  const activityLogs = useMemo(() => {
    if (!isAuthenticated) return [];
    return workspaceRepo.getActivityLogs(activeProjectId || undefined);
  }, [activeProjectId, isAuthenticated, tick]);

  const ideas = useMemo(() => {
    if (!isAuthenticated || !currentUserId) return [];
    return workspaceRepo.getIdeas(currentUserId);
  }, [currentUserId, isAuthenticated, tick]);

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

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!currentUser?.email) {
        throw new Error('Authenticated session required to delete project.');
      }
      const success = workspaceRepo.deleteProjectSecure(projectId, currentUser.email);
      if (success) {
        refreshWorkspace();
        if (activeProjectId === projectId) {
          setActiveProjectId(null);
        }
      }
      return success;
    },
    [currentUser?.email, refreshWorkspace, activeProjectId]
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
    (
      email: string,
      role: UserRole,
      initialLabels: string[],
      assignedProjectIds: string[],
      expiresInDays: number,
      invitedProjectRole?: ProjectRole
    ) => {
      const inv = workspaceRepo.createInvitation(
        email,
        role,
        initialLabels,
        assignedProjectIds,
        expiresInDays,
        currentUserId,
        invitedProjectRole
      );
      refreshWorkspace();
      return inv;
    },
    [currentUserId, refreshWorkspace]
  );

  const createProjectInvitation = useCallback(
    (
      projectId: string,
      email: string,
      projectRole: ProjectRole = 'collaborator',
      _permissions?: ProjectMember['permissions'],
      expiresInDays: number = 7
    ) => {
      const inv = workspaceRepo.createInvitation(
        email,
        'member',
        [],
        [projectId],
        expiresInDays,
        currentUserId,
        projectRole
      );
      refreshWorkspace();
      return inv;
    },
    [currentUserId, refreshWorkspace]
  );

  const revokeInvitation = useCallback(
    (invitationId: string) => {
      workspaceRepo.revokeInvitation(invitationId, currentUserId);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  const redeemInvitation = useCallback(
    (token: string, fullName: string, expectedEmail?: string) => {
      const profile = workspaceRepo.redeemInvitation(token, fullName, expectedEmail);
      refreshWorkspace();
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

  // Milestones
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
      const task = workspaceRepo.convertSuggestionToTask(
        suggestionId,
        projectId,
        priority,
        assigneeId,
        currentUserId
      );
      refreshWorkspace();
      return task;
    },
    [currentUserId, refreshWorkspace]
  );

  // Announcements
  const broadcastAnnouncement = useCallback(
    (data: Omit<Announcement, 'id' | 'createdAt'>) => {
      const ann = workspaceRepo.broadcastAnnouncement(data);
      refreshWorkspace();
      return ann;
    },
    [refreshWorkspace]
  );

  // Notifications
  const markNotificationRead = useCallback((id: string) => {
    workspaceRepo.markNotificationRead(id);
    setTick((t) => t + 1);
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    if (currentUserId) {
      workspaceRepo.markAllNotificationsRead(currentUserId);
      setTick((t) => t + 1);
    }
  }, [currentUserId]);

  // Labels
  const updateProfileLabels = useCallback(
    (userId: string, label: string, action: 'add' | 'remove') => {
      workspaceRepo.updateProfileLabels(userId, label, action, currentUserId);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  const updateCurrentUserProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!currentUserId) return;
      workspaceRepo.updateProfile(currentUserId, updates);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  // Personal Ideas Actions
  const createIdea = useCallback(
    (data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>) => {
      const idea = workspaceRepo.createIdea(data, currentUserId);
      refreshWorkspace();
      return idea;
    },
    [currentUserId, refreshWorkspace]
  );

  const updateIdea = useCallback(
    (id: string, updates: Partial<Idea>) => {
      const updated = workspaceRepo.updateIdea(id, updates, currentUserId);
      refreshWorkspace();
      return updated;
    },
    [currentUserId, refreshWorkspace]
  );

  const deleteIdea = useCallback(
    (id: string) => {
      workspaceRepo.deleteIdea(id, currentUserId);
      refreshWorkspace();
    },
    [currentUserId, refreshWorkspace]
  );

  // Reset Data
  const resetWorkspaceData = useCallback(() => {
    workspaceRepo.resetToSampleData();
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
        ideas,
        isSuperAdmin,
        canAccessActiveProject,

        isAuthenticated,
        isCheckingAuth,
        isPasswordRecovery,
        session,

        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        updatePassword,
        clearPasswordRecovery,
        signInAsPersona,
        signOut,

        setActiveProjectId,
        switchUser,
        createProject,
        updateProject,
        deleteProject,
        addProjectMember,
        updateProjectMember,
        removeProjectMember,
        createInvitation,
        createProjectInvitation,
        revokeInvitation,
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
        updateCurrentUserProfile,
        createIdea,
        updateIdea,
        deleteIdea,
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
