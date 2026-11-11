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

-- 1. LEGACY INVITATION TOKEN REMEDIATION
-- Backfill any missing token_hash from existing plaintext tokens
UPDATE public.invitations
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

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

-- Backfill Super Admin into workspace_members
INSERT INTO public.workspace_members (user_id, role, joined_at)
SELECT p.id, 'super_admin', timezone('utc'::text, now())
FROM public.profiles p
WHERE LOWER(p.email) = 'realgauravpatel@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Backfill existing accepted invitations into workspace_members
INSERT INTO public.workspace_members (user_id, role, joined_at, invited_by)
SELECT i.accepted_by, COALESCE(i.role::text, 'member'), COALESCE(i.accepted_at, timezone('utc'::text, now())), i.invited_by
FROM public.invitations i
WHERE i.accepted_by IS NOT NULL AND i.status = 'accepted'
ON CONFLICT (user_id) DO NOTHING;

-- Update handle_new_user() trigger to automatically grant workspace membership to Super Admin
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

  -- Super Admin is immediately provisioned as workspace member
  IF LOWER(NEW.email) = 'realgauravpatel@gmail.com' THEN
    INSERT INTO public.workspace_members (user_id, role, joined_at)
    VALUES (NEW.id, 'super_admin', NOW())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

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
    OR submitter_id = auth.uid()
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
  USING (submitter_id = auth.uid() AND status = 'submitted')
  WITH CHECK (submitter_id = auth.uid() AND status = 'submitted');

-- DELETE POLICY:
CREATE POLICY suggestions_delete ON public.suggestions
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (submitter_id = auth.uid() AND status = 'submitted'));

-- 4. HARDENED ANNOUNCEMENTS RLS
DROP POLICY IF EXISTS announcements_select ON public.announcements;
CREATE POLICY announcements_select ON public.announcements
  FOR SELECT TO authenticated
  USING (public.is_workspace_member());

-- 5. PUSH SUBSCRIPTIONS RLS (INCLUDING MISSING UPDATE POLICY)
DROP POLICY IF EXISTS push_sub_select ON public.push_subscriptions;
DROP POLICY IF EXISTS push_sub_insert ON public.push_subscriptions;
DROP POLICY IF EXISTS push_sub_update ON public.push_subscriptions;
DROP POLICY IF EXISTS push_sub_delete ON public.push_subscriptions;

CREATE POLICY push_sub_select ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY push_sub_insert ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fixed: Allow updating existing push subscriptions during upsert (ON CONFLICT DO UPDATE)
CREATE POLICY push_sub_update ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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

  SELECT LOWER(email) INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
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

  -- Register user as a verified workspace member
  INSERT INTO public.workspace_members (user_id, role, joined_at, invited_by)
  VALUES (
    v_caller_id,
    CASE 
      WHEN LOWER(v_inv.email) = 'realgauravpatel@gmail.com' THEN 'super_admin'
      ELSE COALESCE(v_inv.role::text, 'member')
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
    jsonb_build_object(
      'email', v_inv.email,
      'scope', v_inv.scope,
      'role', v_inv.role,
      'invitation_id', v_inv.id
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invitation redeemed successfully.',
    'scope', v_inv.scope,
    'role', v_inv.role,
    'assigned_projects', COALESCE(v_inv.assigned_project_ids, ARRAY[]::UUID[])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invitation_atomic(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_atomic(TEXT, TEXT) TO authenticated, service_role;

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
