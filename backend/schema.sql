CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL DEFAULT '',
    role VARCHAR(30) NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organizations (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    contact_email VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(50) NOT NULL DEFAULT '',
    timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Manila',
    address VARCHAR(255) NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    join_code VARCHAR(32) NOT NULL DEFAULT (
        'ESK-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12))
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.events (
    id VARCHAR(40) PRIMARY KEY,
    organization_id VARCHAR(40) NOT NULL
        REFERENCES public.organizations(id) ON DELETE RESTRICT,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    location VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 50 CHECK (capacity >= 1),
    registration_deadline TIMESTAMPTZ,
    visibility VARCHAR(20) NOT NULL DEFAULT 'members'
        CHECK (visibility IN ('public', 'members')),
    recurrence VARCHAR(20) NOT NULL DEFAULT 'none'
        CHECK (recurrence IN ('none', 'weekly', 'monthly')),
    repeat_until TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT events_valid_range CHECK (ends_at > starts_at),
    CONSTRAINT events_valid_registration
        CHECK (registration_deadline IS NULL OR registration_deadline <= starts_at),
    CONSTRAINT events_valid_recurrence
        CHECK (
            (recurrence = 'none' AND repeat_until IS NULL)
            OR (recurrence <> 'none' AND repeat_until IS NOT NULL)
        )
);

-- Admin assignments are separate from ordinary member accounts.
CREATE TABLE IF NOT EXISTS public.organization_members (
    organization_id VARCHAR(40) NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES public.admin_profiles(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

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

CREATE TABLE IF NOT EXISTS public.organization_join_requests (
    id VARCHAR(40) PRIMARY KEY,
    organization_id VARCHAR(40) NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    member_user_id UUID NULL
        REFERENCES public.member_profiles(user_id) ON DELETE SET NULL,
    member_name VARCHAR(150) NOT NULL,
    submitted_join_code VARCHAR(32) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ NULL,
    reviewed_by UUID NULL
        REFERENCES public.admin_profiles(user_id) ON DELETE SET NULL,
    reviewer_note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_admin_profiles_username
    ON public.admin_profiles(username);
CREATE INDEX IF NOT EXISTS idx_organizations_status
    ON public.organizations(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_join_code_ci
    ON public.organizations(upper(join_code));
CREATE INDEX IF NOT EXISTS idx_events_organization
    ON public.events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_starts_at
    ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_status
    ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_organization_members_user
    ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS ix_join_requests_organization
    ON public.organization_join_requests(organization_id);
CREATE INDEX IF NOT EXISTS ix_join_requests_status_requested
    ON public.organization_join_requests(status, requested_at DESC);
-- Authenticated members are deduplicated by identity; anonymous requests
-- are deduplicated by normalized name because they have no user ID.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_join_request_by_member
    ON public.organization_join_requests(organization_id, member_user_id)
    WHERE status = 'pending' AND member_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_join_request_anonymous_by_name
    ON public.organization_join_requests(organization_id, lower(member_name))
    WHERE status = 'pending' AND member_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_member_profiles_email
    ON public.member_profiles(email);

CREATE INDEX IF NOT EXISTS idx_organization_member_accounts_user
    ON public.organization_member_accounts(user_id);

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_profiles
        WHERE user_id = uid AND role = 'admin' AND active = TRUE
    );
$$;

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_member_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_profile_self_read ON public.admin_profiles;
CREATE POLICY admin_profile_self_read ON public.admin_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_manage_organizations ON public.organizations;
CREATE POLICY admin_manage_organizations ON public.organizations
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_manage_events ON public.events;
CREATE POLICY admin_manage_events ON public.events
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_manage_organization_members ON public.organization_members;
CREATE POLICY admin_manage_organization_members ON public.organization_members
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_manage_join_requests ON public.organization_join_requests;
CREATE POLICY admin_manage_join_requests ON public.organization_join_requests
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS member_read_own_join_requests ON public.organization_join_requests;
CREATE POLICY member_read_own_join_requests ON public.organization_join_requests
FOR SELECT TO authenticated
USING (member_user_id = auth.uid());

DROP POLICY IF EXISTS member_profile_read_self ON public.member_profiles;
CREATE POLICY member_profile_read_self ON public.member_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_manage_member_profiles ON public.member_profiles;
CREATE POLICY admin_manage_member_profiles ON public.member_profiles
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS member_read_own_organization_memberships ON public.organization_member_accounts;
CREATE POLICY member_read_own_organization_memberships ON public.organization_member_accounts
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS admin_manage_member_organization_accounts ON public.organization_member_accounts;
CREATE POLICY admin_manage_member_organization_accounts ON public.organization_member_accounts
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Join requests are created through FastAPI; do not grant anonymous table access.
