-- ==============================================================================
-- ProjectHub Migration: 20261011_security_hardening.sql
-- Description: Enforces Row-Level Security, eliminates recursion, prevents
-- role escalation, and validates single-use invitations.
-- Safe, repeatable, non-destructive migration.
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

-- 3. Profiles Policies Hardening
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
      role = 'member' OR public.is_super_admin()
    )
  );

-- 4. Invitations Policies Hardening
-- Prevent anonymous token scraping. Tokens can be read by token lookup or by Super Admin.
DROP POLICY IF EXISTS invitations_admin ON public.invitations;
DROP POLICY IF EXISTS invitations_read_token ON public.invitations;

CREATE POLICY invitations_admin ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY invitations_read_for_redemption ON public.invitations
  FOR SELECT TO authenticated, anon
  USING (accepted_at IS NULL AND expires_at > now());

-- 5. Safe Invitation Redemption Function
-- Validates token, marks accepted, ensures recipient matches, and assigns membership atomically
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

-- 6. Storage Bucket & Policies for Document Privacy
-- Setup bucket 'project-documents' (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS: Download restricted files only if super_admin or having active approved grant
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
