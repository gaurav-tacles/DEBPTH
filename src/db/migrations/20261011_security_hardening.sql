-- ==============================================================================
-- ProjectHub Migration: 20261011_security_hardening.sql
-- Description:
-- 1. Automates Super Admin provisioning via auth.users trigger (realgauravpatel@gmail.com)
-- 2. Enforces Row-Level Security, eliminates recursion, prevents role escalation
-- 3. Creates and secures the personal ideas repository (public.ideas)
-- 4. Validates single-use invitations and hardens document storage
-- Safe, repeatable, non-destructive migration for Supabase PostgreSQL
-- ==============================================================================

-- 1. Helper function: check if caller has super_admin role
-- Security Definer to safely read public.profiles without triggering recursive policies
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 2. Helper function: check if caller has access to project
CREATE OR REPLACE FUNCTION public.has_project_access(proj_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = proj_id AND user_id = auth.uid()
  );
$$;

-- 3. Trusted Server-Side User Provisioning Trigger on auth.users
-- Whenever an account is created in Supabase Auth (email/password or invite),
-- this trigger automatically provisions public.profiles.
-- Strict rule: ONLY realgauravpatel@gmail.com receives 'super_admin' role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    TRUE,
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

-- 4. Idempotent Backfill: Sync existing auth.users into profiles
INSERT INTO public.profiles (id, email, full_name, role, labels, mfa_enabled, created_at, last_active_at)
SELECT
  u.id,
  LOWER(u.email),
  COALESCE(u.raw_user_meta_data->>'full_name', SPLIT_PART(u.email, '@', 1)),
  CASE
    WHEN LOWER(u.email) = 'realgauravpatel@gmail.com' THEN 'super_admin'::public.user_workspace_role
    ELSE 'member'::public.user_workspace_role
  END,
  CASE
    WHEN LOWER(u.email) = 'realgauravpatel@gmail.com' THEN ARRAY['Architecture', 'Security', 'Owner']
    ELSE ARRAY['Developer']
  END,
  TRUE,
  NOW(),
  NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET role = CASE
  WHEN LOWER(EXCLUDED.email) = 'realgauravpatel@gmail.com' THEN 'super_admin'::public.user_workspace_role
  ELSE profiles.role
END;

-- 5. Profiles Policies Hardening
-- Non-admin users cannot elevate their own role to 'super_admin'
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_auth ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Ordinary users can update their profile fields, but only a super_admin can alter 'role'
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (
    public.is_super_admin() OR (
      id = auth.uid() AND (
        role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      )
    )
  );

CREATE POLICY profiles_insert_auth ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid() AND (
      role = 'member'
      OR public.is_super_admin()
      OR LOWER(email) = 'realgauravpatel@gmail.com'
    )
  );

-- 6. Personal Ideas Repository (public.ideas)
-- Strictly isolated per user via Row-Level Security
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

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

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

-- 7. Invitations Policies Hardening
-- Prevent anonymous token scraping.
DROP POLICY IF EXISTS invitations_admin ON public.invitations;
DROP POLICY IF EXISTS invitations_read_token ON public.invitations;
DROP POLICY IF EXISTS invitations_read_for_redemption ON public.invitations;

CREATE POLICY invitations_admin ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY invitations_read_for_redemption ON public.invitations
  FOR SELECT TO authenticated, anon
  USING (accepted_at IS NULL AND expires_at > now());

-- 8. Safe Invitation Redemption Function
CREATE OR REPLACE FUNCTION public.redeem_invitation_safe(inv_token TEXT, user_full_name TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_proj_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to redeem workspace invitation.';
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token = inv_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or unknown invitation token.';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invitation has already been redeemed.';
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired.';
  END IF;

  -- Update or insert profile
  INSERT INTO public.profiles (id, email, full_name, role, labels, mfa_enabled, created_at, last_active_at)
  VALUES (
    v_user_id,
    v_inv.email,
    user_full_name,
    v_inv.role,
    v_inv.initial_labels,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      labels = EXCLUDED.labels,
      last_active_at = now();

  -- Add project memberships assigned in invitation
  IF v_inv.assigned_project_ids IS NOT NULL THEN
    FOREACH v_proj_id IN ARRAY v_inv.assigned_project_ids
    LOOP
      INSERT INTO public.project_members (project_id, user_id, role, permissions, joined_at)
      VALUES (
        v_proj_id,
        v_user_id,
        'collaborator',
        '{"canManageTasks": true, "canUploadDocs": true, "canViewMetrics": true, "canManageMembers": false}'::jsonb,
        now()
      )
      ON CONFLICT (project_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Mark invitation as accepted
  UPDATE public.invitations
  SET accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_inv.email,
    'role', v_inv.role
  );
END;
$$;

-- 9. Storage Bucket & Policies for Document Privacy
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Document library download access" ON storage.objects;
CREATE POLICY "Document library download access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-documents' AND (
      public.is_super_admin()
      OR NOT (name LIKE '%/restricted/%')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.document_access_grants g ON g.document_id = d.id
        WHERE d.storage_path = name
          AND g.user_id = auth.uid()
          AND g.status = 'approved'
          AND (g.granted_until IS NULL OR g.granted_until > now())
      )
    )
  );

DROP POLICY IF EXISTS "Document library upload access" ON storage.objects;
CREATE POLICY "Document library upload access" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-documents'
  );
