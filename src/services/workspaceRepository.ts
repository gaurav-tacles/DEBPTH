import {
  UserProfile,
  Project,
  ProjectMember,
  WorkspaceMember,
  Invitation,
  Task,
  Milestone,
  ProjectDocument,
  DocumentAccessGrant,
  Suggestion,
  Announcement,
  AppNotification,
  ActivityEvent,
  ProjectRole,
  UserRole,
  Idea,
} from '../types';
import { logger } from '../lib/logger';
import { getSupabaseClient } from '../lib/supabase';
import { generateSecureToken, hashTokenSync, generateUuid, isValidUuid } from '../lib/crypto';

const STORAGE_KEY_DATA = 'projecthub_workspace_v3';

interface WorkspaceDatabase {
  profiles: UserProfile[];
  workspaceMembers: WorkspaceMember[];
  projects: Project[];
  projectMembers: ProjectMember[];
  invitations: Invitation[];
  tasks: Task[];
  milestones: Milestone[];
  documents: ProjectDocument[];
  documentGrants: DocumentAccessGrant[];
  suggestions: Suggestion[];
  announcements: Announcement[];
  notifications: AppNotification[];
  activityLogs: ActivityEvent[];
  ideas: Idea[];
}

function getInitialDatabase(): WorkspaceDatabase {
  // Production-clean: No fictional members, fake projects, or mock telemetry
  return {
    profiles: [],
    workspaceMembers: [],
    projects: [],
    projectMembers: [],
    invitations: [],
    tasks: [],
    milestones: [],
    documents: [],
    documentGrants: [],
    suggestions: [],
    announcements: [],
    notifications: [],
    activityLogs: [],
    ideas: [],
  };
}

class WorkspaceRepository {
  private db: WorkspaceDatabase;

  constructor() {
    this.db = this.loadDatabase();
  }

  private loadDatabase(): WorkspaceDatabase {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_DATA);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && Array.isArray(parsed.profiles) && Array.isArray(parsed.projects)) {
            if (!Array.isArray(parsed.ideas)) parsed.ideas = [];
            if (!Array.isArray(parsed.workspaceMembers)) parsed.workspaceMembers = [];
            // Security: Sanitize existing stored invitations to eliminate legacy plaintext tokens
            let hadLegacyTokens = false;
            if (Array.isArray(parsed.invitations)) {
              parsed.invitations = parsed.invitations.map((inv: any) => {
                if (inv && typeof inv === 'object' && 'token' in inv) {
                  hadLegacyTokens = true;
                  const { token: _rawToken, ...safeInv } = inv;
                  return safeInv;
                }
                return inv;
              });
            }
            // If plaintext tokens were discovered, immediately persist the sanitized version to storage
            if (hadLegacyTokens) {
              try {
                localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(parsed));
                logger.info('WorkspaceRepository', 'Sanitized legacy plaintext tokens from localStorage');
              } catch (writeErr) {
                logger.warn('WorkspaceRepository', 'Could not immediately rewrite sanitized cache to localStorage', writeErr);
              }
            }
            return parsed;
          }
        }
      }
    } catch (e) {
      logger.warn('WorkspaceRepository', 'Failed to parse stored workspace, resetting to clean state', e);
    }
    const initial = getInitialDatabase();
    this.saveDatabase(initial);
    return initial;
  }

  private saveDatabase(data: WorkspaceDatabase) {
    try {
      // Security: Ensure raw plaintext invitation tokens are NEVER persisted to localStorage or persistent repository state
      const sanitizedData: WorkspaceDatabase = {
        ...data,
        workspaceMembers: data.workspaceMembers || [],
        invitations: (data.invitations || []).map((inv) => {
          if (inv && typeof inv === 'object' && 'token' in inv) {
            const { token: _rawToken, ...safeInv } = inv;
            return safeInv;
          }
          return inv;
        }),
      };

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(sanitizedData));
      }
      this.db = sanitizedData;
    } catch (e) {
      logger.error('WorkspaceRepository', 'Failed to save database to storage', e);
    }
  }

  // Clear workspace cache on sign out
  clearCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_DATA);
      }
    } catch (e) {
      logger.warn('WorkspaceRepository', 'Failed to clear local workspace storage', e);
    }
    this.db = getInitialDatabase();
  }

  // Helper for test fixture hydration
  saveDatabaseStateForTesting(partial: Partial<WorkspaceDatabase>): void {
    this.saveDatabase({
      ...this.db,
      ...partial,
    });
  }

  // Workspace Members
  isWorkspaceMember(userId?: string): boolean {
    if (!userId) return false;
    const user = this.getProfileById(userId);
    if (user?.role === 'super_admin' || user?.email.toLowerCase() === 'realgauravpatel@gmail.com') {
      return true;
    }
    return (this.db.workspaceMembers || []).some((wm) => wm.userId === userId);
  }

  getWorkspaceMembers(): WorkspaceMember[] {
    return (this.db.workspaceMembers || []).map((wm) => ({
      ...wm,
      user: this.getProfileById(wm.userId),
    }));
  }

  addWorkspaceMember(
    userId: string,
    role: 'super_admin' | 'member' = 'member',
    invitedBy?: string
  ): void {
    if ((this.db.workspaceMembers || []).some((wm) => wm.userId === userId)) {
      return;
    }
    const newMember: WorkspaceMember = {
      userId,
      role,
      joinedAt: new Date().toISOString(),
      invitedBy,
    };
    this.saveDatabase({
      ...this.db,
      workspaceMembers: [...(this.db.workspaceMembers || []), newMember],
    });
  }

  // Ensure authenticated user profile exists
  async ensureAuthenticatedProfile(
    userId: string,
    email: string,
    fullName?: string,
    avatarUrl?: string
  ): Promise<UserProfile> {
    const supabase = getSupabaseClient();
    const normalizedEmail = email.trim().toLowerCase();
    const isSuperAdminEmail = normalizedEmail === 'realgauravpatel@gmail.com';

    // 1. Check if Supabase has this profile
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (data && !error) {
          const profile: UserProfile = {
            id: data.id,
            email: data.email,
            fullName: data.full_name,
            avatarUrl: data.avatar_url || avatarUrl,
            role: data.role || (isSuperAdminEmail ? 'super_admin' : 'member'),
            labels: data.labels || (isSuperAdminEmail ? ['Architecture', 'Security', 'Owner'] : ['Developer']),
            githubUsername: data.github_username,
            mfaEnabled: Boolean(data.mfa_enabled),
            createdAt: data.created_at || new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          };

          // Update local cache
          const existingLocal = this.db.profiles.find((p) => p.id === userId);
          if (existingLocal) {
            const updated = this.db.profiles.map((p) => (p.id === userId ? profile : p));
            this.saveDatabase({ ...this.db, profiles: updated });
          } else {
            this.saveDatabase({ ...this.db, profiles: [...this.db.profiles, profile] });
          }
          return profile;
        }
      } catch (err) {
        logger.warn('WorkspaceRepository', 'Could not fetch profile from Supabase, using local store', err);
      }
    }

    // 2. Check local store
    const existing = this.db.profiles.find((p) => p.id === userId || p.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      const updatedProfile: UserProfile = {
        ...existing,
        id: userId,
        fullName: fullName || existing.fullName,
        avatarUrl: avatarUrl || existing.avatarUrl,
        lastActiveAt: new Date().toISOString(),
      };
      const updated = this.db.profiles.map((p) => (p.id === existing.id ? updatedProfile : p));
      this.saveDatabase({ ...this.db, profiles: updated });
      return updatedProfile;
    }

    // 3. Create fresh new profile for authenticated user
    const newProfile: UserProfile = {
      id: userId,
      email: email.toLowerCase(),
      fullName: fullName || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      avatarUrl: avatarUrl || undefined,
      role: isSuperAdminEmail ? 'super_admin' : 'member',
      labels: isSuperAdminEmail ? ['Architecture', 'Security', 'Owner'] : ['Developer'],
      githubUsername: email.split('@')[0],
      mfaEnabled: true,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    // Save to local
    const updatedMembers =
      isSuperAdminEmail && !(this.db.workspaceMembers || []).some((wm) => wm.userId === userId)
        ? [...(this.db.workspaceMembers || []), { userId, role: 'super_admin' as const, joinedAt: new Date().toISOString() }]
        : this.db.workspaceMembers;

    this.saveDatabase({
      ...this.db,
      profiles: [...this.db.profiles, newProfile],
      workspaceMembers: updatedMembers,
    });

    // Save to Supabase if connected
    if (supabase) {
      try {
        await supabase.from('profiles').upsert({
          id: newProfile.id,
          email: newProfile.email,
          full_name: newProfile.fullName,
          avatar_url: newProfile.avatarUrl,
          role: newProfile.role,
          labels: newProfile.labels,
          github_username: newProfile.githubUsername,
          mfa_enabled: newProfile.mfaEnabled,
        });
      } catch (e) {
        logger.warn('WorkspaceRepository', 'Could not upsert profile to Supabase', e);
      }
    }

    logger.info('WorkspaceRepository', `Initialized authenticated profile: ${newProfile.email} (${newProfile.role})`);
    return newProfile;
  }

  // Sync data with Supabase if connected
  async syncWithSupabase(currentUserId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      logger.info('WorkspaceRepository', 'Syncing workspace data with Supabase...');

      // 1. Sync profiles
      const { data: remoteProfiles, error: profErr } = await supabase.from('profiles').select('*');
      let mappedProfiles: UserProfile[] = this.db.profiles;
      if (!profErr && remoteProfiles !== null) {
        mappedProfiles = remoteProfiles.map((p) => ({
          id: p.id,
          email: p.email,
          fullName: p.full_name,
          avatarUrl: p.avatar_url,
          role: p.role,
          labels: p.labels || [],
          githubUsername: p.github_username,
          mfaEnabled: Boolean(p.mfa_enabled),
          createdAt: p.created_at,
          lastActiveAt: p.last_active_at,
        }));
      } else if (profErr) {
        logger.error('WorkspaceRepository', 'Error fetching profiles from Supabase', profErr);
      }

      // 2. Sync projects
      const { data: remoteProjects, error: projErr } = await supabase.from('projects').select('*');
      let mappedProjects: Project[] = this.db.projects;
      if (!projErr && remoteProjects !== null) {
        mappedProjects = remoteProjects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          summary: p.summary,
          problemStatement: p.problem_statement,
          description: p.description,
          goals: p.goals || [],
          features: p.features || [],
          status: p.status,
          priority: p.priority,
          techStack: p.tech_stack || [],
          repositories: p.repositories || [],
          links: p.links || [],
          startDate: p.start_date,
          targetDate: p.target_date,
          ownerId: p.owner_id,
          archived: Boolean(p.archived),
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));
      } else if (projErr) {
        logger.error('WorkspaceRepository', 'Error fetching projects from Supabase', projErr);
      }

      // 3. Sync project members
      const { data: remoteMembers, error: memErr } = await supabase.from('project_members').select('*');
      let mappedMembers: ProjectMember[] = this.db.projectMembers;
      if (!memErr && remoteMembers !== null) {
        mappedMembers = remoteMembers.map((pm) => ({
          id: pm.id,
          projectId: pm.project_id,
          userId: pm.user_id,
          role: pm.role,
          permissions: {
            canManageTasks: Boolean(pm.can_manage_tasks),
            canUploadDocs: Boolean(pm.can_upload_docs),
            canViewMetrics: Boolean(pm.can_view_metrics),
            canManageMembers: Boolean(pm.can_manage_members),
          },
          joinedAt: pm.joined_at,
        }));
      } else if (memErr) {
        logger.error('WorkspaceRepository', 'Error fetching project members from Supabase', memErr);
      }

      // 4. Sync announcements (visible to all authenticated workspace members)
      const { data: remoteAnnouncements, error: ancErr } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      let mappedAnnouncements: Announcement[] = this.db.announcements;
      if (!ancErr && remoteAnnouncements !== null) {
        mappedAnnouncements = remoteAnnouncements.map((a) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          priority: a.priority,
          targetType: a.target_type,
          targetMeta: a.target_meta || {},
          createdBy: a.created_by,
          createdAt: a.created_at,
        }));
      } else if (ancErr) {
        logger.error('WorkspaceRepository', 'Error fetching announcements from Supabase', ancErr);
      }

      // 5. Sync tasks
      const { data: remoteTasks, error: taskErr } = await supabase.from('tasks').select('*');
      let mappedTasks: Task[] = this.db.tasks;
      if (!taskErr && remoteTasks !== null) {
        mappedTasks = remoteTasks.map((t) => ({
          id: t.id,
          projectId: t.project_id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assigneeId: t.assignee_id,
          dueDate: t.due_date,
          milestoneId: t.milestone_id,
          tags: t.tags || [],
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        }));
      } else if (taskErr) {
        logger.error('WorkspaceRepository', 'Error fetching tasks from Supabase', taskErr);
      }

      // 6. Sync milestones
      const { data: remoteMilestones, error: mileErr } = await supabase.from('milestones').select('*');
      let mappedMilestones: Milestone[] = this.db.milestones;
      if (!mileErr && remoteMilestones !== null) {
        mappedMilestones = remoteMilestones.map((m) => ({
          id: m.id,
          projectId: m.project_id,
          title: m.title,
          description: m.description,
          status: m.status,
          dueDate: m.due_date,
          createdAt: m.created_at,
        }));
      } else if (mileErr) {
        logger.error('WorkspaceRepository', 'Error fetching milestones from Supabase', mileErr);
      }

      // 7. Sync documents
      const { data: remoteDocs, error: docErr } = await supabase.from('documents').select('*');
      let mappedDocs: ProjectDocument[] = this.db.documents;
      if (!docErr && remoteDocs !== null) {
        mappedDocs = remoteDocs.map((d) => ({
          id: d.id,
          projectId: d.project_id,
          title: d.title,
          fileName: d.file_name,
          fileSize: d.file_size,
          mimeType: d.mime_type,
          storagePath: d.storage_path,
          isRestricted: Boolean(d.is_restricted),
          uploadedBy: d.uploaded_by,
          createdAt: d.created_at,
          updatedAt: d.updated_at || d.created_at,
        }));
      } else if (docErr) {
        logger.error('WorkspaceRepository', 'Error fetching documents from Supabase', docErr);
      }

      // 8. Sync ideas (strictly isolated to current authenticated user)
      let mappedIdeas: Idea[] = this.db.ideas;
      if (currentUserId) {
        const { data: remoteIdeas, error: ideaErr } = await supabase
          .from('ideas')
          .select('*')
          .eq('user_id', currentUserId);

        if (!ideaErr && remoteIdeas !== null) {
          mappedIdeas = remoteIdeas.map((i) => ({
            id: i.id,
            userId: i.user_id,
            title: i.title,
            description: i.description || '',
            category: i.category || 'note',
            priority: i.priority || 'medium',
            status: i.status || 'inbox',
            tags: i.tags || [],
            isArchived: Boolean(i.is_archived),
            createdAt: i.created_at,
            updatedAt: i.updated_at,
          }));
        } else if (ideaErr) {
          logger.error('WorkspaceRepository', 'Error fetching ideas from Supabase', ideaErr);
        }
      }

      // 9. Sync notifications (strictly recipient filtered)
      let mappedNotifications: AppNotification[] = this.db.notifications;
      if (currentUserId) {
        const { data: remoteNotifs, error: notifErr } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', currentUserId)
          .order('created_at', { ascending: false });

        if (!notifErr && remoteNotifs !== null) {
          mappedNotifications = remoteNotifs.map((n) => ({
            id: n.id,
            recipientId: n.recipient_id,
            type: n.type,
            title: n.title,
            body: n.body,
            link: n.link,
            isRead: Boolean(n.is_read),
            createdAt: n.created_at,
          }));
        } else if (notifErr) {
          logger.error('WorkspaceRepository', 'Error fetching notifications from Supabase', notifErr);
        }
      }

      // 10. Sync suggestions (authoritative remote state; if remote table has 0 rows, collection is legitimately empty)
      const { data: remoteSuggestions, error: sugErr } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false });
      let mappedSuggestions: Suggestion[] = this.db.suggestions;
      if (!sugErr && remoteSuggestions !== null) {
        mappedSuggestions = remoteSuggestions.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          category: s.category,
          projectId: s.project_id || undefined,
          submitterId: s.submitter_id,
          status: s.status,
          adminNotes: s.admin_notes || undefined,
          adminResponse: s.admin_response || undefined,
          convertedTaskId: s.converted_task_id || undefined,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }));
      } else if (sugErr) {
        logger.error('WorkspaceRepository', 'Error fetching suggestions from Supabase', sugErr);
      }

      // 11. Sync document access grants (authoritative remote state; if remote table has 0 rows, collection is legitimately empty)
      const { data: remoteGrants, error: grantErr } = await supabase.from('document_access_grants').select('*');
      let mappedGrants: DocumentAccessGrant[] = this.db.documentGrants;
      if (!grantErr && remoteGrants !== null) {
        mappedGrants = remoteGrants.map((g) => ({
          id: g.id,
          documentId: g.document_id,
          userId: g.user_id,
          status: g.status,
          reason: g.reason || undefined,
          grantedUntil: g.granted_until || undefined,
          requestedAt: g.requested_at,
          reviewedBy: g.reviewed_by || undefined,
          reviewedAt: g.reviewed_at || undefined,
          reviewerNotes: g.reviewer_notes || undefined,
        }));
      } else if (grantErr) {
        logger.error('WorkspaceRepository', 'Error fetching document access grants from Supabase', grantErr);
      }

      // 12. Persist complete synchronized workspace state authoritatively
      this.saveDatabase({
        ...this.db,
        profiles: mappedProfiles,
        projects: mappedProjects,
        projectMembers: mappedMembers,
        announcements: mappedAnnouncements,
        tasks: mappedTasks,
        milestones: mappedMilestones,
        documents: mappedDocs,
        documentGrants: mappedGrants,
        suggestions: mappedSuggestions,
        ideas: mappedIdeas,
        notifications: mappedNotifications,
      });

      logger.info(
        'WorkspaceRepository',
        `Synced with Supabase: ${mappedProjects.length} projects, ${mappedAnnouncements.length} announcements, ${mappedSuggestions.length} suggestions`
      );
    } catch (err) {
      logger.error('WorkspaceRepository', 'Error syncing with Supabase', err);
    }
  }

  // Profiles
  getProfiles(): UserProfile[] {
    return [...this.db.profiles];
  }

  getProfileById(id: string): UserProfile | undefined {
    return this.db.profiles.find((p) => p.id === id);
  }

  getProfileByEmail(email: string): UserProfile | undefined {
    return this.db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
  }

  updateProfile(id: string, updates: Partial<UserProfile>): UserProfile {
    const profiles = this.db.profiles.map((p) => (p.id === id ? { ...p, ...updates } : p));
    this.saveDatabase({ ...this.db, profiles });

    const supabase = getSupabaseClient();
    if (supabase) {
      const payload: Record<string, unknown> = {};
      if (updates.fullName !== undefined) payload.full_name = updates.fullName;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
      if (updates.bio !== undefined) payload.bio = updates.bio;
      if (updates.labels !== undefined) payload.labels = updates.labels;
      if (updates.mfaEnabled !== undefined) payload.mfa_enabled = updates.mfaEnabled;
      if (updates.githubUsername !== undefined) payload.github_username = updates.githubUsername;

      Promise.resolve(
        supabase
          .from('profiles')
          .update(payload)
          .eq('id', id)
      )
        .then(() => logger.info('WorkspaceRepository', 'Synced profile update to Supabase'))
        .catch((e: unknown) => logger.warn('WorkspaceRepository', 'Failed to update remote profile', e));
    }

    return this.getProfileById(id)!;
  }

  addProfileLabel(userId: string, label: string) {
    const profile = this.getProfileById(userId);
    if (!profile) return;
    const clean = label.trim();
    if (!clean || profile.labels.includes(clean)) return;
    this.updateProfile(userId, { labels: [...profile.labels, clean] });
  }

  removeProfileLabel(userId: string, label: string) {
    const profile = this.getProfileById(userId);
    if (!profile) return;
    this.updateProfile(userId, { labels: profile.labels.filter((l) => l !== label) });
  }

  updateProfileLabels(userId: string, label: string, action: 'add' | 'remove', actorId?: string) {
    if (action === 'add') {
      this.addProfileLabel(userId, label);
    } else {
      this.removeProfileLabel(userId, label);
    }
  }

  // Projects & Membership
  getProjects(forUserId?: string): Project[] {
    const user = forUserId ? this.getProfileById(forUserId) : undefined;
    const isSuperAdmin = user?.role === 'super_admin';

    return this.db.projects.map((project) => {
      const members = this.db.projectMembers
        .filter((pm) => pm.projectId === project.id)
        .map((pm) => ({
          ...pm,
          user: this.getProfileById(pm.userId),
        }));

      const projectTasks = this.db.tasks.filter((t) => t.projectId === project.id);
      const doneTasks = projectTasks.filter((t) => t.status === 'done');

      return {
        ...project,
        members,
        owner: this.getProfileById(project.ownerId),
        taskCount: {
          total: projectTasks.length,
          done: doneTasks.length,
        },
      };
    }).filter((proj) => {
      if (!forUserId || isSuperAdmin) return true;
      // Member only sees projects they are explicitly assigned to or they own!
      return proj.ownerId === forUserId || this.db.projectMembers.some((pm) => pm.projectId === proj.id && pm.userId === forUserId);
    });
  }

  getProjectById(projectId: string, forUserId?: string): Project | null {
    const all = this.getProjects(forUserId);
    return all.find((p) => p.id === projectId) || null;
  }

  async createProject(
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>,
    creatorId: string
  ): Promise<Project> {
    const newId = generateUuid();
    const baseSlug = projectData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'project';
    const slug = `${baseSlug}-${newId.slice(0, 8)}`;

    const newProject: Project = {
      ...projectData,
      id: newId,
      slug,
      archived: false,
      ownerId: creatorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newMember: ProjectMember = {
      id: generateUuid(),
      projectId: newId,
      userId: creatorId,
      role: 'lead',
      permissions: {
        canManageTasks: true,
        canUploadDocs: true,
        canViewMetrics: true,
        canManageMembers: true,
      },
      joinedAt: new Date().toISOString(),
    };

    const newActivity: ActivityEvent = {
      id: generateUuid(),
      projectId: newId,
      userId: creatorId,
      action: 'project_created',
      details: `Created new project "${newProject.name}"`,
      createdAt: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      // 1. Insert project into Supabase
      const { error: projError } = await supabase
        .from('projects')
        .insert({
          id: newProject.id,
          name: newProject.name,
          slug: newProject.slug,
          summary: newProject.summary,
          problem_statement: newProject.problemStatement || null,
          description: newProject.description,
          goals: newProject.goals || [],
          features: newProject.features || [],
          status: newProject.status,
          priority: newProject.priority,
          tech_stack: newProject.techStack || [],
          repositories: newProject.repositories || [],
          links: newProject.links || [],
          start_date: newProject.startDate ? newProject.startDate : null,
          target_date: newProject.targetDate ? newProject.targetDate : null,
          owner_id: creatorId,
        });

      if (projError) {
        logger.error('WorkspaceRepository', 'Failed to insert project into Supabase', projError);
        throw new Error(`Failed to create project: ${projError.message}`);
      }

      // 2. Insert creator into project_members as lead
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          id: newMember.id,
          project_id: newProject.id,
          user_id: creatorId,
          role: 'lead',
          can_manage_tasks: true,
          can_upload_docs: true,
          can_view_metrics: true,
          can_manage_members: true,
          joined_at: newMember.joinedAt,
        });

      if (memberError) {
        logger.warn('WorkspaceRepository', 'Notice on project_members insert', memberError);
      }
    }

    this.saveDatabase({
      ...this.db,
      projects: [newProject, ...this.db.projects],
      projectMembers: [newMember, ...this.db.projectMembers],
      activityLogs: [newActivity, ...this.db.activityLogs],
    });

    logger.info('WorkspaceRepository', `Project created: ${newId}`, { name: newProject.name });
    return this.getProjectById(newId)!;
  }

  async updateProject(projectId: string, updates: Partial<Project>, actorId: string): Promise<Project> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.summary !== undefined) payload.summary = updates.summary;
      if (updates.problemStatement !== undefined) payload.problem_statement = updates.problemStatement || null;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.techStack !== undefined) payload.tech_stack = updates.techStack;
      if (updates.goals !== undefined) payload.goals = updates.goals;
      if (updates.features !== undefined) payload.features = updates.features;
      if (updates.repositories !== undefined) payload.repositories = updates.repositories;
      if (updates.links !== undefined) payload.links = updates.links;
      if (updates.startDate !== undefined) payload.start_date = updates.startDate ? updates.startDate : null;
      if (updates.targetDate !== undefined) payload.target_date = updates.targetDate ? updates.targetDate : null;
      if (updates.archived !== undefined) payload.archived = updates.archived;

      const { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', projectId);

      if (error) {
        logger.error('WorkspaceRepository', 'Failed to update project in Supabase', error);
        throw new Error(`Failed to update project: ${error.message}`);
      }
    }

    const updatedProjects = this.db.projects.map((p) =>
      p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );

    const newActivity: ActivityEvent = {
      id: generateUuid(),
      projectId,
      userId: actorId,
      action: 'project_updated',
      details: `Updated project configuration`,
      createdAt: new Date().toISOString(),
    };

    this.saveDatabase({
      ...this.db,
      projects: updatedProjects,
      activityLogs: [newActivity, ...this.db.activityLogs],
    });

    return this.getProjectById(projectId)!;
  }

  deleteProjectSecure(projectId: string, actorEmail: string): boolean {
    const isEligible = actorEmail.trim().toLowerCase() === 'realgauravpatel@gmail.com';
    const profile = this.getProfileByEmail(actorEmail);
    if (!isEligible || profile?.role !== 'super_admin') {
      logger.error('WorkspaceRepository', 'Unauthorized deletion attempt blocked', { actorEmail, projectId });
      throw new Error('Unauthorized: Destructive operations require verified Super Admin privileges (realgauravpatel@gmail.com).');
    }

    const project = this.db.projects.find((p) => p.id === projectId);
    if (!project) return false;

    // Cascading local cleanup: tasks, milestones, documents, grants, members, project
    const remainingTasks = this.db.tasks.filter((t) => t.projectId !== projectId);
    const remainingMilestones = this.db.milestones.filter((m) => m.projectId !== projectId);
    const projectDocIds = this.db.documents.filter((d) => d.projectId === projectId).map((d) => d.id);
    const remainingDocs = this.db.documents.filter((d) => d.projectId !== projectId);
    const remainingGrants = this.db.documentGrants.filter((g) => !projectDocIds.includes(g.documentId));
    const remainingMembers = this.db.projectMembers.filter((pm) => pm.projectId !== projectId);
    const remainingProjects = this.db.projects.filter((p) => p.id !== projectId);

    const auditEvent: ActivityEvent = {
      id: `act-${Date.now()}`,
      projectId,
      userId: profile.id,
      action: 'project_deleted',
      details: `Permanently deleted project "${project.name}" (cascade: tasks, milestones, documents)`,
      createdAt: new Date().toISOString(),
    };

    this.saveDatabase({
      ...this.db,
      projects: remainingProjects,
      tasks: remainingTasks,
      milestones: remainingMilestones,
      documents: remainingDocs,
      documentGrants: remainingGrants,
      projectMembers: remainingMembers,
      activityLogs: [auditEvent, ...this.db.activityLogs],
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.rpc('secure_delete_project', { target_project_id: projectId })
      ).catch(() => {
        Promise.all([
          supabase.from('tasks').delete().eq('project_id', projectId),
          supabase.from('milestones').delete().eq('project_id', projectId),
          supabase.from('documents').delete().eq('project_id', projectId),
          supabase.from('project_members').delete().eq('project_id', projectId),
          supabase.from('projects').delete().eq('id', projectId),
        ]).catch((e) => logger.warn('WorkspaceRepository', 'Supabase delete cascade warning', e));
      });
    }

    logger.info('WorkspaceRepository', `Project securely deleted: ${project.name} (${projectId})`);
    return true;
  }

  // Project Members
  getProjectMembers(projectId: string): ProjectMember[] {
    return this.db.projectMembers
      .filter((pm) => pm.projectId === projectId)
      .map((pm) => ({
        ...pm,
        user: this.getProfileById(pm.userId),
      }));
  }

  addProjectMember(
    projectId: string,
    userId: string,
    role: ProjectRole,
    permissions: ProjectMember['permissions'],
    actorId: string
  ): ProjectMember {
    const existing = this.db.projectMembers.find((pm) => pm.projectId === projectId && pm.userId === userId);
    if (existing) {
      return this.updateProjectMember(existing.id, role, permissions, actorId);
    }

    const newMember: ProjectMember = {
      id: generateUuid(),
      projectId,
      userId,
      role,
      permissions,
      joinedAt: new Date().toISOString(),
    };

    const user = this.getProfileById(userId);
    const proj = this.getProjectById(projectId);

    const newActivity: ActivityEvent = {
      id: generateUuid(),
      projectId,
      userId: actorId,
      action: 'member_added',
      details: `Added ${user?.fullName || 'member'} to project as ${role}`,
      createdAt: new Date().toISOString(),
    };

    const newNotif: AppNotification = {
      id: generateUuid(),
      recipientId: userId,
      type: 'invitation',
      title: 'Added to Project',
      body: `You were added to "${proj?.name || 'project'}" as ${role}.`,
      link: `/projects/${projectId}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      supabase
        .from('project_members')
        .insert({
          id: newMember.id,
          project_id: projectId,
          user_id: userId,
          role,
          can_manage_tasks: permissions.canManageTasks,
          can_upload_docs: permissions.canUploadDocs,
          can_view_metrics: permissions.canViewMetrics,
          can_manage_members: permissions.canManageMembers,
          joined_at: newMember.joinedAt,
        })
        .then(({ error }) => {
          if (error) logger.warn('WorkspaceRepository', 'Notice on project_members insert', error);
        });
    }

    this.saveDatabase({
      ...this.db,
      projectMembers: [...this.db.projectMembers, newMember],
      activityLogs: [newActivity, ...this.db.activityLogs],
      notifications: [newNotif, ...this.db.notifications],
    });

    return { ...newMember, user };
  }

  updateProjectMember(
    memberId: string,
    role: ProjectRole,
    permissions: ProjectMember['permissions'],
    actorId: string
  ): ProjectMember {
    const updated = this.db.projectMembers.map((pm) =>
      pm.id === memberId ? { ...pm, role, permissions } : pm
    );

    this.saveDatabase({
      ...this.db,
      projectMembers: updated,
    });

    const target = updated.find((pm) => pm.id === memberId)!;
    return { ...target, user: this.getProfileById(target.userId) };
  }

  removeProjectMember(memberId: string, actorId: string) {
    const member = this.db.projectMembers.find((pm) => pm.id === memberId);
    if (!member) return;

    this.saveDatabase({
      ...this.db,
      projectMembers: this.db.projectMembers.filter((pm) => pm.id !== memberId),
    });
  }

  // Invitations
  getInvitations(): Invitation[] {
    const now = new Date();
    // Return sanitized invitations without exposing raw token if tokenHash is used
    return this.db.invitations.map((i) => {
      const isExpired = new Date(i.expiresAt) <= now;
      const status = i.revokedAt ? 'revoked' : i.acceptedAt ? 'accepted' : isExpired ? 'expired' : 'pending';
      return {
        ...i,
        status,
      };
    });
  }

  createInvitation(
    email: string,
    role: UserRole,
    initialLabels: string[],
    assignedProjectIds: string[],
    expiresInDays: number,
    invitedBy: string,
    invitedProjectRole: ProjectRole = 'collaborator'
  ): Invitation {
    const rawToken = generateSecureToken();
    const tokenHash = hashTokenSync(rawToken);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    // Verify authorized inviter permissions
    const inviter = this.db.profiles.find((p) => p.id === invitedBy);
    const isSuperAdmin = inviter?.role === 'super_admin' || inviter?.email.toLowerCase() === 'realgauravpatel@gmail.com';

    // Strictly prevent non-admins from inviting workspace super_admins or unauthorized projects
    const safeRole: UserRole = isSuperAdmin && role === 'super_admin' ? 'super_admin' : 'member';

    // If not super admin, must be lead/canManageMembers of the assigned project
    if (!isSuperAdmin) {
      if (!assignedProjectIds || assignedProjectIds.length === 0) {
        throw new Error('Only the Workspace Super Admin can issue open workspace invitations.');
      }
      for (const projId of assignedProjectIds) {
        const membership = this.db.projectMembers.find((pm) => pm.projectId === projId && pm.userId === invitedBy);
        if (!membership || (membership.role !== 'lead' && !membership.permissions?.canManageMembers)) {
          throw new Error('You do not have permission to invite members to this project.');
        }
      }
    }

    const generatedId = generateUuid();
    const newInv: Invitation = {
      id: generatedId,
      email: email.trim().toLowerCase(),
      role: safeRole,
      token: rawToken, // Returned to the creator for copy/delivery, not retained in DB
      tokenHash,
      status: 'pending',
      invitedBy,
      initialLabels,
      assignedProjectIds,
      invitedProjectRole,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    // In local storage, store tokenHash and raw token for local dev/preview
    this.saveDatabase({
      ...this.db,
      invitations: [newInv, ...this.db.invitations],
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      const validAssignedProjectIds = (assignedProjectIds || []).filter(isValidUuid);
      const isInviterUuid = isValidUuid(invitedBy);

      const dbPayload: Record<string, any> = {
        id: generatedId,
        email: newInv.email,
        role: newInv.role,
        token_hash: tokenHash, // Store ONLY cryptographic SHA-256 hash
        initial_labels: initialLabels,
        assigned_project_ids: validAssignedProjectIds,
        invited_project_role: invitedProjectRole,
        expires_at: newInv.expiresAt,
        status: 'pending',
      };
      if (isInviterUuid) {
        dbPayload.invited_by = invitedBy;
      }

      Promise.resolve(
        supabase.from('invitations').insert(dbPayload)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not save invitation in Supabase', e));
    }

    logger.info('WorkspaceRepository', `Created secure single-use invitation for ${email}`);
    return newInv;
  }

  revokeInvitation(invitationId: string, revokedBy: string): void {
    const inv = this.db.invitations.find((i) => i.id === invitationId);
    if (!inv) throw new Error('Invitation not found.');

    const revoker = this.db.profiles.find((p) => p.id === revokedBy);
    const isSuperAdmin = revoker?.role === 'super_admin' || revoker?.email.toLowerCase() === 'realgauravpatel@gmail.com';

    if (!isSuperAdmin && inv.invitedBy !== revokedBy) {
      throw new Error('Only the Super Admin or original inviter can revoke this invitation.');
    }

    if (inv.acceptedAt) {
      throw new Error('Cannot revoke an invitation that has already been accepted.');
    }

    const now = new Date().toISOString();
    const updatedInvitations = this.db.invitations.map((i) =>
      i.id === invitationId ? { ...i, revokedAt: now, status: 'revoked' as const } : i
    );

    this.saveDatabase({
      ...this.db,
      invitations: updatedInvitations,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase
          .from('invitations')
          .update({ revoked_at: now, status: 'revoked' })
          .eq('id', invitationId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not revoke invitation in Supabase', e));
    }

    logger.info('WorkspaceRepository', `Revoked invitation ${invitationId} for ${inv.email}`);
  }

  /**
   * Safe inspection of an invitation token against Supabase (RPC) with fallback to local storage.
   * Can be safely called by unauthenticated incoming recipients.
   */
  async inspectInvitationRemote(tokenOrHash: string): Promise<{
    valid: boolean;
    id?: string;
    email?: string;
    scope?: string;
    role?: UserRole;
    projectName?: string;
    projectRole?: ProjectRole;
    inviterName?: string;
    expiresAt?: string;
    reason?: string;
  }> {
    const cleanToken = tokenOrHash.trim();
    if (!cleanToken) {
      return { valid: false, reason: 'invalid_input' };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('inspect_invitation_by_token', {
          p_token_or_hash: cleanToken,
        });
        if (!error && data) {
          return {
            valid: Boolean(data.valid),
            id: data.id,
            email: data.email,
            scope: data.scope,
            role: data.role,
            projectName: data.projectName,
            projectRole: data.projectRole,
            inviterName: data.inviterName,
            expiresAt: data.expiresAt,
            reason: data.reason,
          };
        }
        if (error) {
          logger.warn('WorkspaceRepository', 'RPC inspect_invitation_by_token returned error', error);
        }
      } catch (err) {
        logger.warn('WorkspaceRepository', 'RPC inspect_invitation_by_token query threw', err);
      }
    }

    // Fallback to local memory / local storage
    const computedHash = hashTokenSync(cleanToken);
    const inv = this.db.invitations.find(
      (i) => i.tokenHash === computedHash || i.token === cleanToken || i.tokenHash === cleanToken || i.token === computedHash
    );

    if (!inv) return { valid: false, reason: 'not_found' };
    if (inv.revokedAt || inv.status === 'revoked') return { valid: false, reason: 'revoked', email: inv.email };
    if (inv.acceptedAt || inv.status === 'accepted') return { valid: false, reason: 'accepted', email: inv.email };
    if (new Date(inv.expiresAt) <= new Date()) return { valid: false, reason: 'expired', email: inv.email };

    return {
      valid: true,
      id: inv.id,
      email: inv.email,
      role: inv.role,
      projectRole: inv.invitedProjectRole,
      expiresAt: inv.expiresAt,
      inviterName: this.getProfileById(inv.invitedBy)?.fullName || 'Workspace Admin',
    };
  }

  redeemInvitation(tokenOrHash: string, fullName: string, expectedEmail?: string, explicitUserId?: string): UserProfile {
    const cleanToken = tokenOrHash.trim();
    const computedHash = hashTokenSync(cleanToken);

    // Look up by tokenHash, raw token, or direct hash match
    const inv = this.db.invitations.find(
      (i) => i.tokenHash === computedHash || i.token === cleanToken || i.tokenHash === cleanToken || i.token === computedHash
    );

    if (!inv) throw new Error('Invalid or unknown invitation token.');
    if (inv.revokedAt || inv.status === 'revoked') {
      throw new Error('This invitation has been revoked by workspace administrators.');
    }
    if (inv.acceptedAt || inv.status === 'accepted') {
      throw new Error('This invitation has already been redeemed.');
    }
    if (new Date(inv.expiresAt) <= new Date()) {
      throw new Error('This invitation has expired.');
    }
    if (expectedEmail && inv.email.toLowerCase() !== expectedEmail.trim().toLowerCase()) {
      throw new Error(`This invitation was issued to ${inv.email}. Please sign in with the matching email address.`);
    }

    const existingProfile = this.db.profiles.find((p) => p.email.toLowerCase() === inv.email.toLowerCase());
    const targetUserId = explicitUserId || existingProfile?.id || (isValidUuid(fullName) ? fullName : `user-${Date.now()}`);
    const resolvedFullName = existingProfile?.fullName || (isValidUuid(fullName) ? inv.email.split('@')[0] : fullName.trim());

    const newProfile: UserProfile = existingProfile ? {
      ...existingProfile,
      lastActiveAt: new Date().toISOString(),
    } : {
      id: targetUserId,
      email: inv.email,
      fullName: resolvedFullName,
      role: inv.email.toLowerCase() === 'realgauravpatel@gmail.com' ? 'super_admin' : 'member',
      labels: inv.initialLabels && inv.initialLabels.length > 0 ? inv.initialLabels : ['Developer'],
      mfaEnabled: true,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    const updatedInvitations = this.db.invitations.map((i) =>
      i.id === inv.id ? { ...i, acceptedAt: new Date().toISOString(), acceptedBy: targetUserId, status: 'accepted' as const } : i
    );

    const projectRole: ProjectRole = inv.invitedProjectRole || 'collaborator';
    const newProjectMembers: ProjectMember[] = (inv.assignedProjectIds || []).map((projId) => ({
      id: `pm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectId: projId,
      userId: targetUserId,
      role: projectRole,
      permissions: {
        canManageTasks: projectRole !== 'viewer',
        canUploadDocs: projectRole !== 'viewer',
        canViewMetrics: true,
        canManageMembers: projectRole === 'lead',
      },
      joinedAt: new Date().toISOString(),
    }));

    const newWorkspaceMember: WorkspaceMember = {
      userId: targetUserId,
      role: inv.email.toLowerCase() === 'realgauravpatel@gmail.com' ? 'super_admin' : 'member',
      joinedAt: new Date().toISOString(),
      invitedBy: inv.invitedBy,
    };

    const updatedProfiles = existingProfile
      ? this.db.profiles.map((p) => (p.id === existingProfile.id ? newProfile : p))
      : [...this.db.profiles, newProfile];

    const updatedWorkspaceMembers = [
      ...(this.db.workspaceMembers || []).filter((wm) => wm.userId !== targetUserId),
      newWorkspaceMember,
    ];

    this.saveDatabase({
      ...this.db,
      profiles: updatedProfiles,
      workspaceMembers: updatedWorkspaceMembers,
      invitations: updatedInvitations,
      projectMembers: [...this.db.projectMembers, ...newProjectMembers],
    });

    return newProfile;
  }

  // Tasks & Milestones
  getTasks(projectId?: string): Task[] {
    let tasks = this.db.tasks;
    if (projectId) {
      tasks = tasks.filter((t) => t.projectId === projectId);
    }
    return tasks.map((t) => ({
      ...t,
      assignee: t.assigneeId ? this.getProfileById(t.assigneeId) : undefined,
    }));
  }

  createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, actorId: string): Task {
    const newId = generateUuid();
    const now = new Date().toISOString();
    const newTask: Task = {
      ...taskData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    const notifs = [...this.db.notifications];
    const notifId = generateUuid();
    if (newTask.assigneeId && newTask.assigneeId !== actorId) {
      const proj = this.getProjectById(newTask.projectId);
      notifs.unshift({
        id: notifId,
        recipientId: newTask.assigneeId,
        type: 'task_assigned',
        title: 'New Task Assigned',
        body: `You were assigned to "${newTask.title}" in ${proj?.name || 'project'}.`,
        link: `/projects/${newTask.projectId}?tab=tasks`,
        isRead: false,
        createdAt: now,
      });
    }

    this.saveDatabase({
      ...this.db,
      tasks: [newTask, ...this.db.tasks],
      notifications: notifs,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('tasks').insert({
          id: newTask.id,
          project_id: newTask.projectId,
          title: newTask.title,
          description: newTask.description,
          status: newTask.status,
          priority: newTask.priority,
          assignee_id: newTask.assigneeId && isValidUuid(newTask.assigneeId) ? newTask.assigneeId : null,
          due_date: newTask.dueDate || null,
          milestone_id: newTask.milestoneId && isValidUuid(newTask.milestoneId) ? newTask.milestoneId : null,
          tags: newTask.tags || [],
        })
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync task to Supabase', e));

      if (newTask.assigneeId && newTask.assigneeId !== actorId && isValidUuid(newTask.assigneeId)) {
        const proj = this.getProjectById(newTask.projectId);
        Promise.resolve(
          supabase.from('notifications').insert({
            id: notifId,
            recipient_id: newTask.assigneeId,
            type: 'task_assigned',
            title: 'New Task Assigned',
            body: `You were assigned to "${newTask.title}" in ${proj?.name || 'project'}.`,
            link: `/projects/${newTask.projectId}?tab=tasks`,
            is_read: false,
          })
        ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync notification to Supabase', e));
      }
    }

    return { ...newTask, assignee: newTask.assigneeId ? this.getProfileById(newTask.assigneeId) : undefined };
  }

  updateTask(taskId: string, updates: Partial<Task>, _actorId: string): Task {
    const updatedTasks = this.db.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );

    this.saveDatabase({
      ...this.db,
      tasks: updatedTasks,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.assigneeId !== undefined) {
        dbUpdates.assignee_id = updates.assigneeId && isValidUuid(updates.assigneeId) ? updates.assigneeId : null;
      }
      if (updates.milestoneId !== undefined) {
        dbUpdates.milestone_id = updates.milestoneId && isValidUuid(updates.milestoneId) ? updates.milestoneId : null;
      }

      Promise.resolve(
        supabase.from('tasks').update(dbUpdates).eq('id', taskId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not update task in Supabase', e));
    }

    const target = updatedTasks.find((t) => t.id === taskId)!;
    return { ...target, assignee: target.assigneeId ? this.getProfileById(target.assigneeId) : undefined };
  }

  deleteTask(taskId: string) {
    this.saveDatabase({
      ...this.db,
      tasks: this.db.tasks.filter((t) => t.id !== taskId),
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('tasks').delete().eq('id', taskId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not delete task in Supabase', e));
    }
  }

  getMilestones(projectId: string): Milestone[] {
    return this.db.milestones.filter((m) => m.projectId === projectId);
  }

  createMilestone(milestoneData: Omit<Milestone, 'id' | 'createdAt'>): Milestone {
    const newId = generateUuid();
    const now = new Date().toISOString();
    const newMilestone: Milestone = {
      ...milestoneData,
      id: newId,
      createdAt: now,
    };
    this.saveDatabase({
      ...this.db,
      milestones: [...this.db.milestones, newMilestone],
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('milestones').insert({
          id: newMilestone.id,
          project_id: newMilestone.projectId,
          title: newMilestone.title,
          description: newMilestone.description || null,
          due_date: newMilestone.dueDate,
          status: newMilestone.status || 'open',
        })
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync milestone to Supabase', e));
    }

    return newMilestone;
  }

  // Documents
  getDocuments(projectId: string, forUserId: string): ProjectDocument[] {
    const user = this.getProfileById(forUserId);
    const isSuperAdmin = user?.role === 'super_admin';

    const userApprovedGrants = this.db.documentGrants.filter(
      (g) =>
        g.userId === forUserId &&
        g.status === 'approved' &&
        (!g.grantedUntil || new Date(g.grantedUntil) > new Date())
    );
    const approvedDocIds = new Set(userApprovedGrants.map((g) => g.documentId));

    return this.db.documents
      .filter((d) => d.projectId === projectId)
      .filter((d) => {
        if (!d.isRestricted) return true;
        if (isSuperAdmin) return true;
        return approvedDocIds.has(d.id);
      })
      .map((d) => ({
        ...d,
        uploader: this.getProfileById(d.uploadedBy),
      }));
  }

  createDocument(docData: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>): ProjectDocument {
    const newId = generateUuid();
    const now = new Date().toISOString();
    const newDoc: ProjectDocument = {
      ...docData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    this.saveDatabase({
      ...this.db,
      documents: [newDoc, ...this.db.documents],
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('documents').insert({
          id: newDoc.id,
          project_id: newDoc.projectId,
          title: newDoc.title,
          file_name: newDoc.fileName,
          file_size: newDoc.fileSize,
          mime_type: newDoc.mimeType,
          storage_path: newDoc.storagePath,
          is_restricted: newDoc.isRestricted,
          uploaded_by: newDoc.uploadedBy,
        })
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync document to Supabase', e));
    }

    return { ...newDoc, uploader: this.getProfileById(newDoc.uploadedBy) };
  }

  getDocumentGrants(documentId?: string): DocumentAccessGrant[] {
    let grants = this.db.documentGrants;
    if (documentId) grants = grants.filter((g) => g.documentId === documentId);
    return grants.map((g) => ({
      ...g,
      user: this.getProfileById(g.userId),
      document: this.db.documents.find((d) => d.id === g.documentId),
    }));
  }

  requestDocumentAccess(documentId: string, userId: string, reason: string): DocumentAccessGrant {
    const existing = this.db.documentGrants.find((g) => g.documentId === documentId && g.userId === userId);
    const grantId = existing ? existing.id : generateUuid();
    const now = new Date().toISOString();
    const notifId = generateUuid();

    const newGrant: DocumentAccessGrant = {
      id: grantId,
      documentId,
      userId,
      status: 'pending',
      reason,
      requestedAt: now,
    };

    const doc = this.db.documents.find((d) => d.id === documentId);
    const user = this.getProfileById(userId);
    const superAdmin = this.db.profiles.find((p) => p.role === 'super_admin');

    const notifs = [...this.db.notifications];
    if (superAdmin) {
      notifs.unshift({
        id: notifId,
        recipientId: superAdmin.id,
        type: 'doc_request',
        title: 'Restricted Document Access Request',
        body: `${user?.fullName || 'A member'} requested access to "${doc?.title || 'a restricted document'}".`,
        isRead: false,
        createdAt: now,
      });
    }

    const updatedGrants = existing
      ? this.db.documentGrants.map((g) => (g.id === existing.id ? newGrant : g))
      : [newGrant, ...this.db.documentGrants];

    this.saveDatabase({
      ...this.db,
      documentGrants: updatedGrants,
      notifications: notifs,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('document_access_grants').upsert({
          id: grantId,
          document_id: documentId,
          user_id: userId,
          status: 'pending',
          reason,
          requested_at: now,
        })
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync document grant to Supabase', e));

      if (superAdmin && isValidUuid(superAdmin.id)) {
        Promise.resolve(
          supabase.from('notifications').insert({
            id: notifId,
            recipient_id: superAdmin.id,
            type: 'doc_request',
            title: 'Restricted Document Access Request',
            body: `${user?.fullName || 'A member'} requested access to "${doc?.title || 'a restricted document'}".`,
            is_read: false,
          })
        ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync notification to Supabase', e));
      }
    }

    return { ...newGrant, user, document: doc };
  }

  reviewDocumentAccess(
    grantId: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    grantedUntil?: string,
    reviewerNotes?: string
  ) {
    const grant = this.db.documentGrants.find((g) => g.id === grantId);
    if (!grant) return;

    const now = new Date().toISOString();
    const notifId = generateUuid();
    const updatedGrants = this.db.documentGrants.map((g) =>
      g.id === grantId
        ? {
            ...g,
            status,
            reviewedBy: reviewerId,
            reviewedAt: now,
            grantedUntil,
            reviewerNotes,
          }
        : g
    );

    const doc = this.db.documents.find((d) => d.id === grant.documentId);
    const notifs = [...this.db.notifications];
    notifs.unshift({
      id: notifId,
      recipientId: grant.userId,
      type: 'doc_request',
      title: `Document Access ${status === 'approved' ? 'Approved' : 'Declined'}`,
      body: `Your request for "${doc?.title || 'document'}" was ${status}.`,
      isRead: false,
      createdAt: now,
    });

    this.saveDatabase({
      ...this.db,
      documentGrants: updatedGrants,
      notifications: notifs,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('document_access_grants').update({
          status,
          reviewed_by: isValidUuid(reviewerId) ? reviewerId : null,
          reviewed_at: now,
          granted_until: grantedUntil || null,
          reviewer_notes: reviewerNotes || null,
        }).eq('id', grantId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not update document grant in Supabase', e));

      if (isValidUuid(grant.userId)) {
        Promise.resolve(
          supabase.from('notifications').insert({
            id: notifId,
            recipient_id: grant.userId,
            type: 'doc_request',
            title: `Document Access ${status === 'approved' ? 'Approved' : 'Declined'}`,
            body: `Your request for "${doc?.title || 'document'}" was ${status}.`,
            is_read: false,
          })
        ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync notification to Supabase', e));
      }
    }
  }

  // Suggestions Center (Shared with authorized workspace and project members)
  getSuggestions(forUserId?: string): Suggestion[] {
    const actor = forUserId ? this.getProfileById(forUserId) : undefined;
    const isSuperAdmin =
      actor?.role === 'super_admin' || actor?.email.toLowerCase() === 'realgauravpatel@gmail.com';
    const isMember = this.isWorkspaceMember(forUserId);

    let list = this.db.suggestions;
    if (forUserId && !isSuperAdmin) {
      if (!isMember) {
        // Non-members are restricted strictly to their own submissions (if any)
        return list
          .filter((s) => s.submitterId === forUserId)
          .map((s) => ({
            ...s,
            submitter: this.getProfileById(s.submitterId),
          }));
      }

      const userProjectIds = new Set(
        this.db.projectMembers.filter((pm) => pm.userId === forUserId).map((pm) => pm.projectId)
      );
      list = list.filter((s) => {
        // Submitter can always view
        if (s.submitterId === forUserId) return true;
        // General workspace suggestion (no project_id): visible to verified workspace members
        if (!s.projectId) return true;
        // Project-specific suggestion: only if user has access to that project
        return userProjectIds.has(s.projectId);
      });
    }

    return list.map((s) => ({
      ...s,
      submitter: this.getProfileById(s.submitterId),
    }));
  }

  createSuggestion(data: Omit<Suggestion, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Suggestion {
    if (!this.isWorkspaceMember(data.submitterId)) {
      throw new Error('Unauthorized: Only verified workspace members can submit suggestions.');
    }

    const newId = generateUuid();
    const now = new Date().toISOString();
    const newSug: Suggestion = {
      ...data,
      id: newId,
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    };

    const notifId = generateUuid();
    const superAdmin = this.db.profiles.find((p) => p.role === 'super_admin');
    const submitter = this.getProfileById(data.submitterId);
    const notifs = [...this.db.notifications];
    if (superAdmin && superAdmin.id !== data.submitterId) {
      notifs.unshift({
        id: notifId,
        recipientId: superAdmin.id,
        type: 'suggestion_update',
        title: 'New Member Suggestion',
        body: `${submitter?.fullName || 'A member'} submitted: "${newSug.title}"`,
        isRead: false,
        createdAt: now,
      });
    }

    this.saveDatabase({
      ...this.db,
      suggestions: [newSug, ...this.db.suggestions],
      notifications: notifs,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('suggestions').insert({
          id: newSug.id,
          title: newSug.title,
          description: newSug.description,
          category: newSug.category,
          project_id: newSug.projectId && isValidUuid(newSug.projectId) ? newSug.projectId : null,
          submitter_id: newSug.submitterId,
          status: newSug.status,
        })
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync suggestion to Supabase', e));

      if (superAdmin && superAdmin.id !== data.submitterId && isValidUuid(superAdmin.id)) {
        Promise.resolve(
          supabase.from('notifications').insert({
            id: notifId,
            recipient_id: superAdmin.id,
            type: 'suggestion_update',
            title: 'New Member Suggestion',
            body: `${submitter?.fullName || 'A member'} submitted: "${newSug.title}"`,
            is_read: false,
          })
        ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync notification to Supabase', e));
      }
    }

    return { ...newSug, submitter };
  }

  /**
   * Safe submitter update: allows submitter to update title/description while in 'submitted' status.
   * Strictly prevents altering protected columns (status, adminNotes, adminResponse, convertedTaskId).
   */
  updateSuggestion(
    suggestionId: string,
    updates: Partial<Pick<Suggestion, 'title' | 'description' | 'category' | 'projectId'>>,
    actorId: string
  ): Suggestion {
    const sug = this.db.suggestions.find((s) => s.id === suggestionId);
    if (!sug) throw new Error('Suggestion not found.');

    const actor = this.getProfileById(actorId);
    const isSuperAdmin =
      actor?.role === 'super_admin' || actor?.email.toLowerCase() === 'realgauravpatel@gmail.com';

    if (!isSuperAdmin) {
      if (sug.submitterId !== actorId) {
        throw new Error('Unauthorized: You can only edit your own suggestions.');
      }
      if (sug.status !== 'submitted') {
        throw new Error('Cannot edit suggestion once administrative review has commenced.');
      }
    }

    const now = new Date().toISOString();
    const updated = this.db.suggestions.map((s) =>
      s.id === suggestionId
        ? {
            ...s,
            title: updates.title !== undefined ? updates.title : s.title,
            description: updates.description !== undefined ? updates.description : s.description,
            category: updates.category !== undefined ? updates.category : s.category,
            projectId: updates.projectId !== undefined ? updates.projectId : s.projectId,
            updatedAt: now,
          }
        : s
    );

    this.saveDatabase({
      ...this.db,
      suggestions: updated,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      const dbPayload: Record<string, any> = { updated_at: now };
      if (updates.title !== undefined) dbPayload.title = updates.title;
      if (updates.description !== undefined) dbPayload.description = updates.description;
      if (updates.category !== undefined) dbPayload.category = updates.category;
      if (updates.projectId !== undefined) {
        dbPayload.project_id = updates.projectId && isValidUuid(updates.projectId) ? updates.projectId : null;
      }

      Promise.resolve(
        supabase.from('suggestions').update(dbPayload).eq('id', suggestionId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync suggestion update to Supabase', e));
    }

    const res = updated.find((s) => s.id === suggestionId)!;
    return { ...res, submitter: this.getProfileById(res.submitterId) };
  }

  updateSuggestionStatus(
    suggestionId: string,
    status: Suggestion['status'],
    adminNotes?: string,
    adminResponse?: string,
    actorId?: string
  ) {
    const sug = this.db.suggestions.find((s) => s.id === suggestionId);
    if (!sug) return;

    if (actorId) {
      const actor = this.getProfileById(actorId);
      const isSuperAdmin =
        actor?.role === 'super_admin' || actor?.email.toLowerCase() === 'realgauravpatel@gmail.com';
      if (!isSuperAdmin) {
        throw new Error('Unauthorized: Only Super Admin can modify administrative suggestion status.');
      }
    }

    const now = new Date().toISOString();
    const notifId = generateUuid();
    const updated = this.db.suggestions.map((s) =>
      s.id === suggestionId
        ? {
            ...s,
            status,
            adminNotes: adminNotes !== undefined ? adminNotes : s.adminNotes,
            adminResponse: adminResponse !== undefined ? adminResponse : s.adminResponse,
            updatedAt: now,
          }
        : s
    );

    const notifs = [...this.db.notifications];
    if (sug.submitterId !== actorId) {
      notifs.unshift({
        id: notifId,
        recipientId: sug.submitterId,
        type: 'suggestion_update',
        title: `Suggestion Status: ${status.replace('_', ' ').toUpperCase()}`,
        body: `"${sug.title}" is now marked as ${status}.${adminResponse ? ` Response: ${adminResponse}` : ''}`,
        isRead: false,
        createdAt: now,
      });
    }

    this.saveDatabase({
      ...this.db,
      suggestions: updated,
      notifications: notifs,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('suggestions').update({
          status,
          admin_notes: adminNotes !== undefined ? adminNotes : null,
          admin_response: adminResponse !== undefined ? adminResponse : null,
          updated_at: now,
        }).eq('id', suggestionId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not update suggestion in Supabase', e));

      if (sug.submitterId !== actorId && isValidUuid(sug.submitterId)) {
        Promise.resolve(
          supabase.from('notifications').insert({
            id: notifId,
            recipient_id: sug.submitterId,
            type: 'suggestion_update',
            title: `Suggestion Status: ${status.replace('_', ' ').toUpperCase()}`,
            body: `"${sug.title}" is now marked as ${status}.${adminResponse ? ` Response: ${adminResponse}` : ''}`,
            is_read: false,
          })
        ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync notification to Supabase', e));
      }
    }
  }

  convertSuggestionToTask(
    suggestionId: string,
    projectId: string,
    priority: Task['priority'],
    assigneeId?: string,
    actorId: string = ''
  ): Task {
    const sug = this.db.suggestions.find((s) => s.id === suggestionId);
    if (!sug) throw new Error('Suggestion not found');

    const newTask = this.createTask(
      {
        projectId,
        title: sug.title,
        description: `[Converted from Member Suggestion]:\n${sug.description}`,
        status: 'todo',
        priority,
        assigneeId,
        tags: ['Suggestion', sug.category],
      },
      actorId
    );

    this.updateSuggestionStatus(
      suggestionId,
      'planned',
      sug.adminNotes,
      `Converted to project task in ${this.getProjectById(projectId)?.name || 'project'}.`,
      actorId
    );

    const updatedSuggestions = this.db.suggestions.map((s) =>
      s.id === suggestionId ? { ...s, convertedTaskId: newTask.id } : s
    );

    this.saveDatabase({
      ...this.db,
      suggestions: updatedSuggestions,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('suggestions').update({
          converted_task_id: newTask.id,
          status: 'planned',
          updated_at: new Date().toISOString(),
        }).eq('id', suggestionId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync convertedTaskId to Supabase', e));
    }

    return newTask;
  }

  // Announcements & Notifications
  getAnnouncements(forUserId?: string): Announcement[] {
    if (forUserId && !this.isWorkspaceMember(forUserId)) {
      return [];
    }
    return [...this.db.announcements];
  }

  async broadcastAnnouncement(
    data: Omit<Announcement, 'id' | 'createdAt'>,
    creatorId: string
  ): Promise<Announcement> {
    const newId = generateUuid();
    const newAnc: Announcement = {
      ...data,
      id: newId,
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      const { error: ancError } = await supabase
        .from('announcements')
        .insert({
          id: newAnc.id,
          title: newAnc.title,
          content: newAnc.content,
          priority: newAnc.priority,
          target_type: newAnc.targetType,
          target_meta: newAnc.targetMeta || {},
          created_by: creatorId,
        });

      if (ancError) {
        logger.error('WorkspaceRepository', 'Failed to insert announcement into Supabase', ancError);
        throw new Error(`Failed to publish announcement: ${ancError.message}`);
      }
    }

    let recipientIds: string[] = [];
    if (data.targetType === 'all') {
      recipientIds = this.db.profiles.map((p) => p.id);
    } else if (data.targetType === 'project' && data.targetMeta?.projectId) {
      recipientIds = this.db.projectMembers
        .filter((pm) => pm.projectId === data.targetMeta!.projectId)
        .map((pm) => pm.userId);
    } else if (data.targetType === 'individuals' && data.targetMeta?.userIds) {
      recipientIds = data.targetMeta.userIds;
    } else if (data.targetType === 'labels' && data.targetMeta?.labels) {
      const targetLabels = new Set(data.targetMeta.labels);
      recipientIds = this.db.profiles
        .filter((p) => p.labels.some((l) => targetLabels.has(l)))
        .map((p) => p.id);
    }

    const notifs: AppNotification[] = recipientIds.map((userId) => ({
      id: generateUuid(),
      recipientId: userId,
      type: 'announcement',
      title: `${data.priority === 'important' ? '[Important] ' : ''}${data.title}`,
      body: data.content.slice(0, 160),
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    if (supabase && notifs.length > 0) {
      const notifRows = notifs.map((n) => ({
        id: n.id,
        recipient_id: n.recipientId,
        type: n.type,
        title: n.title,
        body: n.body,
        is_read: false,
      }));
      supabase
        .from('notifications')
        .insert(notifRows)
        .then(({ error }) => {
          if (error) logger.warn('WorkspaceRepository', 'Notice on notifications insert', error);
        });
    }

    this.saveDatabase({
      ...this.db,
      announcements: [newAnc, ...this.db.announcements],
      notifications: [...notifs, ...this.db.notifications],
    });

    logger.info('WorkspaceRepository', `Announcement published: "${newAnc.title}" (${newId})`);
    return newAnc;
  }

  getNotifications(userId: string): AppNotification[] {
    return this.db.notifications.filter((n) => n.recipientId === userId);
  }

  markNotificationRead(notifId: string) {
    const updated = this.db.notifications.map((n) => (n.id === notifId ? { ...n, isRead: true } : n));
    this.saveDatabase({ ...this.db, notifications: updated });

    const supabase = getSupabaseClient();
    if (supabase && isValidUuid(notifId)) {
      Promise.resolve(
        supabase.from('notifications').update({ is_read: true }).eq('id', notifId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not update notification in Supabase', e));
    }
  }

  markAllNotificationsRead(userId: string) {
    const updated = this.db.notifications.map((n) =>
      n.recipientId === userId ? { ...n, isRead: true } : n
    );
    this.saveDatabase({ ...this.db, notifications: updated });

    const supabase = getSupabaseClient();
    if (supabase && isValidUuid(userId)) {
      Promise.resolve(
        supabase.from('notifications').update({ is_read: true }).eq('recipient_id', userId)
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not update notifications in Supabase', e));
    }
  }

  getActivityLogs(projectId?: string): ActivityEvent[] {
    let logs = this.db.activityLogs;
    if (projectId) {
      logs = logs.filter((l) => l.projectId === projectId);
    }
    return logs.map((l) => ({
      ...l,
      user: this.getProfileById(l.userId),
    }));
  }

  // Personal Ideas Feature
  getIdeas(userId: string): Idea[] {
    return this.db.ideas
      .filter((i) => i.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createIdea(
    data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'userId'>,
    userId: string
  ): Idea {
    const newId = `idea-${Date.now()}`;
    const now = new Date().toISOString();
    const newIdea: Idea = {
      ...data,
      id: newId,
      userId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    this.saveDatabase({
      ...this.db,
      ideas: [newIdea, ...this.db.ideas],
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('ideas').insert({
          id: newIdea.id,
          user_id: newIdea.userId,
          title: newIdea.title,
          description: newIdea.description,
          category: newIdea.category,
          priority: newIdea.priority,
          status: newIdea.status,
          tags: newIdea.tags,
          is_archived: newIdea.isArchived,
        })
      ).catch((err: unknown) => logger.warn('WorkspaceRepository', 'Could not sync idea to Supabase', err));
    }

    return newIdea;
  }

  updateIdea(id: string, updates: Partial<Idea>, userId: string): Idea {
    const now = new Date().toISOString();
    const updatedIdeas = this.db.ideas.map((i) =>
      i.id === id && i.userId === userId ? { ...i, ...updates, updatedAt: now } : i
    );
    this.saveDatabase({ ...this.db, ideas: updatedIdeas });

    const supabase = getSupabaseClient();
    if (supabase) {
      const dbUpdates: Record<string, unknown> = { updated_at: now };
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;

      Promise.resolve(
        supabase
          .from('ideas')
          .update(dbUpdates)
          .eq('id', id)
          .eq('user_id', userId)
      ).catch((err: unknown) => logger.warn('WorkspaceRepository', 'Could not update idea in Supabase', err));
    }

    return this.db.ideas.find((i) => i.id === id)!;
  }

  deleteIdea(id: string, userId: string): void {
    const remaining = this.db.ideas.filter((i) => !(i.id === id && i.userId === userId));
    this.saveDatabase({ ...this.db, ideas: remaining });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase
          .from('ideas')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
      ).catch((err: unknown) => logger.warn('WorkspaceRepository', 'Could not delete idea in Supabase', err));
    }
  }

  // Clear all workspace data
  clearWorkspaceData() {
    const empty = getInitialDatabase();
    this.saveDatabase(empty);
    logger.info('WorkspaceRepository', 'Cleared all workspace data');
    return empty;
  }

  resetToSampleData() {
    return this.clearWorkspaceData();
  }
}

export const workspaceRepo = new WorkspaceRepository();
