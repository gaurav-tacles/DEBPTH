-- ==============================================================================
-- DevForge Workspace: Normalized Database Schema & Row-Level Security (RLS)
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE user_workspace_role AS ENUM ('super_admin', 'member');
  CREATE TYPE project_member_role AS ENUM ('lead', 'maintainer', 'collaborator', 'viewer');
  CREATE TYPE project_status AS ENUM ('idea', 'planned', 'in_progress', 'completed');
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
  CREATE TYPE doc_access_status AS ENUM ('pending', 'approved', 'rejected');
  CREATE TYPE suggestion_category AS ENUM ('idea', 'feature', 'workflow', 'bug');
  CREATE TYPE suggestion_status AS ENUM ('submitted', 'under_review', 'accepted', 'planned', 'declined', 'implemented');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_workspace_role NOT NULL DEFAULT 'member',
  labels TEXT[] NOT NULL DEFAULT '{}',
  github_username TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_active_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_labels ON public.profiles USING GIN(labels);

-- 4. INVITATIONS TABLE (Expiring single-use invitation tokens)
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role user_workspace_role NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  initial_labels TEXT[] NOT NULL DEFAULT '{}',
  assigned_project_ids UUID[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);

-- 5. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT NOT NULL,
  problem_statement TEXT,
  description TEXT NOT NULL,
  goals TEXT[] NOT NULL DEFAULT '{}',
  features TEXT[] NOT NULL DEFAULT '{}',
  status project_status NOT NULL DEFAULT 'planned',
  priority task_priority NOT NULL DEFAULT 'medium',
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  repositories JSONB NOT NULL DEFAULT '[]'::jsonb,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date DATE,
  target_date DATE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON public.projects(archived);

-- 6. PROJECT MEMBERS TABLE (Independent project membership)
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role project_member_role NOT NULL DEFAULT 'collaborator',
  can_manage_tasks BOOLEAN NOT NULL DEFAULT TRUE,
  can_upload_docs BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_metrics BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_members BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user ON public.project_members(user_id);

-- 7. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  milestone_id UUID,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- 8. MILESTONES TABLE
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON public.milestones(project_id);

-- 9. DOCUMENTS TABLE (Supports restricted docs)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_restricted ON public.documents(is_restricted);

-- 10. DOCUMENT ACCESS GRANTS TABLE
CREATE TABLE IF NOT EXISTS public.document_access_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status doc_access_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  granted_until TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_grants_doc ON public.document_access_grants(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_grants_user ON public.document_access_grants(user_id);

-- 11. SUGGESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category suggestion_category NOT NULL DEFAULT 'feature',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  submitter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status suggestion_status NOT NULL DEFAULT 'submitted',
  admin_notes TEXT,
  admin_response TEXT,
  converted_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_submitter ON public.suggestions(submitter_id);

-- 12. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  target_type TEXT NOT NULL DEFAULT 'all',
  target_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read);

-- 14. ACTIVITY & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activity_project ON public.activity_logs(project_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper security function: is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper security function: has_project_access(project_id)
CREATE OR REPLACE FUNCTION public.has_project_access(proj_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = proj_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: Authenticated users can read directory; users can update own profile; super admin can manage all
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_super_admin());

-- Invitations: Super admin only can manage invitations; token lookup allowed for registration
CREATE POLICY invitations_admin ON public.invitations FOR ALL USING (public.is_super_admin());
CREATE POLICY invitations_read_token ON public.invitations FOR SELECT USING (true);

-- Projects: Super admin sees all; members only see projects they belong to
CREATE POLICY projects_select ON public.projects FOR SELECT USING (public.has_project_access(id));
CREATE POLICY projects_admin ON public.projects FOR ALL USING (public.is_super_admin());

-- Project Members: Visible if member of project or super admin
CREATE POLICY pm_select ON public.project_members FOR SELECT USING (public.has_project_access(project_id));
CREATE POLICY pm_admin ON public.project_members FOR ALL USING (public.is_super_admin());

-- Tasks: Project members can view and update tasks
CREATE POLICY tasks_select ON public.tasks FOR SELECT USING (public.has_project_access(project_id));
CREATE POLICY tasks_modify ON public.tasks FOR ALL USING (public.has_project_access(project_id));

-- Documents:
-- Unrestricted docs visible to project members.
-- Restricted docs visible ONLY to super admin OR members with active approved access grant!
CREATE POLICY documents_select ON public.documents FOR SELECT USING (
  public.has_project_access(project_id) AND (
    NOT is_restricted
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.document_access_grants
      WHERE document_id = public.documents.id
        AND user_id = auth.uid()
        AND status = 'approved'
        AND (granted_until IS NULL OR granted_until > now())
    )
  )
);

CREATE POLICY documents_insert ON public.documents FOR INSERT WITH CHECK (
  public.has_project_access(project_id) AND (NOT is_restricted OR public.is_super_admin())
);

-- Suggestions: All authenticated members can view their own and create; super admin views and manages all
CREATE POLICY suggestions_select ON public.suggestions FOR SELECT USING (submitter_id = auth.uid() OR public.is_super_admin());
CREATE POLICY suggestions_insert ON public.suggestions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY suggestions_admin_update ON public.suggestions FOR UPDATE USING (public.is_super_admin());

-- Notifications: Only recipient can view or mark read
CREATE POLICY notifications_recipient ON public.notifications FOR ALL USING (recipient_id = auth.uid());
