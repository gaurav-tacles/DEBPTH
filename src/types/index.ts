export type UserRole = 'super_admin' | 'member';

export type ProjectRole = 'lead' | 'maintainer' | 'collaborator' | 'viewer';

export type ProjectStatus = 'idea' | 'planned' | 'in_progress' | 'completed';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  role: UserRole;
  labels: string[]; // Custom labels e.g. ['Backend', 'Security', 'Frontend', 'DevOps']
  githubUsername?: string;
  mfaEnabled: boolean;
  createdAt: string;
  lastActiveAt?: string;
}

export interface ProjectPermission {
  canManageTasks: boolean;
  canUploadDocs: boolean;
  canViewMetrics: boolean;
  canManageMembers: boolean;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  permissions: ProjectPermission;
  joinedAt: string;
  user?: UserProfile;
}

export interface ProjectRepository {
  name: string; // e.g. "owner/repo"
  branch: string;
  description?: string;
  isPrivate?: boolean;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  summary: string;
  problemStatement?: string;
  description: string;
  goals: string[];
  features: string[];
  status: ProjectStatus;
  priority: Priority;
  techStack: string[];
  repositories: ProjectRepository[];
  links: { title: string; url: string }[];
  startDate?: string;
  targetDate?: string;
  ownerId: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed / joined
  members?: ProjectMember[];
  owner?: UserProfile;
  taskCount?: { total: number; done: number };
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  token?: string; // Only available immediately upon creation to copy/send; not stored in plaintext in DB
  tokenHash?: string; // SHA-256 hash stored in DB
  status?: InvitationStatus;
  invitedBy: string;
  initialLabels: string[];
  assignedProjectIds: string[];
  invitedProjectRole?: ProjectRole;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: Priority;
  assigneeId?: string;
  assignee?: UserProfile;
  dueDate?: string;
  milestoneId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: 'open' | 'completed';
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  isRestricted: boolean;
  uploadedBy: string;
  uploader?: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentAccessGrant {
  id: string;
  documentId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  grantedUntil?: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerNotes?: string;
  user?: UserProfile;
  document?: ProjectDocument;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: 'idea' | 'feature' | 'workflow' | 'bug';
  projectId?: string;
  submitterId: string;
  submitter?: UserProfile;
  status: 'submitted' | 'under_review' | 'accepted' | 'planned' | 'declined' | 'implemented';
  adminNotes?: string;
  adminResponse?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  convertedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important';
  targetType: 'all' | 'project' | 'individuals' | 'labels';
  targetMeta?: {
    projectId?: string;
    userIds?: string[];
    labels?: string[];
  };
  createdBy: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  type: 'task_assigned' | 'deadline' | 'invitation' | 'suggestion_update' | 'doc_request' | 'announcement';
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  projectId?: string;
  userId: string;
  user?: UserProfile;
  action: string;
  details: string;
  createdAt: string;
}

export type IdeaCategory = 'product' | 'startup' | 'feature' | 'architecture' | 'note' | 'random';
export type IdeaPriority = 'low' | 'medium' | 'high' | 'urgent';
export type IdeaStatus = 'inbox' | 'exploring' | 'validated' | 'archived';

export interface Idea {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: IdeaCategory;
  priority: IdeaPriority;
  status: IdeaStatus;
  tags: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

