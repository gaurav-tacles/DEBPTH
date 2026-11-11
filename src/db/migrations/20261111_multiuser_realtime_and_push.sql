-- ==============================================================================
-- ProjectHub / DEBPTH Migration: 20261111_multiuser_realtime_and_push.sql
-- Description:
-- 1. Creates public.push_subscriptions table for free Web Push notification delivery.
-- 2. Modifies public.invitations so raw plaintext tokens are never required in DB (token is nullable; only token_hash is strictly stored).
-- 3. Updates public.suggestions RLS so ALL authenticated workspace members can view suggestions (fixing multi-user shared data visibility bug).
-- 4. Enables Supabase Realtime publication on all core collaboration tables.
-- ==============================================================================

-- 1. Web Push Subscriptions Table (Native Browser Push API + VAPID)
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

DROP POLICY IF EXISTS push_sub_select ON public.push_subscriptions;
DROP POLICY IF EXISTS push_sub_insert ON public.push_subscriptions;
DROP POLICY IF EXISTS push_sub_delete ON public.push_subscriptions;

CREATE POLICY push_sub_select ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY push_sub_insert ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_sub_delete ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

GRANT ALL ON public.push_subscriptions TO authenticated, service_role;

-- 2. Make invitations.token nullable (ensuring raw tokens are NEVER stored in DB)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'token'
  ) THEN
    ALTER TABLE public.invitations ALTER COLUMN token DROP NOT NULL;
  END IF;
END $$;

-- 3. Fix Suggestions RLS: Allow ALL workspace members to view shared suggestions
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suggestions_select ON public.suggestions;
DROP POLICY IF EXISTS suggestions_insert ON public.suggestions;
DROP POLICY IF EXISTS suggestions_admin_update ON public.suggestions;
DROP POLICY IF EXISTS suggestions_update ON public.suggestions;
DROP POLICY IF EXISTS suggestions_delete ON public.suggestions;

-- All authenticated members can view suggestions
CREATE POLICY suggestions_select ON public.suggestions
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated members can submit suggestions
CREATE POLICY suggestions_insert ON public.suggestions
  FOR INSERT TO authenticated
  WITH CHECK (submitter_id = auth.uid());

-- Super admin or the original submitter can update suggestion
CREATE POLICY suggestions_update ON public.suggestions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR submitter_id = auth.uid())
  WITH CHECK (public.is_super_admin() OR submitter_id = auth.uid());

-- Super admin or the original submitter can delete suggestion
CREATE POLICY suggestions_delete ON public.suggestions
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR submitter_id = auth.uid());

-- 4. Enable Supabase Realtime Publication for live updates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.suggestions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.project_members;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.document_access_grants;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
