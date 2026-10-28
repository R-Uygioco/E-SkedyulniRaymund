# E-Skedyul Admin Frontend and FastAPI Backend

This repository contains the Admin frontend and its FastAPI backend integration.

## Architecture

React Admin frontend -> FastAPI -> Supabase Auth and PostgreSQL.

The Admin login calls `POST /admin/auth/login`, and protected requests use the returned Supabase access token.

## Local setup

1. Create a Supabase project.
2. Run `schema.sql` in the SQL Editor for a new database. For an existing database, apply the appropriate migrations in order.
3. Copy `.env.example` to `.env` inside `backend/`.
4. Configure `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and initial admin settings.
5. From `backend/`, create a virtual environment and install `requirements.txt`.
6. Run `python scripts/create_admin.py` after the schema is ready.
7. Start the API with `uvicorn admin.app:app --host 0.0.0.0 --port 8000` (for local-only development, `127.0.0.1` is also fine).

Never commit `backend/.env` or expose `SUPABASE_SECRET_KEY` in the browser.

## Deploying the frontend and backend

Vercel hosts the Vite frontend; it does not automatically run the FastAPI server in `backend/`. Deploy FastAPI separately to a service that supports Python ASGI applications, and configure the frontend with the public HTTPS URL of that service.

In Vercel, open **Project Settings -> Environment Variables** and add:

- `VITE_API_URL`: the public HTTPS base URL of the deployed FastAPI service, without a trailing slash (example placeholder: `https://your-api.example.com`).
- Apply it to the **Production** environment (and Preview too if previews should call the API).

Then redeploy the frontend so Vite can include the value in the client bundle. `VITE_API_URL` is a public frontend configuration value; do not put secrets in it. Keep the Supabase secret key and database connection string in the backend host's environment variables only.

On the backend host, configure `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Set `CORS_ORIGINS` to the exact origin(s) of the deployed frontend, such as the production Vercel domain and any preview domain you intend to support. Do not include a path or trailing slash in an origin. The backend must be publicly reachable over HTTPS.

The default frontend API URL is intentionally **not** a production fallback. If `VITE_API_URL` is missing, Admin API calls show a clear configuration error instead of trying to contact localhost on each visitor's device.

Before declaring deployment complete, open the backend health endpoint `/admin/health` and verify that the service responds and the Supabase/database configuration flags are true. This is only a configuration check; perform a real Admin login and a protected dashboard request as an end-to-end test too.

## Admin login account

The frontend does not hardcode the username or password. The backend authenticates through Supabase Auth and requires a matching active row in `public.admin_profiles`. Create the initial account from `backend/` with:

```sh
python scripts/create_admin.py
```

Set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the backend environment before running this script. It also requires `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. For a demo login of username `admin` and password `admin123`, those values must be configured before creating the account, or the existing account's password must be reset in Supabase Auth. Do not use that weak password for a public production service.

## Admin features and routes

The API includes organization CRUD/status/join-code management, event CRUD/conflict checking/duplication/cancellation, administrator assignments, and join-request review. Routes are in `backend/admin/routes/`; business logic is in `backend/admin/services/`; API calls are in `src/features/admin/` and `src/lib/api.ts`.

## Member join-request behavior

`organization_members` is reserved for administrator-to-organization assignments. Ordinary members use `member_profiles` and `organization_member_accounts`.

The public join-request endpoint supports anonymous requests for compatibility. Approval of an anonymous request records the decision only. When the Wizard sends a valid Supabase member access token, the backend links the request to that member and approval creates the member's organization membership. The Wizard frontend must send the authenticated member token to use the linked flow.

For an existing Supabase database that already uses the original schema and migration 001, run `migrations/002_member_identity_and_memberships.sql`. For a new database, use the updated `schema.sql` rather than applying incremental migrations after it.

## Automated checks

Frontend checks:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

Backend checks from `backend/`:

```sh
pip install -r requirements.txt
python -m pytest
```
