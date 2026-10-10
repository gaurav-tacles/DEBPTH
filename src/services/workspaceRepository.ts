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
} from '../types';
import { logger } from '../lib/logger';

const STORAGE_KEY_DATA = 'project_apex_workspace_v2';

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
}

function getInitialDatabase(): WorkspaceDatabase {
  const superAdminId = 'user-superadmin-01';
  const sarahId = 'user-sarah-02';
  const marcusId = 'user-marcus-03';
  const alexId = 'user-alex-04';

  const profiles: UserProfile[] = [
    {
      id: superAdminId,
      email: 'gauravp18189@gmail.com',
      fullName: 'Gaurav P.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'super_admin',
      labels: ['Architecture', 'Security', 'Founding Member'],
      githubUsername: 'gaurav-dev',
      mfaEnabled: true,
      createdAt: '2026-01-15T09:00:00Z',
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: sarahId,
      email: 'sarah.chen@devforge.local',
      fullName: 'Sarah Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: 'member',
      labels: ['Frontend', 'UI/UX', 'Design System'],
      githubUsername: 'schen-ui1',
      mfaEnabled: true,
      createdAt: '2026-02-01T10:30:00Z',
      lastActiveAt: '2026-10-09T18:40:00Z',
    },
    {
      id: marcusId,
      email: 'marcus.v@devforge.local',
      fullName: 'Marcus Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: 'member',
      labels: ['Backend', 'PostgreSQL', 'DevOps'],
      githubUsername: 'marcus-sys',
      mfaEnabled: false,
      createdAt: '2026-02-10T14:15:00Z',
      lastActiveAt: '2026-10-10T07:15:00Z',
    },
    {
      id: alexId,
      email: 'alex.r@devforge.local',
      fullName: 'Alex Rivera',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      role: 'member',
      labels: ['Mobile', 'PWA', 'Android'],
      githubUsername: 'rivera-mobile',
      mfaEnabled: true,
      createdAt: '2026-03-01T11:00:00Z',
      lastActiveAt: '2026-10-08T15:20:00Z',
    },
  ];

  const projApexId = 'proj-apex-01';
  const projValkyrieId = 'proj-valkyrie-02';
  const projChronosId = 'proj-chronos-03';
  const projNebulaId = 'proj-nebula-04';

  const projects: Project[] = [
    {
      id: projApexId,
      name: 'Project Apex: Core Microservices Gateway',
      slug: 'project-apex',
      summary: 'High-throughput Rust & TypeScript API gateway with dynamic rate limiting and token validation.',
      problemStatement: 'Legacy monolithic proxy was bottlenecking at 14,000 req/sec with high latency jitter.',
      description: 'Unified edge routing layer handling cross-cutting concerns: OAuth introspection, schema validation, telemetry propagation, and zero-downtime canary deployment.',
      goals: ['Reduce p99 latency to < 5ms', 'Enforce mTLS between services', 'Automated token caching'],
      features: ['Rust reverse proxy core', 'Distributed token bucket limiter', 'OpenTelemetry exporter'],
      status: 'in_progress',
      priority: 'high',
      techStack: ['Rust', 'TypeScript', 'Docker', 'Redis', 'PostgreSQL'],
      repositories: [
        { name: 'torvalds/linux', branch: 'master', description: 'Core routing engine (Linux reference repo)', isPrivate: false },
        { name: 'expressjs/express', branch: 'master', description: 'Node management API', isPrivate: false },
      ],
      links: [
        { title: 'Architecture RFC #14', url: 'https://github.com' },
        { title: 'Grafana Staging Dashboard', url: 'https://grafana.com' },
      ],
      startDate: '2026-03-01',
      targetDate: '2026-11-30',
      ownerId: superAdminId,
      archived: false,
      createdAt: '2026-03-01T08:00:00Z',
      updatedAt: '2026-10-09T14:00:00Z',
    },
    {
      id: projValkyrieId,
      name: 'Valkyrie: Cross-Platform Edge Client',
      slug: 'valkyrie-client',
      summary: 'Touch-optimized Progressive Web Application with offline sync engine for mobile and desktop.',
      problemStatement: 'Field engineers require offline access to telemetry and logs during remote deployments.',
      description: 'PWA built with React 19, IndexedDB offline queues, biometric auth, and instantaneous background synchronization.',
      goals: ['100% offline functionality for key screens', 'Fast install prompt on Android/iOS', 'Sub-second search'],
      features: ['IndexedDB cache engine', 'Touch-friendly swipe cards', 'Encrypted local key storage'],
      status: 'in_progress',
      priority: 'medium',
      techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Service Worker'],
      repositories: [
        { name: 'vitejs/vite', branch: 'main', description: 'Bundling infrastructure', isPrivate: false },
      ],
      links: [
        { title: 'Figma UI Specifications', url: 'https://figma.com' },
      ],
      startDate: '2026-04-10',
      targetDate: '2026-12-15',
      ownerId: superAdminId,
      archived: false,
      createdAt: '2026-04-10T10:00:00Z',
      updatedAt: '2026-10-08T16:30:00Z',
    },
    {
      id: projChronosId,
      name: 'Chronos: Distributed Task Scheduler',
      slug: 'chronos-scheduler',
      summary: 'Confidential solo initiative: distributed cron coordinator with deterministic consensus.',
      problemStatement: 'Multi-datacenter job duplication during network partitions.',
      description: 'Lightweight Raft-based scheduling cluster orchestrating distributed jobs with millisecond precision. Admin solo project.',
      goals: ['Zero job duplication guarantee', 'Leader election < 300ms', 'Minimal memory footprint'],
      features: ['Raft consensus module', 'Heartbeat health monitor', 'Persistent write-ahead log'],
      status: 'planned',
      priority: 'urgent',
      techStack: ['Go', 'gRPC', 'PostgreSQL', 'Prometheus'],
      repositories: [],
      links: [],
      startDate: '2026-09-01',
      targetDate: '2027-01-31',
      ownerId: superAdminId,
      archived: false,
      createdAt: '2026-09-01T12:00:00Z',
      updatedAt: '2026-10-05T09:00:00Z',
    },
    {
      id: projNebulaId,
      name: 'Nebula: In-Memory Vector Search Engine',
      slug: 'nebula-vector',
      summary: 'Experimental HNSW graph indexer for localized embedding search on edge servers.',
      description: 'Research project exploring quantization and SIMD vector distance calculations on low-power ARM servers.',
      goals: ['Evaluate 8-bit scalar quantization', 'Benchmark memory footprint'],
      features: ['Cosine similarity AVX2', 'HNSW graph indexing'],
      status: 'idea',
      priority: 'low',
      techStack: ['C++', 'Python', 'SIMD', 'NumPy'],
      repositories: [],
      links: [],
      startDate: '2026-10-01',
      targetDate: '2027-03-01',
      ownerId: superAdminId,
      archived: false,
      createdAt: '2026-10-01T15:00:00Z',
      updatedAt: '2026-10-02T11:00:00Z',
    },
  ];

  // Project Memberships: Independent for every project!
  // Apex has SuperAdmin and Marcus
  // Valkyrie has SuperAdmin, Sarah, and Alex
  // Chronos has ONLY SuperAdmin (solo project!)
  // Nebula has SuperAdmin and Marcus
  const projectMembers: ProjectMember[] = [
    // Apex
    {
      id: 'pm-01',
      projectId: projApexId,
      userId: superAdminId,
      role: 'lead',
      permissions: { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: true },
      joinedAt: '2026-03-01T08:00:00Z',
    },
    {
      id: 'pm-02',
      projectId: projApexId,
      userId: marcusId,
      role: 'maintainer',
      permissions: { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: false },
      joinedAt: '2026-03-05T10:00:00Z',
    },
    // Valkyrie
    {
      id: 'pm-03',
      projectId: projValkyrieId,
      userId: superAdminId,
      role: 'lead',
      permissions: { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: true },
      joinedAt: '2026-04-10T10:00:00Z',
    },
    {
      id: 'pm-04',
      projectId: projValkyrieId,
      userId: sarahId,
      role: 'collaborator',
      permissions: { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: false },
      joinedAt: '2026-04-12T11:00:00Z',
    },
    {
      id: 'pm-05',
      projectId: projValkyrieId,
      userId: alexId,
      role: 'collaborator',
      permissions: { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: false },
      joinedAt: '2026-04-15T09:30:00Z',
    },
    // Chronos (Solo project for SuperAdmin!)
    {
      id: 'pm-06',
      projectId: projChronosId,
      userId: superAdminId,
      role: 'lead',
      permissions: { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: true },
      joinedAt: '2026-09-01T12:00:00Z',
    },
    // Nebula
    {
      id: 'pm-07',
      projectId: projNebulaId,
      userId: superAdminId,
      role: 'lead',
      permissions: { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: true },
      joinedAt: '2026-10-01T15:00:00Z',
    },
    {
      id: 'pm-08',
      projectId: projNebulaId,
      userId: marcusId,
      role: 'viewer',
      permissions: { canManageTasks: false, canUploadDocs: false, canViewMetrics: true, canManageMembers: false },
      joinedAt: '2026-10-02T10:00:00Z',
    },
  ];

  const milestones: Milestone[] = [
    {
      id: 'm-01',
      projectId: projApexId,
      title: 'v1.0-rc1 Gateway Stabilization',
      description: 'Complete token validation and reach 10k req/sec benchmark.',
      dueDate: '2026-10-25',
      status: 'open',
      createdAt: '2026-09-10T10:00:00Z',
    },
    {
      id: 'm-02',
      projectId: projValkyrieId,
      title: 'PWA Offline Storage Beta',
      description: 'Ship IndexedDB queue and touch swipe gestures.',
      dueDate: '2026-11-05',
      status: 'open',
      createdAt: '2026-09-15T12:00:00Z',
    },
  ];

  const tasks: Task[] = [
    {
      id: 't-01',
      projectId: projApexId,
      title: 'Implement token bucket rate limiter in Rust core',
      description: 'Must handle multi-tenant quotas with Redis cluster fallback.',
      status: 'in_progress',
      priority: 'high',
      assigneeId: marcusId,
      dueDate: '2026-10-18',
      milestoneId: 'm-01',
      tags: ['Rust', 'Performance'],
      createdAt: '2026-10-02T10:00:00Z',
      updatedAt: '2026-10-09T11:00:00Z',
    },
    {
      id: 't-02',
      projectId: projApexId,
      title: 'Configure mTLS mutual TLS cert rotation',
      description: 'Ensure automated Let’s Encrypt / internal CA certificate exchange.',
      status: 'todo',
      priority: 'urgent',
      assigneeId: superAdminId,
      dueDate: '2026-10-22',
      milestoneId: 'm-01',
      tags: ['Security', 'mTLS'],
      createdAt: '2026-10-05T09:00:00Z',
      updatedAt: '2026-10-05T09:00:00Z',
    },
    {
      id: 't-03',
      projectId: projApexId,
      title: 'Audit OpenTelemetry trace propagation headers',
      description: 'Verify W3C tracecontext format across async boundaries.',
      status: 'done',
      priority: 'medium',
      assigneeId: marcusId,
      dueDate: '2026-10-08',
      milestoneId: 'm-01',
      tags: ['Observability'],
      createdAt: '2026-09-28T14:00:00Z',
      updatedAt: '2026-10-08T17:00:00Z',
    },
    {
      id: 't-04',
      projectId: projValkyrieId,
      title: 'Optimize mobile bottom sheet animations for Android',
      description: 'Ensure 60fps gesture dragging without dropped frames.',
      status: 'in_progress',
      priority: 'medium',
      assigneeId: sarahId,
      dueDate: '2026-10-20',
      milestoneId: 'm-02',
      tags: ['Mobile', 'UI'],
      createdAt: '2026-10-06T11:00:00Z',
      updatedAt: '2026-10-09T15:00:00Z',
    },
    {
      id: 't-05',
      projectId: projValkyrieId,
      title: 'Implement Service Worker cache-first runtime caching',
      description: 'Cache static assets and API metadata with TTL expiration.',
      status: 'todo',
      priority: 'high',
      assigneeId: alexId,
      dueDate: '2026-10-24',
      milestoneId: 'm-02',
      tags: ['PWA', 'Offline'],
      createdAt: '2026-10-07T13:00:00Z',
      updatedAt: '2026-10-07T13:00:00Z',
    },
    {
      id: 't-06',
      projectId: projChronosId,
      title: 'Draft Raft leader election protocol specification',
      description: 'Define heartbeats, candidate election timeout, and log match invariants.',
      status: 'in_progress',
      priority: 'urgent',
      assigneeId: superAdminId,
      dueDate: '2026-10-30',
      tags: ['Consensus', 'Spec'],
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-08T12:00:00Z',
    },
  ];

  const documents: ProjectDocument[] = [
    {
      id: 'doc-01',
      projectId: projApexId,
      title: 'Architecture Blueprint & Threat Model v2',
      fileName: 'apex-gateway-architecture-v2.pdf',
      fileSize: 2450000,
      mimeType: 'application/pdf',
      storagePath: 'projects/proj-apex-01/docs/apex-gateway-architecture-v2.pdf',
      isRestricted: false,
      uploadedBy: superAdminId,
      createdAt: '2026-09-12T10:00:00Z',
      updatedAt: '2026-09-12T10:00:00Z',
    },
    {
      id: 'doc-02',
      projectId: projApexId,
      title: 'Internal Penetration Testing Report & Key Material',
      fileName: 'pen-test-audit-q3-confidential.pdf',
      fileSize: 4890000,
      mimeType: 'application/pdf',
      storagePath: 'projects/proj-apex-01/restricted/pen-test-audit-q3-confidential.pdf',
      isRestricted: true, // RESTRICTED: Requires Admin access or approved grant!
      uploadedBy: superAdminId,
      createdAt: '2026-09-20T14:30:00Z',
      updatedAt: '2026-09-20T14:30:00Z',
    },
    {
      id: 'doc-03',
      projectId: projValkyrieId,
      title: 'Mobile PWA Interaction Specs & Design Tokens',
      fileName: 'valkyrie-design-system.json',
      fileSize: 450000,
      mimeType: 'application/json',
      storagePath: 'projects/proj-valkyrie-02/docs/valkyrie-design-system.json',
      isRestricted: false,
      uploadedBy: sarahId,
      createdAt: '2026-09-25T09:15:00Z',
      updatedAt: '2026-09-25T09:15:00Z',
    },
  ];

  const documentGrants: DocumentAccessGrant[] = [
    {
      id: 'grant-01',
      documentId: 'doc-02',
      userId: marcusId,
      status: 'approved',
      reason: 'Needed to fix vulnerability findings identified in section 4.2 of the audit.',
      grantedUntil: '2026-11-01T00:00:00Z',
      requestedAt: '2026-09-22T08:00:00Z',
      reviewedBy: superAdminId,
      reviewedAt: '2026-09-22T09:00:00Z',
      reviewerNotes: 'Approved for remediation period until Nov 1st.',
    },
  ];

  const suggestions: Suggestion[] = [
    {
      id: 'sug-01',
      title: 'Add automatic Redis failover health ping in Gateway',
      description: 'When Redis sentinel triggers failover, the gateway should reconnect immediately without dropping in-flight sockets.',
      category: 'feature',
      projectId: projApexId,
      submitterId: marcusId,
      status: 'under_review',
      adminNotes: 'High priority for production cluster stability.',
      adminResponse: 'Under review by Gaurav. We will benchmark reconnect timeout.',
      attachmentUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
      attachmentName: 'sentinel-failover-benchmark.png',
      createdAt: '2026-10-04T11:20:00Z',
      updatedAt: '2026-10-06T14:00:00Z',
    },
    {
      id: 'sug-02',
      title: 'Support haptic feedback on touch gestures in mobile PWA',
      description: 'Use Navigator.vibrate API when swiping cards or confirming task status changes on Android.',
      category: 'idea',
      projectId: projValkyrieId,
      submitterId: alexId,
      status: 'accepted',
      adminNotes: 'Accepted for v1.2 mobile release.',
      adminResponse: 'Great idea Alex, converting this into an active task for Valkyrie.',
      attachmentUrl: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?w=800&auto=format&fit=crop&q=80',
      attachmentName: 'haptics-interaction-flow.png',
      createdAt: '2026-10-02T15:00:00Z',
      updatedAt: '2026-10-08T10:00:00Z',
    },
    {
      id: 'sug-03',
      title: 'Memory leak in connection pooling under high concurrency',
      description: 'Observed 12MB/hour memory growth in the connection pool when socket idle timeout is set under 10 seconds. Repro steps and pprof profile attached.',
      category: 'bug',
      projectId: projApexId,
      submitterId: marcusId,
      status: 'submitted',
      attachmentUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
      attachmentName: 'pprof-heap-profile.png',
      createdAt: '2026-10-09T08:30:00Z',
      updatedAt: '2026-10-09T08:30:00Z',
    },
  ];

  const announcements: Announcement[] = [
    {
      id: 'anc-01',
      title: 'Infrastructure Maintenance & Database Schema Freeze',
      content: 'Database migrations for PostgreSQL 17 upgrade will occur this Saturday at 02:00 UTC. Schema changes are temporarily locked.',
      priority: 'important',
      targetType: 'all',
      createdBy: superAdminId,
      createdAt: '2026-10-08T09:00:00Z',
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'notif-01',
      recipientId: superAdminId,
      type: 'suggestion_update',
      title: 'New Suggestion Submitted',
      body: 'Marcus Vance submitted a feature suggestion for Project Apex.',
      isRead: false,
      createdAt: '2026-10-04T11:20:00Z',
    },
    {
      id: 'notif-02',
      recipientId: superAdminId,
      type: 'task_assigned',
      title: 'Task Assigned',
      body: 'You are assigned to "Configure mTLS mutual TLS cert rotation".',
      isRead: true,
      createdAt: '2026-10-05T09:00:00Z',
    },
    {
      id: 'notif-03',
      recipientId: marcusId,
      type: 'doc_request',
      title: 'Document Access Granted',
      body: 'Access to "Internal Penetration Testing Report" was approved by Gaurav P.',
      isRead: false,
      createdAt: '2026-09-22T09:00:00Z',
    },
  ];

  const activityLogs: ActivityEvent[] = [
    {
      id: 'act-01',
      projectId: projApexId,
      userId: superAdminId,
      action: 'project_created',
      details: 'Created Project Apex: Core Microservices Gateway with independent membership.',
      createdAt: '2026-03-01T08:00:00Z',
    },
    {
      id: 'act-02',
      projectId: projApexId,
      userId: marcusId,
      action: 'task_updated',
      details: 'Updated status of "Implement token bucket rate limiter" to in_progress.',
      createdAt: '2026-10-09T11:00:00Z',
    },
  ];

  const invitations: Invitation[] = [
    {
      id: 'inv-01',
      email: 'security.lead@devforge.local',
      role: 'member',
      token: 'df_inv_7f4a9b2c8e1d',
      invitedBy: superAdminId,
      initialLabels: ['Security', 'Auditor'],
      assignedProjectIds: [projApexId],
      expiresAt: '2026-10-25T00:00:00Z',
      createdAt: '2026-10-01T10:00:00Z',
    },
  ];

  return {
    profiles,
    projects,
    projectMembers,
    invitations,
    tasks,
    milestones,
    documents,
    documentGrants,
    suggestions,
    announcements,
    notifications,
    activityLogs,
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
          return parsed;
        }
      }
    } catch (e) {
      logger.warn('WorkspaceRepository', 'Failed to parse stored workspace, resetting to defaults', e);
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
      logger.error('WorkspaceRepository', 'Failed to save database to localStorage', e);
    }
  }

  // Profiles & Auth
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
    logger.info('WorkspaceRepository', `Profile updated: ${id}`);
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

  createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>, creatorId: string): Project {
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

    // Owner is automatically added as Lead
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
      details: `Updated project details`,
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
    // Check if already a member
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

    logger.info('WorkspaceRepository', `Added member ${userId} to project ${projectId} with role ${role}`);
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

    const member = this.db.projectMembers.find((pm) => pm.id === memberId);
    if (member) {
      const user = this.getProfileById(member.userId);
      const newActivity: ActivityEvent = {
        id: `act-${Date.now()}`,
        projectId: member.projectId,
        userId: actorId,
        action: 'member_updated',
        details: `Updated permissions and role for ${user?.fullName || 'member'} to ${role}`,
        createdAt: new Date().toISOString(),
      };
      this.saveDatabase({
        ...this.db,
        projectMembers: updated,
        activityLogs: [newActivity, ...this.db.activityLogs],
      });
    }

    const target = updated.find((pm) => pm.id === memberId)!;
    return { ...target, user: this.getProfileById(target.userId) };
  }

  removeProjectMember(memberId: string, actorId: string) {
    const member = this.db.projectMembers.find((pm) => pm.id === memberId);
    if (!member) return;

    const user = this.getProfileById(member.userId);
    const newActivity: ActivityEvent = {
      id: `act-${Date.now()}`,
      projectId: member.projectId,
      userId: actorId,
      action: 'member_removed',
      details: `Removed ${user?.fullName || 'member'} from project team`,
      createdAt: new Date().toISOString(),
    };

    this.saveDatabase({
      ...this.db,
      projectMembers: this.db.projectMembers.filter((pm) => pm.id !== memberId),
      activityLogs: [newActivity, ...this.db.activityLogs],
    });
    logger.info('WorkspaceRepository', `Removed member ${memberId}`);
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

    logger.info('WorkspaceRepository', `Created invitation for ${email} with token ${token}`);
    return newInv;
  }

  redeemInvitation(token: string, fullName: string, passwordHash?: string): UserProfile {
    const inv = this.db.invitations.find((i) => i.token === token);
    if (!inv) throw new Error('Invalid invitation token');
    if (inv.acceptedAt) throw new Error('This invitation has already been redeemed');
    if (new Date(inv.expiresAt) < new Date()) throw new Error('This invitation has expired');

    // Create user profile
    const newUserId = `user-${Date.now()}`;
    const newProfile: UserProfile = {
      id: newUserId,
      email: inv.email,
      fullName: fullName.trim(),
      avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      role: inv.role,
      labels: inv.initialLabels || [],
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    // Mark invitation redeemed
    const updatedInvitations = this.db.invitations.map((i) =>
      i.token === token ? { ...i, acceptedAt: new Date().toISOString() } : i
    );

    // Assign to projects specified in invitation
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

    // Notify Super Admin
    const superAdmin = this.db.profiles.find((p) => p.role === 'super_admin');
    const notifs = [...this.db.notifications];
    if (superAdmin) {
      notifs.unshift({
        id: `notif-${Date.now()}`,
        recipientId: superAdmin.id,
        type: 'invitation',
        title: 'Invitation Accepted',
        body: `${fullName} (${inv.email}) has joined the workspace.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.saveDatabase({
      ...this.db,
      profiles: [...this.db.profiles, newProfile],
      invitations: updatedInvitations,
      projectMembers: [...this.db.projectMembers, ...newProjectMembers],
      notifications: notifs,
    });

    logger.info('WorkspaceRepository', `Redeemed invitation for ${inv.email}, created profile ${newUserId}`);
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

    logger.info('WorkspaceRepository', `Created task: ${newId}`);
    return { ...newTask, assignee: newTask.assigneeId ? this.getProfileById(newTask.assigneeId) : undefined };
  }

  updateTask(taskId: string, updates: Partial<Task>, actorId: string): Task {
    const oldTask = this.db.tasks.find((t) => t.id === taskId);
    const updatedTasks = this.db.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );

    const notifs = [...this.db.notifications];
    // Check if assignee changed
    if (updates.assigneeId && updates.assigneeId !== oldTask?.assigneeId && updates.assigneeId !== actorId) {
      const proj = oldTask ? this.getProjectById(oldTask.projectId) : null;
      notifs.unshift({
        id: `notif-${Date.now()}`,
        recipientId: updates.assigneeId,
        type: 'task_assigned',
        title: 'Task Reassigned to You',
        body: `You were assigned to "${oldTask?.title || 'task'}" in ${proj?.name || 'project'}.`,
        link: oldTask ? `/projects/${oldTask.projectId}?tab=tasks` : undefined,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.saveDatabase({
      ...this.db,
      tasks: updatedTasks,
      notifications: notifs,
    });

    const target = updatedTasks.find((t) => t.id === taskId)!;
    return { ...target, assignee: target.assigneeId ? this.getProfileById(target.assigneeId) : undefined };
  }

  deleteTask(taskId: string) {
    this.saveDatabase({
      ...this.db,
      tasks: this.db.tasks.filter((t) => t.id !== taskId),
    });
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

  // Documents & Access Workflow
  getDocuments(projectId: string, forUserId: string): ProjectDocument[] {
    const user = this.getProfileById(forUserId);
    const isSuperAdmin = user?.role === 'super_admin';

    // Fetch approved grants for this user
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

  getAllProjectDocumentsMetadata(projectId: string): { doc: ProjectDocument; canAccess: boolean; hasPendingRequest: boolean }[] {
    // Shows all documents in the project library so members know restricted docs exist and can request access!
    return [];
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

  reviewDocumentAccess(grantId: string, status: 'approved' | 'rejected', reviewerId: string, grantedUntil?: string, reviewerNotes?: string) {
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
      // Member only sees their own suggestions
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

    // Update suggestion status to accepted / planned
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

    // Determine targeted recipient IDs
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
      title: `${data.priority === 'important' ? '🚨 [Important] ' : ''}${data.title}`,
      body: data.content.slice(0, 160),
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    this.saveDatabase({
      ...this.db,
      announcements: [newAnc, ...this.db.announcements],
      notifications: [...notifs, ...this.db.notifications],
    });

    logger.info('WorkspaceRepository', `Broadcasted announcement: ${newAnc.title} to ${recipientIds.length} members`);
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

  // Activity Logs
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

  // Reset or reseed
  resetToDefaults() {
    const initial = getInitialDatabase();
    this.saveDatabase(initial);
    logger.info('WorkspaceRepository', 'Reset workspace database to defaults');
    return initial;
  }
}

export const workspaceRepo = new WorkspaceRepository();
