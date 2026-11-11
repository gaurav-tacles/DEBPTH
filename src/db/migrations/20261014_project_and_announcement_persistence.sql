-- ==============================================================================
-- ProjectHub / DEBPTH Migration: 20261014_project_and_announcement_persistence.sql
-- Description:
-- 1. Updates has_project_access(UUID) and can_manage_project_members(UUID) to
--    ensure project owners (owner_id = auth.uid()) retain authoritative access
--    to their own projects and memberships under Row Level Security.
-- 2. Hardens announcement and project membership RLS and table permissions.
-- ==============================================================================

-- 1. Ensure project creator/owner always has project access in RLS policies
CREATE OR REPLACE FUNCTION public.has_project_access(proj_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = proj_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = proj_id AND user_id = auth.uid()
  );
$$;

-- 2. Ensure project owner can manage project members
CREATE OR REPLACE FUNCTION public.can_manage_project_members(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id 
      AND user_id = auth.uid() 
      AND (role = 'lead' OR can_manage_members = TRUE)
  );
$$;

-- 3. Revoke default public execution & grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.has_project_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_project_members(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_project_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_project_members(UUID) TO authenticated, service_role;

-- 4. Ensure table permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
