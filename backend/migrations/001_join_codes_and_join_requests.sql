-- E-Skedyul organization join codes and reviewable join requests.
-- Run once in the Supabase SQL Editor after the existing backend/schema.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS join_code VARCHAR(32);

ALTER TABLE public.organizations
    ALTER COLUMN join_code SET DEFAULT (
        'ESK-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12))
    );

UPDATE public.organizations
SET join_code = 'ESK-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12))
WHERE join_code IS NULL OR btrim(join_code) = '';

ALTER TABLE public.organizations
    ALTER COLUMN join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_join_code_ci
    ON public.organizations (upper(join_code));

CREATE TABLE IF NOT EXISTS public.organization_join_requests (
    id VARCHAR(40) PRIMARY KEY,
    organization_id VARCHAR(40) NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS ix_join_requests_organization
    ON public.organization_join_requests(organization_id);
CREATE INDEX IF NOT EXISTS ix_join_requests_status_requested
    ON public.organization_join_requests(status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_join_request_by_name
    ON public.organization_join_requests(organization_id, lower(member_name))
    WHERE status = 'pending';

ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

-- FastAPI serves these endpoints using the server-side DATABASE_URL.
-- Do not expose that connection string or SUPABASE_SECRET_KEY in frontend code.
-- Public request creation is enforced by FastAPI; no anonymous RLS policy is added.
