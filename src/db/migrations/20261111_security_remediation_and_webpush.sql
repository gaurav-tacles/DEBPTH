-- ==============================================================================
-- ProjectHub / DEBPTH Migration: 20261111_security_remediation_and_webpush.sql
-- Description:
-- 1. SECURITY FIX: Decouple profile existence from workspace membership.
--    - Creates public.workspace_members table.
--    - Creates public.is_workspace_member() helper function.
--    - Backfills Super Admin and accepted invitees into workspace_members.
--    - Updates redeem_invitation_atomic() to register new members upon redemption.
-- 2. SECURITY FIX: Replaces overly permissive suggestions RLS policy.
--    - Restricts project-specific suggestions to authorized project members.
--    - Restricts general suggestions to verified workspace members.
--    - Prevents submitter tampering with admin_notes, admin_response, status, or converted_task_id.
-- 3. SECURITY FIX: Restricts announcements visibility to verified workspace members.
-- 4. BUG FIX: Adds missing UPDATE policy for public.push_subscriptions (fixes upsert ON CONFLICT failures).
-- 5. SECURITY FIX: Migrates and nullifies legacy plaintext invitation tokens in DB.
-- 6. Webhook trigger setup for background Web Push notification dispatch.
-- ==============================================================================

-- 0. BASELINE EXTENSIONS, COLUMNS & TABLES (Idempotent across 20261014 -> 20261111 baselines)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure public.invitations has all hardened columns even on older baselines
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_role public.project_member_role DEFAULT 'collaborator',
  ADD COLUMN IF NOT EXISTS invited_project_role public.project_member_role DEFAULT 'collaborator',
  ADD COLUMN IF NOT EXISTS project_permissions JSONB DEFAULT '{"canManageTasks": true, "canUploadDocs": true, "canViewMetrics": true, "canManageMembers": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash
  ON public.invitations(token_hash) WHERE token_hash IS NOT NULL;

-- Ensure public.ideas table exists before RLS policies are applied
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
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- Ensure public.push_subscriptions table exists before RLS policies are applied
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 1. LEGACY INVITATION TOKEN REMEDIATION
-- Backfill any missing token_hash from existing plaintext tokens (search_path includes extensions for Supabase pgcrypto)
DO $$
BEGIN
  SET LOCAL search_path = public, extensions;

  UPDATE public.invitations
  SET token_hash = encode(digest(token, 'sha256'), 'hex')
  WHERE token_hash IS NULL AND token IS NOT NULL;
END $$;

-- Invalidate/revoke any corrupted invitations where both token and token_hash are null
UPDATE public.invitations
SET status = 'revoked',
    revoked_at = timezone('utc'::text, now())
WHERE token_hash IS NULL AND status = 'pending';

-- Eliminate all legacy plaintext tokens from database storage
UPDATE public.invitations
SET token = NULL
WHERE token IS NOT NULL AND token_hash IS NOT NULL;

-- Ensure invitations.token column is nullable
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'token'
  ) THEN
    ALTER TABLE public.invitations ALTER COLUMN token DROP NOT NULL;
  END IF;
END $$;

-- 2. WORKSPACE MEMBERSHIP INFRASTRUCTURE & PROFILE DECOUPLING
CREATE TABLE IF NOT EXISTS public.workspace_members (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspace member helper function (STABLE, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_user_id UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = COALESCE(p_user_id, auth.uid())
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated, service_role;

-- RLS policies for workspace_members
DROP POLICY IF EXISTS wm_select ON public.workspace_members;
CREATE POLICY wm_select ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR public.is_workspace_member()
  );

DROP POLICY IF EXISTS wm_admin ON public.workspace_members;
CREATE POLICY wm_admin ON public.workspace_members
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Backfill Super Admin into workspace_members ONLY when auth email is verified
INSERT INTO public.workspace_members (user_id, role, joined_at)
SELECT p.id, 'super_admin', timezone('utc'::text, now())
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE LOWER(p.email) = 'realgauravpatel@gmail.com'
  AND LOWER(u.email) = 'realgauravpatel@gmail.com'
  AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Revoke any accidental super_admin role/membership on unverified or mismatched accounts
UPDATE public.profiles p
SET role = 'member'::public.user_workspace_role
FROM auth.users u
WHERE p.id = u.id
  AND p.role = 'super_admin'
  AND (LOWER(u.email) <> 'realgauravpatel@gmail.com' OR u.email_confirmed_at IS NULL);

DELETE FROM public.workspace_members wm
USING auth.users u
WHERE wm.user_id = u.id
  AND wm.role = 'super_admin'
  AND (LOWER(u.email) <> 'realgauravpatel@gmail.com' OR u.email_confirmed_at IS NULL);

-- Backfill existing accepted invitations into workspace_members
INSERT INTO public.workspace_members (user_id, role, joined_at, invited_by)
SELECT i.accepted_by, 'member', COALESCE(i.accepted_at, timezone('utc'::text, now())), i.invited_by
FROM public.invitations i
WHERE i.accepted_by IS NOT NULL AND i.status = 'accepted'
ON CONFLICT (user_id) DO NOTHING;

-- Harden is_super_admin() to verify verified auth.users email_confirmed_at
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
      AND LOWER(p.email) = 'realgauravpatel@gmail.com'
      AND LOWER(u.email) = 'realgauravpatel@gmail.com'
      AND u.email_confirmed_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- Enforce profile role immutability against direct client escalation
CREATE OR REPLACE FUNCTION public.enforce_profile_role_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('debpth.allow_role_sync', true) IS DISTINCT FROM 'true'
       AND current_setting('role', true) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Unauthorized: Profile role is immutable from client requests.';
    END IF;

    IF NEW.role = 'super_admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = NEW.id
          AND LOWER(u.email) = 'realgauravpatel@gmail.com'
          AND u.email_confirmed_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Unauthorized: super_admin role requires a verified Super Admin email.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_role_immutability ON public.profiles;
CREATE TRIGGER trg_enforce_profile_role_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_immutability();

-- Update handle_new_user() trigger: only provision super_admin when auth email is confirmed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_verified_super_admin BOOLEAN := (
    LOWER(NEW.email) = 'realgauravpatel@gmail.com' AND NEW.email_confirmed_at IS NOT NULL
  );
BEGIN
  PERFORM set_config('debpth.allow_role_sync', 'true', true);

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
      WHEN v_is_verified_super_admin THEN 'super_admin'::public.user_workspace_role
      ELSE 'member'::public.user_workspace_role
    END,
    CASE
      WHEN v_is_verified_super_admin THEN ARRAY['Architecture', 'Security', 'Owner']
      ELSE ARRAY['Developer']
    END,
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = CASE
        WHEN v_is_verified_super_admin THEN 'super_admin'::public.user_workspace_role
        ELSE profiles.role
      END,
      last_active_at = NOW();

  IF v_is_verified_super_admin THEN
    INSERT INTO public.workspace_members (user_id, role, joined_at)
    VALUES (NEW.id, 'super_admin', NOW())
    ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
  END IF;

  RETURN NEW;
END;
$$;

-- Promote Super Admin automatically once email_confirmed_at transitions from NULL to verified
CREATE OR REPLACE FUNCTION public.handle_auth_user_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF LOWER(NEW.email) = 'realgauravpatel@gmail.com'
     AND NEW.email_confirmed_at IS NOT NULL
     AND (OLD.email_confirmed_at IS NULL OR LOWER(OLD.email) IS DISTINCT FROM LOWER(NEW.email)) THEN
    PERFORM set_config('debpth.allow_role_sync', 'true', true);

    UPDATE public.profiles
    SET role = 'super_admin'::public.user_workspace_role,
        email = LOWER(NEW.email),
        labels = CASE
          WHEN labels IS NULL OR array_length(labels, 1) IS NULL THEN ARRAY['Architecture', 'Security', 'Owner']
          ELSE labels
        END,
        last_active_at = NOW()
    WHERE id = NEW.id;

    INSERT INTO public.workspace_members (user_id, role, joined_at)
    VALUES (NEW.id, 'super_admin', NOW())
    ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
  AFTER UPDATE OF email_confirmed_at, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_verified();

-- 2.1 HARDENED PROFILES, LEGACY INVITATIONS, PROJECTS, IDEAS, ACTIVITY & NOTIFICATIONS RLS
DROP POLICY IF EXISTS invitations_read_for_redemption ON public.invitations;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR public.is_workspace_member()
  );

DROP POLICY IF EXISTS profiles_insert_auth ON public.profiles;
CREATE POLICY profiles_insert_auth ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND email = LOWER(auth.jwt()->>'email')
    AND role = 'member'
  );

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (
    public.is_super_admin()
    OR (
      id = auth.uid()
      AND role = 'member'
      AND email = LOWER(auth.jwt()->>'email')
    )
  );

DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member()
    AND (owner_id = auth.uid() OR public.is_super_admin())
  );

DROP POLICY IF EXISTS activity_insert ON public.activity_logs;
CREATE POLICY activity_insert ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_workspace_member()
  );

DROP POLICY IF EXISTS ideas_owner_select ON public.ideas;
DROP POLICY IF EXISTS ideas_owner_insert ON public.ideas;
DROP POLICY IF EXISTS ideas_owner_update ON public.ideas;
DROP POLICY IF EXISTS ideas_owner_delete ON public.ideas;

CREATE POLICY ideas_owner_select ON public.ideas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member());

CREATE POLICY ideas_owner_insert ON public.ideas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member());

CREATE POLICY ideas_owner_update ON public.ideas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member())
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member());

CREATE POLICY ideas_owner_delete ON public.ideas
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member());

DROP POLICY IF EXISTS notifications_insert_system ON public.notifications;
CREATE POLICY notifications_insert_system ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member()
    AND (
      recipient_id = auth.uid()
      OR public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = recipient_id
          AND (public.is_workspace_member(p.id) OR p.role = 'super_admin')
      )
    )
  );

-- 3. HARDENED SUGGESTIONS RLS & PERMISSION COMPARTMENTALIZATION
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suggestions_select ON public.suggestions;
DROP POLICY IF EXISTS suggestions_insert ON public.suggestions;
DROP POLICY IF EXISTS suggestions_admin_update ON public.suggestions;
DROP POLICY IF EXISTS suggestions_update ON public.suggestions;
DROP POLICY IF EXISTS suggestions_submitter_update ON public.suggestions;
DROP POLICY IF EXISTS suggestions_delete ON public.suggestions;

-- SELECT POLICY:
-- General suggestions (project_id IS NULL) are visible only to verified workspace members.
-- Project suggestions (project_id IS NOT NULL) are visible only to members with project access.
-- Super Admin and original submitters always have access.
CREATE POLICY suggestions_select ON public.suggestions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (submitter_id = auth.uid() AND public.is_workspace_member())
    OR (project_id IS NULL AND public.is_workspace_member())
    OR (project_id IS NOT NULL AND public.has_project_access(project_id))
  );

-- INSERT POLICY:
-- Only verified workspace members can insert suggestions.
-- If linked to a project, user must have access to that project.
CREATE POLICY suggestions_insert ON public.suggestions
  FOR INSERT TO authenticated
  WITH CHECK (
    submitter_id = auth.uid()
    AND public.is_workspace_member()
    AND (project_id IS NULL OR public.has_project_access(project_id))
  );

-- UPDATE - SUPER ADMIN POLICY:
CREATE POLICY suggestions_admin_update ON public.suggestions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- UPDATE - SUBMITTER POLICY:
CREATE POLICY suggestions_submitter_update ON public.suggestions
  FOR UPDATE TO authenticated
  USING (submitter_id = auth.uid() AND status = 'submitted' AND public.is_workspace_member())
  WITH CHECK (submitter_id = auth.uid() AND status = 'submitted' AND public.is_workspace_member());

-- DELETE POLICY:
CREATE POLICY suggestions_delete ON public.suggestions
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (submitter_id = auth.uid() AND status = 'submitted' AND public.is_workspace_member()));

-- 4. HARDENED ANNOUNCEMENTS RLS
DROP POLICY IF EXISTS announcements_select ON public.announcements;
CREATE POLICY announcements_select ON public.announcements
  FOR SELECT TO authenticated
  USING (public.is_workspace_member());

-- 5. PUSH SUBSCRIPTIONS RLS (INCLUDING MISSING UPDATE POLICY & WORKSPACE MEMBERSHIP CHECK)
DROP POLICY IF EXISTS push_sub_select ON public.push_subscriptions;
DROP POLICY IF EXISTS push_sub_insert ON public.push_subscriptions;
DROP POLICY IF EXISTS push_sub_update ON public.push_subscriptions;
DROP POLICY IF EXISTS push_sub_delete ON public.push_subscriptions;

CREATE POLICY push_sub_select ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY push_sub_insert ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member());

-- Fixed: Allow updating existing push subscriptions during upsert (ON CONFLICT DO UPDATE)
CREATE POLICY push_sub_update ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member())
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member());

CREATE POLICY push_sub_delete ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

-- 6. DATABASE-ENFORCED PROTECTED COLUMN TAMPER PROTECTION TRIGGER
CREATE OR REPLACE FUNCTION public.enforce_suggestion_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin() THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  IF auth.uid() != OLD.submitter_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only edit your own suggestions.';
  END IF;

  IF OLD.status != 'submitted' THEN
    RAISE EXCEPTION 'Cannot edit suggestion once administrative review has commenced.';
  END IF;

  IF NEW.status != OLD.status THEN
    RAISE EXCEPTION 'Unauthorized: Submitter cannot alter suggestion status.';
  END IF;

  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Unauthorized: Submitter cannot alter administrative notes.';
  END IF;

  IF NEW.admin_response IS DISTINCT FROM OLD.admin_response THEN
    RAISE EXCEPTION 'Unauthorized: Submitter cannot alter administrative response.';
  END IF;

  IF NEW.converted_task_id IS DISTINCT FROM OLD.converted_task_id THEN
    RAISE EXCEPTION 'Unauthorized: Submitter cannot convert suggestion to task.';
  END IF;

  IF NEW.submitter_id != OLD.submitter_id THEN
    RAISE EXCEPTION 'Unauthorized: Suggestion submitter cannot be changed.';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_suggestion_update_rules ON public.suggestions;
CREATE TRIGGER trg_enforce_suggestion_update_rules
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_suggestion_update_rules();

-- 7. UPDATE redeem_invitation_atomic TO INSERT INTO workspace_members
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
  v_email_confirmed_at TIMESTAMPTZ;
  v_is_verified_super_admin BOOLEAN := FALSE;
  v_proj_id UUID;
  v_proj_role public.project_member_role := 'collaborator';
  v_can_tasks BOOLEAN := TRUE;
  v_can_docs BOOLEAN := TRUE;
  v_can_metrics BOOLEAN := TRUE;
  v_can_members BOOLEAN := FALSE;
  v_clean_input TEXT := TRIM(p_token_hash);
  v_lookup_hash TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to redeem workspace invitation.';
  END IF;

  IF v_clean_input IS NULL OR v_clean_input = '' THEN
    RAISE EXCEPTION 'Invalid or missing invitation token.';
  END IF;

  SELECT LOWER(email), email_confirmed_at
  INTO v_caller_email, v_email_confirmed_at
  FROM auth.users
  WHERE id = v_caller_id;

  IF v_caller_email IS NULL THEN
    SELECT LOWER(email) INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;
  END IF;

  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user email could not be resolved.';
  END IF;

  IF v_clean_input ~ '^[0-9a-fA-F]{64}$' THEN
    v_lookup_hash := LOWER(v_clean_input);
  ELSE
    v_lookup_hash := encode(digest(v_clean_input, 'sha256'), 'hex');
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = v_lookup_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or unknown invitation token.';
  END IF;

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

  IF LOWER(v_caller_email) <> LOWER(v_inv.email) THEN
    RAISE EXCEPTION 'Email mismatch: This invitation was issued to %, but you are signed in as %. Please sign in with the invited email address.',
      v_inv.email, v_caller_email;
  END IF;

  v_is_verified_super_admin := (
    LOWER(v_inv.email) = 'realgauravpatel@gmail.com'
    AND v_email_confirmed_at IS NOT NULL
  );

  PERFORM set_config('debpth.allow_role_sync', 'true', true);

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
    LOWER(v_inv.email),
    COALESCE(NULLIF(TRIM(p_user_full_name), ''), SPLIT_PART(v_inv.email, '@', 1)),
    CASE
      WHEN v_is_verified_super_admin THEN 'super_admin'::public.user_workspace_role
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

  -- Register user as a verified workspace member
  INSERT INTO public.workspace_members (user_id, role, joined_at, invited_by)
  VALUES (
    v_caller_id,
    CASE
      WHEN v_is_verified_super_admin THEN 'super_admin'
      ELSE 'member'
    END,
    now(),
    v_inv.invited_by
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role;

  -- Scope-specific project membership granting
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

  UPDATE public.invitations
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = v_caller_id
  WHERE id = v_inv.id;

  INSERT INTO public.activity_logs (project_id, user_id, action, details, created_at)
  VALUES (
    v_inv.project_id,
    v_caller_id,
    'invitation_accepted',
    v_inv.email || ' accepted invitation for ' || v_inv.scope || ' access',
    now()
  );

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
    'message', 'Invitation redeemed successfully.',
    'email', v_inv.email,
    'scope', v_inv.scope,
    'projectId', v_inv.project_id,
    'role', v_inv.role,
    'assigned_projects', COALESCE(v_inv.assigned_project_ids, ARRAY[]::UUID[])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invitation_atomic(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_atomic(TEXT, TEXT) TO authenticated, service_role;

-- 7.1 HARDENED INVITATION CREATION, INSPECTION, REVOCATION & PROJECT DELETION RPCS
-- Ensures token = NULL, safe make_interval, hash-only lookup, and fail-closed MFA project deletion even on older baselines.

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

  v_expires_at := now() + make_interval(days => p_expires_in_days);

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
    'member'::public.user_workspace_role,
    NULL,
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

  v_expires_at := now() + make_interval(days => p_expires_in_days);

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
    NULL,
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

  IF v_clean_input ~ '^[0-9a-fA-F]{64}$' THEN
    v_lookup_hash := LOWER(v_clean_input);
  ELSE
    v_lookup_hash := encode(digest(v_clean_input, 'sha256'), 'hex');
  END IF;

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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to delete a project.';
  END IF;

  SELECT email, role INTO v_user_email, v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR LOWER(v_user_email) != 'realgauravpatel@gmail.com' OR v_user_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Project deletion is restricted exclusively to the Super Admin (realgauravpatel@gmail.com).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = v_user_id AND status = 'verified' AND factor_type = 'totp'
  ) THEN
    RAISE EXCEPTION 'MFA mandatory: A verified TOTP authenticator factor must be enrolled on the Super Admin account before deleting projects.';
  END IF;

  IF COALESCE(auth.jwt()->>'aal', 'aal1') != 'aal2' THEN
    RAISE EXCEPTION 'MFA step-up verification required: An active TOTP challenge must be verified in this session (AAL2 required) to delete projects.';
  END IF;

  SELECT name INTO v_project_name
  FROM public.projects
  WHERE id = target_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or already deleted.';
  END IF;

  SELECT COUNT(*) INTO v_task_count FROM public.tasks WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_doc_count FROM public.documents WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_member_count FROM public.project_members WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_inv_count FROM public.invitations WHERE project_id = target_project_id;

  DELETE FROM public.document_access_grants
  WHERE document_id IN (SELECT id FROM public.documents WHERE project_id = target_project_id);
  DELETE FROM public.tasks WHERE project_id = target_project_id;
  DELETE FROM public.milestones WHERE project_id = target_project_id;
  DELETE FROM public.documents WHERE project_id = target_project_id;
  DELETE FROM public.project_members WHERE project_id = target_project_id;
  DELETE FROM public.invitations WHERE project_id = target_project_id;
  UPDATE public.suggestions SET project_id = NULL WHERE project_id = target_project_id;
  DELETE FROM public.activity_logs WHERE project_id = target_project_id;
  DELETE FROM public.projects WHERE id = target_project_id;

  INSERT INTO public.activity_logs (
    id, project_id, user_id, action, details, created_at
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

REVOKE ALL ON FUNCTION public.create_workspace_invitation(TEXT, public.user_workspace_role, TEXT[], UUID[], INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace_invitation(TEXT, public.user_workspace_role, TEXT[], UUID[], INT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_project_invitation(UUID, TEXT, public.project_member_role, JSONB, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_invitation(UUID, TEXT, public.project_member_role, JSONB, INT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.revoke_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.inspect_invitation_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspect_invitation_by_token(TEXT) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_invitation_safe(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation_safe(TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_invitation_safe(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_safe(TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.secure_delete_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secure_delete_project(UUID) TO authenticated, service_role;

-- 8. PUSH NOTIFICATION WEBHOOK TRIGGER HELPER
CREATE OR REPLACE FUNCTION public.notify_push_subscribers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_subscribers ON public.notifications;
CREATE TRIGGER trg_notify_push_subscribers
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_subscribers();

-- 9. TWO-PHASE DURABLE WEBHOOK IDEMPOTENCY / REPLAY SUPPRESSION
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days'),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.processed_webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days');

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_time ON public.processed_webhook_events(processed_at);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_expires ON public.processed_webhook_events(expires_at);
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Deny access to anon and authenticated; only service_role backend can access
DROP POLICY IF EXISTS pwe_service_role ON public.processed_webhook_events;
CREATE POLICY pwe_service_role ON public.processed_webhook_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_webhook_event(p_event_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.processed_webhook_events%ROWTYPE;
BEGIN
  -- Prune expired idempotency entries without deleting active processing leases
  DELETE FROM public.processed_webhook_events
  WHERE expires_at < now() AND status <> 'processing';

  SELECT * INTO v_existing
  FROM public.processed_webhook_events
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.processed_webhook_events (
      event_id, status, attempts, claimed_at, expires_at, processed_at
    ) VALUES (
      p_event_id, 'processing', 1, now(), now() + interval '7 days', now()
    );
    RETURN 'claimed';
  END IF;

  IF v_existing.status = 'completed' THEN
    RETURN 'already_completed';
  END IF;

  IF v_existing.status = 'processing' AND v_existing.claimed_at > (now() - interval '2 minutes') THEN
    RETURN 'in_progress';
  END IF;

  -- Failed or stale processing lease: reclaim for retry
  UPDATE public.processed_webhook_events
  SET status = 'processing',
      attempts = attempts + 1,
      claimed_at = now(),
      last_error = NULL
  WHERE event_id = p_event_id;

  RETURN 'reclaimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_webhook_event(
  p_event_id TEXT,
  p_status TEXT,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.processed_webhook_events
  SET status = CASE WHEN p_status IN ('completed', 'failed') THEN p_status ELSE 'failed' END,
      completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
      processed_at = now(),
      last_error = LEFT(p_error, 500)
  WHERE event_id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_event(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.complete_webhook_event(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_webhook_event(TEXT, TEXT, TEXT) TO service_role;

-- 10. REALTIME PUBLICATION CONFIGURATION (Idempotent across all workspace tables)
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'profiles',
    'workspace_members',
    'projects',
    'project_members',
    'invitations',
    'milestones',
    'tasks',
    'documents',
    'document_access_grants',
    'suggestions',
    'ideas',
    'announcements',
    'notifications',
    'activity_logs'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END $$;
