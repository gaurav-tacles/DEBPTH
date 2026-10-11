import {
  UserProfile,
  Project,
  ProjectMember,
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

const STORAGE_KEY_DATA = 'projecthub_workspace_v3';

interface WorkspaceDatabase {
  profiles: UserProfile[];
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
      const stored = localStorage.getItem(STORAGE_KEY_DATA);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.profiles) && Array.isArray(parsed.projects)) {
          if (!Array.isArray(parsed.ideas)) parsed.ideas = [];
          return parsed;
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
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(data));
      this.db = data;
    } catch (e) {
      logger.error('WorkspaceRepository', 'Failed to save database to storage', e);
    }
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
    this.saveDatabase({
      ...this.db,
      profiles: [...this.db.profiles, newProfile],
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
      const { data: remoteProfiles } = await supabase.from('profiles').select('*');
      if (remoteProfiles && remoteProfiles.length > 0) {
        const mappedProfiles: UserProfile[] = remoteProfiles.map((p) => ({
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
        this.saveDatabase({ ...this.db, profiles: mappedProfiles });
      }

      // 2. Sync projects
      const { data: remoteProjects } = await supabase.from('projects').select('*');
      if (remoteProjects) {
        const mappedProjects: Project[] = remoteProjects.map((p) => ({
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
        this.saveDatabase({ ...this.db, projects: mappedProjects });
      }

      // 3. Sync tasks
      const { data: remoteTasks } = await supabase.from('tasks').select('*');
      if (remoteTasks) {
        const mappedTasks: Task[] = remoteTasks.map((t) => ({
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
        this.saveDatabase({ ...this.db, tasks: mappedTasks });
      }

      // 4. Sync ideas (for current authenticated user)
      if (currentUserId) {
        const { data: remoteIdeas } = await supabase
          .from('ideas')
          .select('*')
          .eq('user_id', currentUserId);

        if (remoteIdeas) {
          const mappedIdeas: Idea[] = remoteIdeas.map((i) => ({
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
          this.saveDatabase({ ...this.db, ideas: mappedIdeas });
        }
      }
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
      Promise.resolve(
        supabase
          .from('profiles')
          .update({
            full_name: updates.fullName,
            labels: updates.labels,
            mfa_enabled: updates.mfaEnabled,
            github_username: updates.githubUsername,
          })
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
      // Member only sees projects they are explicitly assigned to!
      return this.db.projectMembers.some((pm) => pm.projectId === proj.id && pm.userId === forUserId);
    });
  }

  getProjectById(projectId: string, forUserId?: string): Project | null {
    const all = this.getProjects(forUserId);
    return all.find((p) => p.id === projectId) || null;
  }

  createProject(
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>,
    creatorId: string
  ): Project {
    const newId = `proj-${Date.now()}`;
    const slug = projectData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const newProject: Project = {
      ...projectData,
      id: newId,
      slug: slug || `project-${newId}`,
      archived: false,
      ownerId: creatorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newMember: ProjectMember = {
      id: `pm-${Date.now()}`,
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
      id: `act-${Date.now()}`,
      projectId: newId,
      userId: creatorId,
      action: 'project_created',
      details: `Created new project "${newProject.name}"`,
      createdAt: new Date().toISOString(),
    };

    this.saveDatabase({
      ...this.db,
      projects: [newProject, ...this.db.projects],
      projectMembers: [newMember, ...this.db.projectMembers],
      activityLogs: [newActivity, ...this.db.activityLogs],
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase
          .from('projects')
          .insert({
            id: newProject.id,
            name: newProject.name,
            slug: newProject.slug,
            summary: newProject.summary,
            problem_statement: newProject.problemStatement,
            description: newProject.description,
            goals: newProject.goals,
            features: newProject.features,
            status: newProject.status,
            priority: newProject.priority,
            tech_stack: newProject.techStack,
            repositories: newProject.repositories,
            links: newProject.links,
            start_date: newProject.startDate,
            target_date: newProject.targetDate,
            owner_id: creatorId,
          })
      )
        .then(() => logger.info('WorkspaceRepository', 'Project inserted to Supabase'))
        .catch((e: unknown) => logger.warn('WorkspaceRepository', 'Failed to insert project into Supabase', e));
    }

    logger.info('WorkspaceRepository', `Project created: ${newId}`, { name: newProject.name });
    return this.getProjectById(newId)!;
  }

  updateProject(projectId: string, updates: Partial<Project>, actorId: string): Project {
    const updatedProjects = this.db.projects.map((p) =>
      p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );

    const newActivity: ActivityEvent = {
      id: `act-${Date.now()}`,
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
      id: `pm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectId,
      userId,
      role,
      permissions,
      joinedAt: new Date().toISOString(),
    };

    const user = this.getProfileById(userId);
    const proj = this.getProjectById(projectId);

    const newActivity: ActivityEvent = {
      id: `act-${Date.now()}`,
      projectId,
      userId: actorId,
      action: 'member_added',
      details: `Added ${user?.fullName || 'member'} to project as ${role}`,
      createdAt: new Date().toISOString(),
    };

    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      recipientId: userId,
      type: 'invitation',
      title: 'Added to Project',
      body: `You were added to "${proj?.name || 'project'}" as ${role}.`,
      link: `/projects/${projectId}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

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
    return [...this.db.invitations];
  }

  createInvitation(
    email: string,
    role: UserRole,
    initialLabels: string[],
    assignedProjectIds: string[],
    expiresInDays: number,
    invitedBy: string
  ): Invitation {
    const token = `df_inv_${Math.random().toString(36).substr(2, 8)}${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const newInv: Invitation = {
      id: `inv-${Date.now()}`,
      email: email.trim().toLowerCase(),
      role,
      token,
      invitedBy,
      initialLabels,
      assignedProjectIds,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.saveDatabase({
      ...this.db,
      invitations: [newInv, ...this.db.invitations],
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('invitations').insert({
          id: newInv.id,
          email: newInv.email,
          role: newInv.role,
          token: newInv.token,
          invited_by: invitedBy,
          initial_labels: initialLabels,
          assigned_project_ids: assignedProjectIds,
          expires_at: newInv.expiresAt,
        })
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not save invitation in Supabase', e));
    }

    logger.info('WorkspaceRepository', `Created single-use invitation for ${email} with token ${token}`);
    return newInv;
  }

  redeemInvitation(token: string, fullName: string, expectedEmail?: string): UserProfile {
    const inv = this.db.invitations.find((i) => i.token === token);
    if (!inv) throw new Error('Invalid or unknown invitation token.');
    if (inv.acceptedAt) throw new Error('This invitation has already been redeemed.');
    if (new Date(inv.expiresAt) < new Date()) throw new Error('This invitation has expired.');
    if (expectedEmail && inv.email.toLowerCase() !== expectedEmail.trim().toLowerCase()) {
      throw new Error(`This invitation was issued to ${inv.email}. Please use the matching email address.`);
    }

    const newUserId = `user-${Date.now()}`;
    const newProfile: UserProfile = {
      id: newUserId,
      email: inv.email,
      fullName: fullName.trim(),
      role: inv.role,
      labels: inv.initialLabels || [],
      mfaEnabled: true,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    const updatedInvitations = this.db.invitations.map((i) =>
      i.token === token ? { ...i, acceptedAt: new Date().toISOString() } : i
    );

    const newProjectMembers: ProjectMember[] = (inv.assignedProjectIds || []).map((projId) => ({
      id: `pm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectId: projId,
      userId: newUserId,
      role: 'collaborator',
      permissions: {
        canManageTasks: true,
        canUploadDocs: true,
        canViewMetrics: true,
        canManageMembers: false,
      },
      joinedAt: new Date().toISOString(),
    }));

    this.saveDatabase({
      ...this.db,
      profiles: [...this.db.profiles, newProfile],
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
    const newId = `t-${Date.now()}`;
    const newTask: Task = {
      ...taskData,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const notifs = [...this.db.notifications];
    if (newTask.assigneeId && newTask.assigneeId !== actorId) {
      const proj = this.getProjectById(newTask.projectId);
      notifs.unshift({
        id: `notif-${Date.now()}`,
        recipientId: newTask.assigneeId,
        type: 'task_assigned',
        title: 'New Task Assigned',
        body: `You were assigned to "${newTask.title}" in ${proj?.name || 'project'}.`,
        link: `/projects/${newTask.projectId}?tab=tasks`,
        isRead: false,
        createdAt: new Date().toISOString(),
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
          assignee_id: newTask.assigneeId,
          due_date: newTask.dueDate,
          tags: newTask.tags,
        })
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync task to Supabase', e));
    }

    return { ...newTask, assignee: newTask.assigneeId ? this.getProfileById(newTask.assigneeId) : undefined };
  }

  updateTask(taskId: string, updates: Partial<Task>, actorId: string): Task {
    const updatedTasks = this.db.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );

    this.saveDatabase({
      ...this.db,
      tasks: updatedTasks,
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('tasks').update({
          status: updates.status,
          priority: updates.priority,
          assignee_id: updates.assigneeId,
          due_date: updates.dueDate,
          title: updates.title,
          description: updates.description,
        }).eq('id', taskId)
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
    const newId = `m-${Date.now()}`;
    const newMilestone: Milestone = {
      ...milestoneData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    this.saveDatabase({
      ...this.db,
      milestones: [...this.db.milestones, newMilestone],
    });
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
    const newId = `doc-${Date.now()}`;
    const newDoc: ProjectDocument = {
      ...docData,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveDatabase({
      ...this.db,
      documents: [newDoc, ...this.db.documents],
    });
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
    const newGrant: DocumentAccessGrant = {
      id: existing ? existing.id : `grant-${Date.now()}`,
      documentId,
      userId,
      status: 'pending',
      reason,
      requestedAt: new Date().toISOString(),
    };

    const doc = this.db.documents.find((d) => d.id === documentId);
    const user = this.getProfileById(userId);
    const superAdmin = this.db.profiles.find((p) => p.role === 'super_admin');

    const notifs = [...this.db.notifications];
    if (superAdmin) {
      notifs.unshift({
        id: `notif-${Date.now()}`,
        recipientId: superAdmin.id,
        type: 'doc_request',
        title: 'Restricted Document Access Request',
        body: `${user?.fullName || 'A member'} requested access to "${doc?.title || 'a restricted document'}".`,
        isRead: false,
        createdAt: new Date().toISOString(),
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

    const updatedGrants = this.db.documentGrants.map((g) =>
      g.id === grantId
        ? {
            ...g,
            status,
            reviewedBy: reviewerId,
            reviewedAt: new Date().toISOString(),
            grantedUntil,
            reviewerNotes,
          }
        : g
    );

    const doc = this.db.documents.find((d) => d.id === grant.documentId);
    const notifs = [...this.db.notifications];
    notifs.unshift({
      id: `notif-${Date.now()}`,
      recipientId: grant.userId,
      type: 'doc_request',
      title: `Document Access ${status === 'approved' ? 'Approved' : 'Declined'}`,
      body: `Your request for "${doc?.title || 'document'}" was ${status}.`,
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    this.saveDatabase({
      ...this.db,
      documentGrants: updatedGrants,
      notifications: notifs,
    });
  }

  // Suggestions Center
  getSuggestions(forUserId?: string): Suggestion[] {
    const user = forUserId ? this.getProfileById(forUserId) : undefined;
    const isSuperAdmin = user?.role === 'super_admin';

    let list = this.db.suggestions;
    if (forUserId && !isSuperAdmin) {
      list = list.filter((s) => s.submitterId === forUserId);
    }

    return list.map((s) => ({
      ...s,
      submitter: this.getProfileById(s.submitterId),
    }));
  }

  createSuggestion(data: Omit<Suggestion, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Suggestion {
    const newId = `sug-${Date.now()}`;
    const newSug: Suggestion = {
      ...data,
      id: newId,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const superAdmin = this.db.profiles.find((p) => p.role === 'super_admin');
    const submitter = this.getProfileById(data.submitterId);
    const notifs = [...this.db.notifications];
    if (superAdmin && superAdmin.id !== data.submitterId) {
      notifs.unshift({
        id: `notif-${Date.now()}`,
        recipientId: superAdmin.id,
        type: 'suggestion_update',
        title: 'New Member Suggestion',
        body: `${submitter?.fullName || 'A member'} submitted: "${newSug.title}"`,
        isRead: false,
        createdAt: new Date().toISOString(),
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
          project_id: newSug.projectId,
          submitter_id: newSug.submitterId,
          status: newSug.status,
        })
      ).catch((e: unknown) => logger.warn('WorkspaceRepository', 'Could not sync suggestion to Supabase', e));
    }

    return { ...newSug, submitter };
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

    const updated = this.db.suggestions.map((s) =>
      s.id === suggestionId
        ? {
            ...s,
            status,
            adminNotes: adminNotes !== undefined ? adminNotes : s.adminNotes,
            adminResponse: adminResponse !== undefined ? adminResponse : s.adminResponse,
            updatedAt: new Date().toISOString(),
          }
        : s
    );

    const notifs = [...this.db.notifications];
    if (sug.submitterId !== actorId) {
      notifs.unshift({
        id: `notif-${Date.now()}`,
        recipientId: sug.submitterId,
        type: 'suggestion_update',
        title: `Suggestion Status: ${status.replace('_', ' ').toUpperCase()}`,
        body: `"${sug.title}" is now marked as ${status}.${adminResponse ? ` Response: ${adminResponse}` : ''}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.saveDatabase({
      ...this.db,
      suggestions: updated,
      notifications: notifs,
    });
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

    return newTask;
  }

  // Announcements & Notifications
  getAnnouncements(): Announcement[] {
    return [...this.db.announcements];
  }

  broadcastAnnouncement(data: Omit<Announcement, 'id' | 'createdAt'>): Announcement {
    const newId = `anc-${Date.now()}`;
    const newAnc: Announcement = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
    };

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
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      recipientId: userId,
      type: 'announcement',
      title: `${data.priority === 'important' ? '[Important] ' : ''}${data.title}`,
      body: data.content.slice(0, 160),
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    this.saveDatabase({
      ...this.db,
      announcements: [newAnc, ...this.db.announcements],
      notifications: [...notifs, ...this.db.notifications],
    });

    return newAnc;
  }

  getNotifications(userId: string): AppNotification[] {
    return this.db.notifications.filter((n) => n.recipientId === userId);
  }

  markNotificationRead(notifId: string) {
    const updated = this.db.notifications.map((n) => (n.id === notifId ? { ...n, isRead: true } : n));
    this.saveDatabase({ ...this.db, notifications: updated });
  }

  markAllNotificationsRead(userId: string) {
    const updated = this.db.notifications.map((n) =>
      n.recipientId === userId ? { ...n, isRead: true } : n
    );
    this.saveDatabase({ ...this.db, notifications: updated });
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
    data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>,
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
