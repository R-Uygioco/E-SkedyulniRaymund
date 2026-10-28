-- Add ordinary member identities and membership links without changing
-- administrator-to-organization assignments in public.organization_members.
-- Existing anonymous join requests are retained with member_user_id = NULL.
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.member_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NULL,
    full_name VARCHAR(150) NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_member_accounts (
    organization_id VARCHAR(40) NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES public.member_profiles(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE public.organization_join_requests
    ADD COLUMN IF NOT EXISTS member_user_id UUID NULL
        REFERENCES public.member_profiles(user_id) ON DELETE SET NULL;

-- Replace the prior case-insensitive name-only index. Authenticated requests
-- deduplicate by identity; legacy/anonymous requests deduplicate by name.
DROP INDEX IF EXISTS public.uq_pending_join_request_by_name;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_join_request_by_member
    ON public.organization_join_requests (organization_id, member_user_id)
    WHERE status = 'pending' AND member_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_join_request_anonymous_by_name
    ON public.organization_join_requests (organization_id, LOWER(member_name))
    WHERE status = 'pending' AND member_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_member_profiles_email
    ON public.member_profiles(email);

CREATE INDEX IF NOT EXISTS idx_organization_member_accounts_user
    ON public.organization_member_accounts(user_id);

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_member_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_manage_join_requests
    ON public.organization_join_requests;
CREATE POLICY admin_manage_join_requests
ON public.organization_join_requests
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS member_read_own_join_requests
    ON public.organization_join_requests;
CREATE POLICY member_read_own_join_requests
ON public.organization_join_requests
FOR SELECT TO authenticated
USING (member_user_id = auth.uid());

DROP POLICY IF EXISTS member_profile_read_self
    ON public.member_profiles;
CREATE POLICY member_profile_read_self
ON public.member_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_manage_member_profiles
    ON public.member_profiles;
CREATE POLICY admin_manage_member_profiles
ON public.member_profiles
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS member_read_own_organization_memberships
    ON public.organization_member_accounts;
CREATE POLICY member_read_own_organization_memberships
ON public.organization_member_accounts
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS admin_manage_member_organization_accounts
    ON public.organization_member_accounts;
CREATE POLICY admin_manage_member_organization_accounts
ON public.organization_member_accounts
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
