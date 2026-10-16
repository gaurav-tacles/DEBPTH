-- ==============================================================================
-- ProjectHub / DEBPTH Migration: 20261013_secure_project_deletion.sql
-- Description:
-- 1. Adds secure_delete_project RPC function for atomic, cascading deletion
--    of projects and dependent entities (tasks, milestones, documents, grants,
--    members, invitations, activity logs).
-- 2. Enforces strict Super Admin authorization and genuine MFA step-up verification.
-- ==============================================================================

-- 1. Ensure projects table has strict DELETE policy
DROP POLICY IF EXISTS projects_delete_super_admin ON public.projects;

CREATE POLICY projects_delete_super_admin ON public.projects
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    AND LOWER((SELECT email FROM public.profiles WHERE id = auth.uid())) = 'realgauravpatel@gmail.com'
  );

-- 2. Secure Atomic Cascading Project Deletion Function
CREATE OR REPLACE FUNCTION public.secure_delete_project(target_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Verification 2: Retrieve caller profile and verify Super Admin
  SELECT email, role INTO v_user_email, v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR LOWER(v_user_email) != 'realgauravpatel@gmail.com' OR v_user_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Project deletion is restricted exclusively to the Super Admin (realgauravpatel@gmail.com).';
  END IF;

  -- Verification 3: Genuine MFA Step-Up Check
  -- If user has enrolled MFA in Supabase Auth, verify that the current session has completed TOTP verification (AAL2 level in JWT)
  IF EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = v_user_id AND status = 'verified'
  ) THEN
    IF COALESCE(auth.jwt()->>'aal', 'aal1') != 'aal2' THEN
      RAISE EXCEPTION 'MFA verification required: An active TOTP challenge must be verified before deleting projects (AAL2 required).';
    END IF;
  END IF;

  -- Verification 4: Locate target project
  SELECT name INTO v_project_name
  FROM public.projects
  WHERE id = target_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or already deleted.';
  END IF;

  -- Count cascading records for audit return
  SELECT COUNT(*) INTO v_task_count FROM public.tasks WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_doc_count FROM public.documents WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_member_count FROM public.project_members WHERE project_id = target_project_id;
  SELECT COUNT(*) INTO v_inv_count FROM public.invitations WHERE project_id = target_project_id;

  -- Atomic Cascading Cleanups:
  -- 1. Document access grants for documents in this project
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

  -- 7. Disassociate any suggestions pointing to this project
  UPDATE public.suggestions SET project_id = NULL WHERE project_id = target_project_id;

  -- 8. Activity logs associated with this project
  DELETE FROM public.activity_logs WHERE project_id = target_project_id;

  -- 9. Delete project entity itself
  DELETE FROM public.projects WHERE id = target_project_id;

  -- 10. Insert audit log for workspace
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
