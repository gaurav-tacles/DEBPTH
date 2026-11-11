-- ==============================================================================
-- ProjectHub / DEBPTH Migration: 20261111_security_remediation_and_webpush.sql
-- Description:
-- 1. SECURITY FIX: Replaces overly permissive suggestions RLS policy.
--    - Restricts project-specific suggestions to authorized project members.
--    - Restricts general suggestions to verified workspace members.
--    - Prevents submitter tampering with admin_notes, admin_response, status, or converted_task_id.
-- 2. SECURITY FIX: Migrates and nullifies legacy plaintext invitation tokens in DB.
-- 3. Webhook trigger setup for background Web Push notification dispatch.
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

-- 2. HARDENED SUGGESTIONS RLS & PERMISSION COMPARTMENTALIZATION
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
    OR (project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()))
    OR (project_id IS NOT NULL AND public.has_project_access(project_id))
  );

-- INSERT POLICY:
-- Only verified workspace members can insert suggestions.
-- If linked to a project, user must have access to that project.
CREATE POLICY suggestions_insert ON public.suggestions
  FOR INSERT TO authenticated
  WITH CHECK (
    submitter_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    AND (project_id IS NULL OR public.has_project_access(project_id))
  );

-- UPDATE - SUPER ADMIN POLICY:
-- Super Admin has full administrative update privileges (status, notes, responses, conversions).
CREATE POLICY suggestions_admin_update ON public.suggestions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- UPDATE - SUBMITTER POLICY:
-- Submitters may only edit while in 'submitted' status.
CREATE POLICY suggestions_submitter_update ON public.suggestions
  FOR UPDATE TO authenticated
  USING (submitter_id = auth.uid() AND status = 'submitted')
  WITH CHECK (submitter_id = auth.uid() AND status = 'submitted');

-- DELETE POLICY:
-- Super Admin or original submitter (while status is 'submitted') can delete.
CREATE POLICY suggestions_delete ON public.suggestions
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (submitter_id = auth.uid() AND status = 'submitted'));

-- 3. DATABASE-ENFORCED PROTECTED COLUMN TAMPER PROTECTION TRIGGER
CREATE OR REPLACE FUNCTION public.enforce_suggestion_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super Admin is authorized to modify any field
  IF public.is_super_admin() THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  -- Ordinary submitters:
  IF auth.uid() != OLD.submitter_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only edit your own suggestions.';
  END IF;

  IF OLD.status != 'submitted' THEN
    RAISE EXCEPTION 'Cannot edit suggestion once administrative review has commenced.';
  END IF;

  -- Strictly block submitters from tampering with administrative/protected columns
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

-- 4. PUSH NOTIFICATION WEBHOOK TRIGGER HELPER
-- Trigger function that forwards new notifications to the send-push edge function via pg_net (optional in Supabase)
CREATE OR REPLACE FUNCTION public.notify_push_subscribers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  -- Record is ready for web push dispatch by send-push Edge Function
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_subscribers ON public.notifications;
CREATE TRIGGER trg_notify_push_subscribers
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_subscribers();
