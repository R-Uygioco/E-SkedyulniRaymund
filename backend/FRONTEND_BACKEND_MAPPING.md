# E-Skedyul Admin Frontend to Supabase Backend

The `UI-Testing` branch already contains the React admin UI under `src/features/admin/`. This backend keeps its existing data model and exposes API payloads using the camelCase field names used by the frontend types.

## Current frontend fields

Organization:
`id`, `name`, `description`, `contactEmail`, `phone`, `timezone`, `address`, `category`, `status`, `createdAt`

Event:
`id`, `organizationId`, `title`, `description`, `startsAt`, `endsAt`, `location`, `capacity`, `registrationDeadline`, `visibility`, `recurrence`, `repeatUntil`, `status`, `createdAt`

## Endpoints

`POST /admin/auth/login`

`GET /admin/dashboard`

`GET /admin/organizations`
`POST /admin/organizations`
`GET /admin/organizations/{id}`
`PUT /admin/organizations/{id}`
`PATCH /admin/organizations/{id}/toggle-status`
`DELETE /admin/organizations/{id}`

`GET /admin/events`
`POST /admin/events`
`GET /admin/events/{id}`
`PUT /admin/events/{id}`
`POST /admin/events/{id}/duplicate`
`POST /admin/events/{id}/cancel`
`DELETE /admin/events/{id}`
`POST /admin/events/conflicts`

Event date/time inputs and outputs use organization-local wall time in
`YYYY-MM-DDTHH:mm` form (with seconds only when present). `repeatUntil` uses
the date-only `YYYY-MM-DD` form expected by the frontend date input. Conflict
checks accept the event draft plus an optional `excludeId` and return
`{ "conflict": boolean, "event": AdminEvent | null }`.

Protected endpoints use `Authorization: Bearer <Supabase access token>`.

## Supabase architecture

React frontend -> Supabase Auth -> Supabase access token -> FastAPI -> Supabase PostgreSQL

The backend validates the supplied Supabase access token with Supabase Auth, then checks `public.admin_profiles` before allowing admin operations. Supabase PostgreSQL stores organizations and events. RLS policies are included in `schema.sql`.

The Supabase secret key is server-only. It is used only by `scripts/create_admin.py` for the trusted administrator bootstrap flow.

## Important frontend note

The current `UI-Testing` frontend still has local admin state in `src/features/admin/useAdmin.ts` and hardcoded demo credentials in `src/features/admin/login.tsx`. The backend retains Supabase-backed authentication and does not add a demo-credential bypass. To complete live integration, those files should call the endpoints above and use a browser Supabase client for the user session.
