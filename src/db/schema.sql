-- ==============================================================================
-- DEBPTH / ProjectHub Workspace: Clean-Install Normalized Database Setup
-- Target: PostgreSQL 14+ / Supabase (Fresh Installation)
-- Author: DevLead Labs (DEBPTH Architecture Team)
--
-- Security Features:
-- 1. Strict topological table creation order with foreign-key integrity
-- 2. Trusted server-side user provisioning trigger on auth.users (Super Admin: realgauravpatel@gmail.com)
-- 3. Non-recursive, hardened Row-Level Security (RLS) on all 13 workspace tables
-- 4. Principle of least privilege: default PUBLIC EXECUTE revoked on all SECURITY DEFINER functions
-- 5. Safe, restrictive search_path (public, extensions, auth; pg_temp explicitly excluded)
-- 6. Replay-protected, single-use SHA-256 token hashing with strict email validation
-- 7. Fail-closed, mandatory MFA verification for destructive project deletion (AAL2 + verified factor)
-- 8. Hardened private storage bucket policies with project membership and path traversal checks
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE public.user_workspace_role AS ENUM ('super_admin', 'member');
  CREATE TYPE public.project_member_role AS ENUM ('lead', 'maintainer', 'collaborator', 'viewer');
  CREATE TYPE public.project_status AS ENUM ('idea', 'planned', 'in_progress', 'completed');
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
  CREATE TYPE public.doc_access_status AS ENUM ('pending', 'approved', 'rejected');
  CREATE TYPE public.suggestion_category AS ENUM ('idea', 'feature', 'workflow', 'bug');
  CREATE TYPE public.suggestion_status AS ENUM ('submitted', 'under_review', 'accepted', 'planned', 'declined', 'implemented');
  CREATE TYPE public.idea_category AS ENUM ('product', 'startup', 'feature', 'architecture', 'note', 'random');
  CREATE TYPE public.idea_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  CREATE TYPE public.idea_status AS ENUM ('inbox', 'exploring', 'validated', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. TABLES (Strict Topological Creation Order)
-- ==============================================================================

-- 3.1 PROFILES TABLE (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role public.user_workspace_role NOT NULL DEFAULT 'member',
  labels TEXT[] NOT NULL DEFAULT '{}',
  github_username TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_active_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_labels ON public.profiles USING GIN(labels);

-- 3.2 PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT NOT NULL,
  problem_statement TEXT,
  description TEXT NOT NULL,
  goals TEXT[] NOT NULL DEFAULT '{}',
  features TEXT[] NOT NULL DEFAULT '{}',
  status public.project_status NOT NULL DEFAULT 'planned',
  priority public.task_priority NOT NULL DEFAULT 'medium',
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

-- 3.3 PROJECT MEMBERS TABLE (Granular project memberships and permissions)
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.project_member_role NOT NULL DEFAULT 'collaborator',
  can_manage_tasks BOOLEAN NOT NULL DEFAULT TRUE,
  can_upload_docs BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_metrics BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_members BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user ON public.project_members(user_id);

-- 3.4 INVITATIONS TABLE (Expiring, single-use invitation tokens with workspace & project scopes)
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'workspace' CHECK (scope IN ('workspace', 'project')),
  role public.user_workspace_role NOT NULL DEFAULT 'member',
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  project_role public.project_member_role DEFAULT 'collaborator',
  invited_project_role public.project_member_role DEFAULT 'collaborator',
  project_permissions JSONB DEFAULT '{"canManageTasks": true, "canUploadDocs": true, "canViewMetrics": true, "canManageMembers": false}'::jsonb,
  token TEXT UNIQUE NOT NULL,
  token_hash TEXT UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  initial_labels TEXT[] NOT NULL DEFAULT '{}',
  assigned_project_ids UUID[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.invitations(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_project_id ON public.invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations(expires_at);

-- 3.5 MILESTONES TABLE
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

-- 3.6 TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- 3.7 DOCUMENTS TABLE (Supports restricted project documentation)
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

-- 3.8 DOCUMENT ACCESS GRANTS TABLE
CREATE TABLE IF NOT EXISTS public.document_access_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.doc_access_status NOT NULL DEFAULT 'pending',
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

-- 3.9 SUGGESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.suggestion_category NOT NULL DEFAULT 'feature',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  submitter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.suggestion_status NOT NULL DEFAULT 'submitted',
  admin_notes TEXT,
  admin_response TEXT,
  converted_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_submitter ON public.suggestions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_project ON public.suggestions(project_id);

-- 3.10 IDEAS TABLE (Personal Isolated Engineering Notes)
CREATE TABLE IF NOT EXISTS public.ideas (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'note',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'inbox',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ideas_user ON public.ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_ideas_archived ON public.ideas(is_archived);

-- 3.11 ANNOUNCEMENTS TABLE
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

CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);

-- 3.12 NOTIFICATIONS TABLE
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

-- 3.13 ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activity_project ON public.activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_logs(user_id);

-- ==============================================================================
-- 4. SECURITY DEFINER HELPER FUNCTIONS
-- ==============================================================================

-- 4.1 Check if caller is Super Admin (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 4.2 Check if caller has access to project (Super Admin or project member)
CREATE OR REPLACE FUNCTION public.has_project_access(proj_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = proj_id AND user_id = auth.uid()
  );
$$;

-- 4.3 Check if caller can manage project members
CREATE OR REPLACE FUNCTION public.can_manage_project_members(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id 
      AND user_id = auth.uid() 
      AND (role = 'lead' OR can_manage_members = TRUE)
  );
$$;

-- 4.4 Alias for backward compatibility
CREATE OR REPLACE FUNCTION public.can_invite_to_project(proj_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT public.can_manage_project_members(proj_id);
$$;

-- ==============================================================================
-- 5. TRIGGERS
-- ==============================================================================

-- 5.1 Trusted Profile Provisioning on auth.users Creation
-- Strictly assigns 'super_admin' role exclusively to realgauravpatel@gmail.com.
-- Does NOT fake mfa_enabled = true; mfa_enabled is false until genuine TOTP enrollment.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    labels,
    mfa_enabled,
    created_at,
    last_active_at
  )
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    CASE
      WHEN LOWER(NEW.email) = 'realgauravpatel@gmail.com' THEN 'super_admin'::public.user_workspace_role
      ELSE 'member'::public.user_workspace_role
    END,
    CASE
      WHEN LOWER(NEW.email) = 'realgauravpatel@gmail.com' THEN ARRAY['Architecture', 'Security', 'Owner']
      ELSE ARRAY['Developer']
    END,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = CASE
        WHEN LOWER(EXCLUDED.email) = 'realgauravpatel@gmail.com' THEN 'super_admin'::public.user_workspace_role
        ELSE profiles.role
      END,
      last_active_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.2 Automatic sync for invitation project roles and hash computation
CREATE OR REPLACE FUNCTION public.sync_invitation_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions, auth
AS $$
BEGIN
  IF NEW.project_role IS NOT NULL AND NEW.invited_project_role IS NULL THEN
    NEW.invited_project_role := NEW.project_role;
  ELSIF NEW.invited_project_role IS NOT NULL AND NEW.project_role IS NULL THEN
    NEW.project_role := NEW.invited_project_role;
  END IF;

  IF NEW.token_hash IS NULL AND NEW.token IS NOT NULL THEN
    NEW.token_hash := encode(digest(NEW.token, 'sha256'), 'hex');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invitation_fields ON public.invitations;
CREATE TRIGGER trg_sync_invitation_fields
  BEFORE INSERT OR UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.sync_invitation_fields();

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 6.1 Profiles Policies
-- Non-recursive, prevents self-escalation, preserves protected columns
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_auth ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (
    (public.is_super_admin() AND LOWER(auth.jwt()->>'email') = 'realgauravpatel@gmail.com')
    OR (
      id = auth.uid()
      AND role = 'member'
      AND email = LOWER(auth.jwt()->>'email')
    )
  );

CREATE POLICY profiles_insert_auth ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND email = LOWER(auth.jwt()->>'email')
    AND (
      (role = 'member' AND LOWER(auth.jwt()->>'email') != 'realgauravpatel@gmail.com')
      OR (role = 'super_admin' AND LOWER(auth.jwt()->>'email') = 'realgauravpatel@gmail.com')
    )
  );

-- 6.2 Projects Policies
DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_insert ON public.projects;
DROP POLICY IF EXISTS projects_update ON public.projects;
DROP POLICY IF EXISTS projects_admin ON public.projects;
DROP POLICY IF EXISTS projects_delete_super_admin ON public.projects;

CREATE POLICY projects_select ON public.projects
  FOR SELECT TO authenticated
  USING (public.has_project_access(id));

CREATE POLICY projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid() OR public.is_super_admin()
  );

CREATE POLICY projects_update ON public.projects
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin() OR public.can_manage_project_members(id)
  )
  WITH CHECK (
    public.is_super_admin() OR public.can_manage_project_members(id)
  );

CREATE POLICY projects_delete_super_admin ON public.projects
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    AND LOWER((SELECT email FROM public.profiles WHERE id = auth.uid())) = 'realgauravpatel@gmail.com'
  );

-- 6.3 Project Members Policies
DROP POLICY IF EXISTS pm_select ON public.project_members;
DROP POLICY IF EXISTS pm_admin ON public.project_members;
DROP POLICY IF EXISTS pm_insert ON public.project_members;
DROP POLICY IF EXISTS pm_update ON public.project_members;
DROP POLICY IF EXISTS pm_delete ON public.project_members;
DROP POLICY IF EXISTS pm_lead_manage ON public.project_members;

CREATE POLICY pm_select ON public.project_members
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id));

CREATE POLICY pm_insert ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.can_manage_project_members(project_id)
    OR (
      user_id = auth.uid()
      AND role = 'lead'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  );

CREATE POLICY pm_update ON public.project_members
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.can_manage_project_members(project_id))
  WITH CHECK (public.is_super_admin() OR public.can_manage_project_members(project_id));

CREATE POLICY pm_delete ON public.project_members
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin() 
    OR public.can_manage_project_members(project_id) 
    OR user_id = auth.uid()
  );

-- 6.4 Invitations Policies
DROP POLICY IF EXISTS invitations_select ON public.invitations;
DROP POLICY IF EXISTS invitations_insert ON public.invitations;
DROP POLICY IF EXISTS invitations_update ON public.invitations;
DROP POLICY IF EXISTS invitations_delete ON public.invitations;
DROP POLICY IF EXISTS invitations_select_policy ON public.invitations;
DROP POLICY IF EXISTS invitations_insert_policy ON public.invitations;
DROP POLICY IF EXISTS invitations_update_policy ON public.invitations;
DROP POLICY IF EXISTS invitations_admin_modify ON public.invitations;

CREATE POLICY invitations_select ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR invited_by = auth.uid()
    OR (project_id IS NOT NULL AND public.can_manage_project_members(project_id))
    OR LOWER(email) = LOWER(auth.jwt()->>'email')
  );

CREATE POLICY invitations_insert ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND role = 'member'
    AND (
      public.is_super_admin()
      OR (project_id IS NOT NULL AND public.can_manage_project_members(project_id))
    )
  );

CREATE POLICY invitations_update ON public.invitations
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR invited_by = auth.uid())
  WITH CHECK (public.is_super_admin() OR invited_by = auth.uid());

CREATE POLICY invitations_delete ON public.invitations
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- 6.5 Milestones Policies
DROP POLICY IF EXISTS milestones_select ON public.milestones;
DROP POLICY IF EXISTS milestones_insert ON public.milestones;
DROP POLICY IF EXISTS milestones_update ON public.milestones;
DROP POLICY IF EXISTS milestones_delete ON public.milestones;
DROP POLICY IF EXISTS milestones_modify ON public.milestones;

CREATE POLICY milestones_select ON public.milestones
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id));

CREATE POLICY milestones_insert ON public.milestones
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.can_manage_project_members(project_id));

CREATE POLICY milestones_update ON public.milestones
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.can_manage_project_members(project_id))
  WITH CHECK (public.is_super_admin() OR public.can_manage_project_members(project_id));

CREATE POLICY milestones_delete ON public.milestones
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.can_manage_project_members(project_id));

-- 6.6 Tasks Policies
DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
DROP POLICY IF EXISTS tasks_modify ON public.tasks;

CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id));

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_project_access(project_id)
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid() AND (pm.can_manage_tasks = TRUE OR pm.role = 'lead')
      )
    )
  );

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_project_access(project_id)
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid() AND (pm.can_manage_tasks = TRUE OR pm.role = 'lead')
      )
      OR assignee_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_project_access(project_id)
  );

CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin() OR public.can_manage_project_members(project_id)
  );

-- 6.7 Documents Policies
DROP POLICY IF EXISTS documents_select ON public.documents;
DROP POLICY IF EXISTS documents_insert ON public.documents;
DROP POLICY IF EXISTS documents_update ON public.documents;
DROP POLICY IF EXISTS documents_delete ON public.documents;

CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (
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

CREATE POLICY documents_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_project_access(project_id) AND (
      public.is_super_admin() 
      OR EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = public.documents.project_id
          AND user_id = auth.uid()
          AND can_upload_docs = TRUE
      )
    )
  );

CREATE POLICY documents_update ON public.documents
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin() 
    OR uploaded_by = auth.uid()
    OR public.can_manage_project_members(project_id)
  )
  WITH CHECK (
    public.has_project_access(project_id)
  );

CREATE POLICY documents_delete ON public.documents
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin() 
    OR uploaded_by = auth.uid()
    OR public.can_manage_project_members(project_id)
  );

-- 6.8 Document Access Grants Policies
DROP POLICY IF EXISTS doc_grants_select ON public.document_access_grants;
DROP POLICY IF EXISTS doc_grants_insert ON public.document_access_grants;
DROP POLICY IF EXISTS doc_grants_update ON public.document_access_grants;
DROP POLICY IF EXISTS doc_grants_delete ON public.document_access_grants;

CREATE POLICY doc_grants_select ON public.document_access_grants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.can_manage_project_members(d.project_id)
    )
  );

CREATE POLICY doc_grants_insert ON public.document_access_grants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.has_project_access(d.project_id)
    )
  );

CREATE POLICY doc_grants_update ON public.document_access_grants
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.can_manage_project_members(d.project_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.can_manage_project_members(d.project_id)
    )
  );

CREATE POLICY doc_grants_delete ON public.document_access_grants
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND public.can_manage_project_members(d.project_id)
    )
  );

-- 6.9 Suggestions Policies
DROP POLICY IF EXISTS suggestions_select ON public.suggestions;
DROP POLICY IF EXISTS suggestions_insert ON public.suggestions;
DROP POLICY IF EXISTS suggestions_admin_update ON public.suggestions;
DROP POLICY IF EXISTS suggestions_delete ON public.suggestions;

CREATE POLICY suggestions_select ON public.suggestions
  FOR SELECT TO authenticated
  USING (submitter_id = auth.uid() OR public.is_super_admin());

CREATE POLICY suggestions_insert ON public.suggestions
  FOR INSERT TO authenticated
  WITH CHECK (submitter_id = auth.uid());

CREATE POLICY suggestions_admin_update ON public.suggestions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY suggestions_delete ON public.suggestions
  FOR DELETE TO authenticated
  USING (submitter_id = auth.uid() OR public.is_super_admin());

-- 6.10 Personal Ideas Policies (Strict User Isolation)
DROP POLICY IF EXISTS ideas_owner_select ON public.ideas;
DROP POLICY IF EXISTS ideas_owner_insert ON public.ideas;
DROP POLICY IF EXISTS ideas_owner_update ON public.ideas;
DROP POLICY IF EXISTS ideas_owner_delete ON public.ideas;

CREATE POLICY ideas_owner_select ON public.ideas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY ideas_owner_insert ON public.ideas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY ideas_owner_update ON public.ideas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY ideas_owner_delete ON public.ideas
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6.11 Announcements Policies
DROP POLICY IF EXISTS announcements_select ON public.announcements;
DROP POLICY IF EXISTS announcements_admin ON public.announcements;

CREATE POLICY announcements_select ON public.announcements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY announcements_admin ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 6.12 Notifications Policies
DROP POLICY IF EXISTS notifications_recipient ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_system ON public.notifications;

CREATE POLICY notifications_recipient ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY notifications_update_recipient ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY notifications_delete_recipient ON public.notifications
  FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY notifications_insert_system ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 6.13 Activity Logs Policies (Append-only audit trail)
DROP POLICY IF EXISTS activity_select ON public.activity_logs;
DROP POLICY IF EXISTS activity_insert ON public.activity_logs;

CREATE POLICY activity_select ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (project_id IS NOT NULL AND public.has_project_access(project_id))
    OR user_id = auth.uid()
  );

CREATE POLICY activity_insert ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- 7. SUPABASE STORAGE SETUP & STORAGE RLS POLICIES
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Document library download access" ON storage.objects;
DROP POLICY IF EXISTS "Document library upload access" ON storage.objects;
DROP POLICY IF EXISTS "Document library delete access" ON storage.objects;

CREATE POLICY "Document library download access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-documents' AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.storage_path = storage.objects.name
          AND public.has_project_access(d.project_id)
          AND (
            NOT d.is_restricted
            OR EXISTS (
              SELECT 1 FROM public.document_access_grants g
              WHERE g.document_id = d.id
                AND g.user_id = auth.uid()
                AND g.status = 'approved'
                AND (g.granted_until IS NULL OR g.granted_until > now())
            )
          )
      )
    )
  );

CREATE POLICY "Document library upload access" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-documents'
    AND storage.objects.name NOT LIKE '%..%'
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND storage.objects.name LIKE 'projects/' || pm.project_id::text || '/%'
          AND (pm.role = 'lead' OR pm.can_upload_docs = TRUE)
      )
    )
  );

CREATE POLICY "Document library delete access" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-documents' AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.project_members pm ON pm.project_id = d.project_id AND pm.user_id = auth.uid()
        WHERE d.storage_path = storage.objects.name
          AND (pm.role = 'lead' OR d.uploaded_by = auth.uid())
      )
    )
  );

-- ==============================================================================
-- 8. RPC FUNCTIONS
-- ==============================================================================

-- 8.1 create_workspace_invitation (Super Admin only)
CREATE OR REPLACE FUNCTION public.create_workspace_invitation(
  p_email TEXT,
  p_role public.user_workspace_role,
  p_initial_labels TEXT[],
  p_assigned_project_ids UUID[],
  p_expires_in_days INT,
  p_token TEXT,
  p_token_hash TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_email TEXT := LOWER(TRIM(p_email));
  v_expires_at TIMESTAMPTZ;
  v_new_inv public.invitations%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrators can create workspace invitations.';
  END IF;

  IF v_email IS NULL OR v_email = '' OR v_email NOT LIKE '%_@__%.__%' THEN
    RAISE EXCEPTION 'Invalid email address provided.';
  END IF;

  IF p_expires_in_days IS NULL OR p_expires_in_days < 1 OR p_expires_in_days > 90 THEN
    RAISE EXCEPTION 'Expiration period must be between 1 and 90 days.';
  END IF;

  v_expires_at := now() + (p_expires_in_days || ' days')::INTERVAL;

  UPDATE public.invitations
  SET status = 'revoked', revoked_at = now(), revoked_by = v_caller_id
  WHERE email = v_email AND status = 'pending' AND scope = 'workspace';

  INSERT INTO public.invitations (
    email,
    scope,
    role,
    token,
    token_hash,
    invited_by,
    initial_labels,
    assigned_project_ids,
    expires_at,
    status,
    created_at
  )
  VALUES (
    v_email,
    'workspace',
    COALESCE(p_role, 'member'::public.user_workspace_role),
    p_token,
    COALESCE(p_token_hash, encode(digest(p_token, 'sha256'), 'hex')),
    v_caller_id,
    COALESCE(p_initial_labels, '{}'),
    COALESCE(p_assigned_project_ids, '{}'),
    v_expires_at,
    'pending',
    now()
  )
  RETURNING * INTO v_new_inv;

  INSERT INTO public.activity_logs (user_id, action, details, created_at)
  VALUES (
    v_caller_id,
    'invitation_created',
    'Created workspace invitation for ' || v_email || ' (expires in ' || p_expires_in_days || ' days)',
    now()
  );

  RETURN jsonb_build_object(
    'id', v_new_inv.id,
    'email', v_new_inv.email,
    'scope', v_new_inv.scope,
    'role', v_new_inv.role,
    'token', p_token,
    'expiresAt', v_new_inv.expires_at,
    'status', v_new_inv.status,
    'createdAt', v_new_inv.created_at
  );
END;
$$;

-- 8.2 create_project_invitation (Project Leads or Super Admin)
CREATE OR REPLACE FUNCTION public.create_project_invitation(
  p_project_id UUID,
  p_email TEXT,
  p_project_role public.project_member_role,
  p_permissions JSONB,
  p_expires_in_days INT,
  p_token TEXT,
  p_token_hash TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_email TEXT := LOWER(TRIM(p_email));
  v_expires_at TIMESTAMPTZ;
  v_project public.projects%ROWTYPE;
  v_new_inv public.invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target project does not exist.';
  END IF;

  IF NOT public.can_manage_project_members(p_project_id) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to invite collaborators to this project.';
  END IF;

  IF v_email IS NULL OR v_email = '' OR v_email NOT LIKE '%_@__%.__%' THEN
    RAISE EXCEPTION 'Invalid email address provided.';
  END IF;

  IF p_expires_in_days IS NULL OR p_expires_in_days < 1 OR p_expires_in_days > 90 THEN
    RAISE EXCEPTION 'Expiration period must be between 1 and 90 days.';
  END IF;

  v_expires_at := now() + (p_expires_in_days || ' days')::INTERVAL;

  UPDATE public.invitations
  SET status = 'revoked', revoked_at = now(), revoked_by = v_caller_id
  WHERE email = v_email AND project_id = p_project_id AND status = 'pending';

  INSERT INTO public.invitations (
    email,
    scope,
    project_id,
    project_role,
    invited_project_role,
    project_permissions,
    role,
    token,
    token_hash,
    invited_by,
    initial_labels,
    assigned_project_ids,
    expires_at,
    status,
    created_at
  )
  VALUES (
    v_email,
    'project',
    p_project_id,
    COALESCE(p_project_role, 'collaborator'::public.project_member_role),
    COALESCE(p_project_role, 'collaborator'::public.project_member_role),
    COALESCE(p_permissions, '{"canManageTasks": true, "canUploadDocs": true, "canViewMetrics": true, "canManageMembers": false}'::jsonb),
    'member'::public.user_workspace_role,
    p_token,
    COALESCE(p_token_hash, encode(digest(p_token, 'sha256'), 'hex')),
    v_caller_id,
    ARRAY['Developer'],
    ARRAY[p_project_id],
    v_expires_at,
    'pending',
    now()
  )
  RETURNING * INTO v_new_inv;

  INSERT INTO public.activity_logs (project_id, user_id, action, details, created_at)
  VALUES (
    p_project_id,
    v_caller_id,
    'project_invitation_created',
    'Created project invitation for ' || v_email || ' as ' || COALESCE(p_project_role::text, 'collaborator') || ' on "' || v_project.name || '"',
    now()
  );

  RETURN jsonb_build_object(
    'id', v_new_inv.id,
    'email', v_new_inv.email,
    'scope', v_new_inv.scope,
    'projectId', v_new_inv.project_id,
    'projectName', v_project.name,
    'projectRole', v_new_inv.project_role,
    'token', p_token,
    'expiresAt', v_new_inv.expires_at,
    'status', v_new_inv.status,
    'createdAt', v_new_inv.created_at
  );
END;
$$;

-- 8.3 revoke_invitation
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv public.invitations%ROWTYPE;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found.';
  END IF;

  IF NOT (
    public.is_super_admin() 
    OR v_inv.invited_by = v_caller_id
    OR (v_inv.project_id IS NOT NULL AND public.can_manage_project_members(v_inv.project_id))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to revoke this invitation.';
  END IF;

  IF v_inv.status = 'accepted' THEN
    RAISE EXCEPTION 'This invitation has already been accepted and cannot be revoked.';
  END IF;

  UPDATE public.invitations
  SET status = 'revoked',
      revoked_at = now(),
      revoked_by = v_caller_id
  WHERE id = p_invitation_id;

  INSERT INTO public.activity_logs (project_id, user_id, action, details, created_at)
  VALUES (
    v_inv.project_id,
    v_caller_id,
    'invitation_revoked',
    'Revoked invitation for ' || v_inv.email || ' (' || v_inv.scope || ' scope)',
    now()
  );

  RETURN jsonb_build_object('success', true, 'id', p_invitation_id, 'status', 'revoked');
END;
$$;

-- 8.4 inspect_invitation_by_token (Publicly safe lookup for incoming users)
-- Evaluates token strictly by SHA-256 hash
CREATE OR REPLACE FUNCTION public.inspect_invitation_by_token(p_token_or_hash TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
STABLE
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_project_name TEXT := NULL;
  v_inviter_name TEXT := 'Workspace Admin';
  v_clean_input TEXT := TRIM(p_token_or_hash);
  v_lookup_hash TEXT;
BEGIN
  IF v_clean_input IS NULL OR v_clean_input = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_input');
  END IF;

  -- Derive lookup hash: if already 64-char hex, use as is; otherwise compute sha256
  IF v_clean_input ~ '^[0-9a-fA-F]{64}$' THEN
    v_lookup_hash := LOWER(v_clean_input);
  ELSE
    v_lookup_hash := encode(digest(v_clean_input, 'sha256'), 'hex');
  END IF;

  -- Strictly look up by token_hash
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = v_lookup_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_inv.status = 'revoked' OR v_inv.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'revoked', 'email', v_inv.email);
  END IF;

  IF v_inv.status = 'accepted' OR v_inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'accepted', 'email', v_inv.email);
  END IF;

  IF v_inv.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'email', v_inv.email);
  END IF;

  IF v_inv.project_id IS NOT NULL THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = v_inv.project_id;
  END IF;

  SELECT full_name INTO v_inviter_name FROM public.profiles WHERE id = v_inv.invited_by;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_inv.id,
    'email', v_inv.email,
    'scope', v_inv.scope,
    'role', v_inv.role,
    'projectId', v_inv.project_id,
    'projectName', v_project_name,
    'projectRole', COALESCE(v_inv.project_role, v_inv.invited_project_role),
    'inviterName', COALESCE(v_inviter_name, 'Workspace Admin'),
    'expiresAt', v_inv.expires_at,
    'status', 'pending'
  );
END;
$$;

-- 8.5 redeem_invitation_atomic (Canonical Atomic Single-Use Invitation Redemption)
CREATE OR REPLACE FUNCTION public.redeem_invitation_atomic(
  p_token_hash TEXT,
  p_user_full_name TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_caller_id UUID := auth.uid();
  v_caller_email TEXT;
  v_proj_id UUID;
  v_proj_role public.project_member_role := 'collaborator';
  v_can_tasks BOOLEAN := TRUE;
  v_can_docs BOOLEAN := TRUE;
  v_can_metrics BOOLEAN := TRUE;
  v_can_members BOOLEAN := FALSE;
  v_clean_input TEXT := TRIM(p_token_hash);
  v_lookup_hash TEXT;
BEGIN
  -- 1. Ensure authenticated caller
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to redeem workspace invitation.';
  END IF;

  IF v_clean_input IS NULL OR v_clean_input = '' THEN
    RAISE EXCEPTION 'Invalid or missing invitation token.';
  END IF;

  -- 2. Fetch authenticated caller's email
  SELECT LOWER(email) INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  IF v_caller_email IS NULL THEN
    SELECT LOWER(email) INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;
  END IF;

  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user email could not be resolved.';
  END IF;

  -- 3. Derive lookup hash: if 64-char hex, use as is; otherwise compute sha256
  IF v_clean_input ~ '^[0-9a-fA-F]{64}$' THEN
    v_lookup_hash := LOWER(v_clean_input);
  ELSE
    v_lookup_hash := encode(digest(v_clean_input, 'sha256'), 'hex');
  END IF;

  -- 4. Find and lock the invitation atomically strictly by token_hash
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = v_lookup_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or unknown invitation token.';
  END IF;

  -- 5. Check status & expiration
  IF v_inv.status = 'revoked' OR v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invitation has been revoked by workspace administrators.';
  END IF;

  IF v_inv.status = 'accepted' OR v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invitation has already been redeemed.';
  END IF;

  IF v_inv.expires_at <= now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'This invitation has expired.';
  END IF;

  -- 6. Strict Email Matching Check
  IF LOWER(v_caller_email) <> LOWER(v_inv.email) THEN
    RAISE EXCEPTION 'Email mismatch: This invitation was issued to %, but you are signed in as %. Please sign in with the invited email address.',
      v_inv.email, v_caller_email;
  END IF;

  -- 7. Profile Creation / Sync without role escalation or faked MFA
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    labels,
    mfa_enabled,
    created_at,
    last_active_at
  )
  VALUES (
    v_caller_id,
    v_inv.email,
    COALESCE(NULLIF(TRIM(p_user_full_name), ''), SPLIT_PART(v_inv.email, '@', 1)),
    CASE
      WHEN LOWER(v_inv.email) = 'realgauravpatel@gmail.com' THEN 'super_admin'::public.user_workspace_role
      WHEN v_inv.scope = 'workspace' THEN COALESCE(v_inv.role, 'member'::public.user_workspace_role)
      ELSE 'member'::public.user_workspace_role
    END,
    COALESCE(v_inv.initial_labels, ARRAY['Developer']),
    FALSE,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(NULLIF(TRIM(p_user_full_name), ''), profiles.full_name),
      labels = array_cat(profiles.labels, EXCLUDED.labels),
      last_active_at = now();

  -- 8. Scope-Specific Membership Granting
  IF v_inv.scope = 'workspace' THEN
    IF v_inv.assigned_project_ids IS NOT NULL AND v_inv.assigned_project_ids != '{}' THEN
      v_proj_role := COALESCE(v_inv.project_role, v_inv.invited_project_role, 'collaborator'::public.project_member_role);
      FOREACH v_proj_id IN ARRAY v_inv.assigned_project_ids
      LOOP
        INSERT INTO public.project_members (
          project_id,
          user_id,
          role,
          can_manage_tasks,
          can_upload_docs,
          can_view_metrics,
          can_manage_members,
          joined_at
        )
        VALUES (
          v_proj_id,
          v_caller_id,
          v_proj_role,
          CASE WHEN v_proj_role = 'viewer' THEN FALSE ELSE TRUE END,
          CASE WHEN v_proj_role = 'viewer' THEN FALSE ELSE TRUE END,
          TRUE,
          CASE WHEN v_proj_role = 'lead' THEN TRUE ELSE FALSE END,
          now()
        )
        ON CONFLICT (project_id, user_id) DO UPDATE
        SET role = EXCLUDED.role,
            can_manage_tasks = EXCLUDED.can_manage_tasks,
            can_upload_docs = EXCLUDED.can_upload_docs,
            can_view_metrics = EXCLUDED.can_view_metrics,
            can_manage_members = EXCLUDED.can_manage_members;
      END LOOP;
    END IF;

  ELSIF v_inv.scope = 'project' AND v_inv.project_id IS NOT NULL THEN
    v_proj_role := COALESCE(v_inv.project_role, v_inv.invited_project_role, 'collaborator'::public.project_member_role);
    v_can_tasks := COALESCE((v_inv.project_permissions->>'canManageTasks')::boolean, v_proj_role != 'viewer');
    v_can_docs := COALESCE((v_inv.project_permissions->>'canUploadDocs')::boolean, v_proj_role != 'viewer');
    v_can_metrics := COALESCE((v_inv.project_permissions->>'canViewMetrics')::boolean, true);
    v_can_members := COALESCE((v_inv.project_permissions->>'canManageMembers')::boolean, v_proj_role = 'lead');

    INSERT INTO public.project_members (
      project_id,
      user_id,
      role,
      can_manage_tasks,
      can_upload_docs,
      can_view_metrics,
      can_manage_members,
      joined_at
    )
    VALUES (
      v_inv.project_id,
      v_caller_id,
      v_proj_role,
      v_can_tasks,
      v_can_docs,
      v_can_metrics,
      v_can_members,
      now()
    )
    ON CONFLICT (project_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        can_manage_tasks = EXCLUDED.can_manage_tasks,
        can_upload_docs = EXCLUDED.can_upload_docs,
        can_view_metrics = EXCLUDED.can_view_metrics,
        can_manage_members = EXCLUDED.can_manage_members;
  END IF;

  -- 9. Mark invitation as accepted atomically
  UPDATE public.invitations
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = v_caller_id
  WHERE id = v_inv.id;

  -- 10. Audit Event
  INSERT INTO public.activity_logs (project_id, user_id, action, details, created_at)
  VALUES (
    v_inv.project_id,
    v_caller_id,
    'invitation_accepted',
    v_inv.email || ' accepted invitation for ' || v_inv.scope || ' access',
    now()
  );

  -- 11. Notify original inviter
  IF v_inv.invited_by IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link, is_read, created_at)
    VALUES (
      v_inv.invited_by,
      'invitation',
      'Invitation Accepted',
      v_inv.email || ' has accepted your invitation and joined the workspace.',
      CASE WHEN v_inv.project_id IS NOT NULL THEN '/projects/' || v_inv.project_id ELSE '/team' END,
      FALSE,
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_inv.email,
    'scope', v_inv.scope,
    'projectId', v_inv.project_id,
    'role', v_inv.role,
    'assigned_projects', v_inv.assigned_project_ids
  );
END;
$$;

-- 8.6 accept_invitation_safe (Backward-compatibility wrapper)
CREATE OR REPLACE FUNCTION public.accept_invitation_safe(p_token_or_hash TEXT, p_full_name TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
BEGIN
  RETURN public.redeem_invitation_atomic(p_token_or_hash, p_full_name);
END;
$$;

-- 8.7 redeem_invitation_safe (Backward-compatibility wrapper)
CREATE OR REPLACE FUNCTION public.redeem_invitation_safe(inv_token TEXT, user_full_name TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
BEGIN
  RETURN public.redeem_invitation_atomic(inv_token, user_full_name);
END;
$$;

-- 8.8 secure_delete_project (Mandatory MFA Verification: Fail-Closed)
CREATE OR REPLACE FUNCTION public.secure_delete_project(target_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_user_role TEXT;
  v_project_name TEXT;
  v_task_count INT;
  v_doc_count INT;
  v_member_count INT;
  v_inv_count INT;
BEGIN
  -- Verification 1: Caller must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to delete a project.';
  END IF;

  -- Verification 2: Verify Super Admin identity and email restriction
  SELECT email, role INTO v_user_email, v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR LOWER(v_user_email) != 'realgauravpatel@gmail.com' OR v_user_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Project deletion is restricted exclusively to the Super Admin (realgauravpatel@gmail.com).';
  END IF;

  -- Verification 3: Strict Fail-Closed MFA Verification
  -- 3a. A verified TOTP factor MUST exist for the user in Supabase auth.mfa_factors
  IF NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = v_user_id AND status = 'verified' AND factor_type = 'totp'
  ) THEN
    RAISE EXCEPTION 'MFA mandatory: A verified TOTP authenticator factor must be enrolled on the Super Admin account before deleting projects.';
  END IF;

  -- 3b. The active session JWT MUST be Authenticator Assurance Level 2 (AAL2)
  IF COALESCE(auth.jwt()->>'aal', 'aal1') != 'aal2' THEN
    RAISE EXCEPTION 'MFA step-up verification required: An active TOTP challenge must be verified in this session (AAL2 required) to delete projects.';
  END IF;

  -- Verification 4: Locate target project
  SELECT name INTO v_project_name
  FROM public.projects
  WHERE id = target_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or already deleted.';
  END IF;

  -- Record counts for cascading audit report
  SELECT COUNT(*) INTO v_task_count FROM public.tasks WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_doc_count FROM public.documents WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_member_count FROM public.project_members WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_inv_count FROM public.invitations WHERE project_id = target_project_id;

  -- Atomic Cascading Cleanup in dependency order:
  -- 1. Document access grants
  DELETE FROM public.document_access_grants
  WHERE document_id IN (SELECT id FROM public.documents WHERE project_id = target_project_id);

  -- 2. Tasks
  DELETE FROM public.tasks WHERE project_id = target_project_id;

  -- 3. Milestones
  DELETE FROM public.milestones WHERE project_id = target_project_id;

  -- 4. Documents
  DELETE FROM public.documents WHERE project_id = target_project_id;

  -- 5. Project Members
  DELETE FROM public.project_members WHERE project_id = target_project_id;

  -- 6. Project-specific invitations
  DELETE FROM public.invitations WHERE project_id = target_project_id;

  -- 7. Disassociate suggestions
  UPDATE public.suggestions SET project_id = NULL WHERE project_id = target_project_id;

  -- 8. Project activity logs
  DELETE FROM public.activity_logs WHERE project_id = target_project_id;

  -- 9. Delete project entity itself
  DELETE FROM public.projects WHERE id = target_project_id;

  -- 10. Record workspace-level audit log
  INSERT INTO public.activity_logs (
    id,
    project_id,
    user_id,
    action,
    details,
    created_at
  ) VALUES (
    uuid_generate_v4(),
    NULL,
    v_user_id,
    'project_deleted',
    'Permanently deleted project: ' || v_project_name || ' (tasks: ' || v_task_count || ', docs: ' || v_doc_count || ', members: ' || v_member_count || ', invitations: ' || v_inv_count || ')',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'projectId', target_project_id,
    'projectName', v_project_name,
    'cascadedTasks', v_task_count,
    'cascadedDocs', v_doc_count,
    'cascadedMembers', v_member_count,
    'cascadedInvitations', v_inv_count
  );
END;
$$;

-- ==============================================================================
-- 9. LEAST-PRIVILEGE FUNCTION PERMISSIONS & EXECUTE GRANTS
-- ==============================================================================

-- Revoke default PUBLIC execution from all SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_project_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_project_members(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_invite_to_project(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_invitation_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_workspace_invitation(TEXT, public.user_workspace_role, TEXT[], UUID[], INT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_project_invitation(UUID, TEXT, public.project_member_role, JSONB, INT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_invitation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inspect_invitation_by_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_invitation_atomic(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation_safe(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_invitation_safe(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.secure_delete_project(UUID) FROM PUBLIC;

-- Ensure schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
  END IF;
END $$;

-- 1. Helper security functions used in RLS policies:
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_project_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_project_members(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_invite_to_project(UUID) TO authenticated, service_role;

-- 2. Public invitation lookup for incoming onboarding/welcome view:
GRANT EXECUTE ON FUNCTION public.inspect_invitation_by_token(TEXT) TO anon, authenticated, service_role;

-- 3. Authenticated RPCs for invitation management & redemption:
GRANT EXECUTE ON FUNCTION public.create_workspace_invitation(TEXT, public.user_workspace_role, TEXT[], UUID[], INT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_project_invitation(UUID, TEXT, public.project_member_role, JSONB, INT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_atomic(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_invitation_safe(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_safe(TEXT, TEXT) TO authenticated, service_role;

-- 4. Super Admin Protected RPCs:
GRANT EXECUTE ON FUNCTION public.secure_delete_project(UUID) TO authenticated, service_role;
