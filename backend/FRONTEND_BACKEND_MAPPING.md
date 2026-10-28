# Admin Frontend-to-Backend Mapping

This document describes the Admin API integration present in this branch. It is not a description of the separate Wizard, Account, or Management frontend modules.

## Request flow

React Admin frontend -> shared `src/lib/api.ts` helper -> FastAPI -> Supabase Auth / Supabase PostgreSQL.

- `src/features/admin/login.tsx` submits the username and password to `POST /admin/auth/login`.
- The backend finds an active Admin profile, authenticates its email through Supabase Auth, and returns the access token and administrator identity.
- `src/lib/api.ts` adds the Bearer token to protected requests and clears it when a request returns HTTP 401.
- `src/features/admin/useAdmin.ts` loads initial data from `GET /admin/dashboard/bootstrap` and calls the API for Admin operations.

## Endpoint groups

### Authentication and dashboard

- `POST /admin/auth/login`
- `POST /admin/auth/logout`
- `GET /admin/dashboard`
- `GET /admin/dashboard/bootstrap`

### Organizations

- `GET /admin/organizations`
- `POST /admin/organizations`
- `GET /admin/organizations/{organization_id}`
- `PUT /admin/organizations/{organization_id}`
- `PATCH /admin/organizations/{organization_id}/toggle-status`
- `DELETE /admin/organizations/{organization_id}`
- `POST /admin/organizations/{organization_id}/regenerate-join-code`
- `GET /admin/organizations/{organization_id}/members`
- `GET /admin/organizations/{organization_id}/assignable-administrators`
- `POST /admin/organizations/{organization_id}/members/{user_id}`
- `DELETE /admin/organizations/{organization_id}/members/{user_id}`

### Events

- `GET /admin/events`
- `POST /admin/events`
- `GET /admin/events/{event_id}`
- `PUT /admin/events/{event_id}`
- `POST /admin/events/{event_id}/duplicate`
- `POST /admin/events/{event_id}/cancel`
- `DELETE /admin/events/{event_id}`
- `POST /admin/events/conflicts`

Event datetimes are interpreted in the organization's configured time zone. API responses use the camelCase fields defined in `src/features/admin/types.ts`.

### Join requests

- `POST /public/join-requests` submits a request using a member name and join code.
- `GET /public/join-requests/{request_id}` returns its status.
- `GET /admin/join-requests?status={pending|approved|rejected|all}` lists requests for administrators.
- `PATCH /admin/join-requests/{request_id}/decision` records approval or rejection.
- `DELETE /admin/join-requests/{request_id}` deletes a request.

**Member approval behavior:** `organization_members` is reserved for administrator assignments. Ordinary members use `member_profiles` and `organization_member_accounts`. The public join-request endpoint continues to support anonymous submissions, but those requests only record a decision when approved. If a request includes a valid Supabase member access token in its `Authorization: Bearer` header, the backend links it to the authenticated member, and approval creates an `organization_member_accounts` membership transactionally. The Wizard frontend must send the authenticated member token to benefit from this flow. Requests are never associated with a user ID submitted in the JSON body.

For an existing database that already ran the original schema and migration 001, run `backend/migrations/002_member_identity_and_memberships.sql`. For new installations, use the updated `backend/schema.sql`.

## Configuration and local checks

Copy `backend/.env.example` to `backend/.env`, configure Supabase/database credentials, and set `VITE_API_URL` in the frontend environment if the backend is not running at `http://127.0.0.1:8000`. Keep actual credentials out of Git.

Run `pnpm exec tsc --noEmit` and `pnpm build` from the repository root. Run `python -m pytest` from the `backend` directory.
