# E-Skedyul Admin Backend with Supabase

This backend is aligned with the existing `UI-Testing` React frontend in `R-Uygioco/E-SkedyulniRaymund`. The repository already contains `src/features/admin/admin.tsx`, `login.tsx`, `useAdmin.ts`, `types.ts`, and `data.ts`; this backend provides the API and Supabase services those files need when moved from local demo state to persisted data.

## Architecture

React + Supabase Auth
-> FastAPI
-> Supabase PostgreSQL

Supabase Auth owns administrator identity and sessions. FastAPI validates the access token and checks the admin profile. PostgreSQL stores the admin profile, organizations, and events. RLS policies are included for direct Supabase access.

Supabase's current Python client supports creating a client with `create_client()`, retrieving a user from a supplied JWT with `auth.get_user(jwt)`, and server-only Auth Admin methods with a secret key. The backend follows those patterns.

## Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `schema.sql`.
4. Optionally run `seed.sql`.
5. Copy `.env.example` to `.env`.
6. Put the Supabase Postgres connection string from the Supabase Connect panel into `DATABASE_URL`.
7. Put the project URL and publishable key into `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
8. Put the server-only secret key into `SUPABASE_SECRET_KEY`. Never put this value in the React app.
9. Create an initial administrator with `scripts/create_admin.py`.

The application loads `.env` automatically at startup. Keep real credentials in
`.env`; do not commit that file. `tzdata` is installed as a dependency so IANA
organization timezones work consistently on Windows as well as Linux.

## Windows

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
python scripts/create_admin.py
uvicorn admin.app:app --reload --host 127.0.0.1 --port 8000
```

## Admin login

The current repository UI uses a `username` field. The backend accepts that username and looks it up in `admin_profiles`, then authenticates the matching email through Supabase Auth. This keeps the UI field compatible while moving the actual credentials to Supabase.

The first administrator can therefore sign in using the existing UI values only after the matching Supabase Auth user and `admin_profiles` row have been created.

## Security

Do not expose `SUPABASE_SECRET_KEY` to the frontend. Browser code should use only the publishable key. Every protected admin request must send the Supabase access token as a Bearer token. The backend checks the token with Supabase Auth and then checks the `admin_profiles` role and active state.

## Important integration note

The existing `UI-Testing` frontend is currently a prototype. `useAdmin.ts` stores organizations/events in React state, and `login.tsx` contains hardcoded demo credentials. This backend intentionally does not overwrite those files. Replace their local operations with API calls during frontend-backend integration.
