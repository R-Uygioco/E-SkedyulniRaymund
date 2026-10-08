# Supabase Setup

The app uses Supabase Auth and Postgres when both Vite environment variables are set. Without them, it continues to run with local demo data.

## Configure the project

1. Create a Supabase project.
2. In Authentication settings, enable anonymous sign-ins. The app currently uses anonymous accounts so members do not need email/password credentials; clearing app data loses access to that anonymous account.
3. Run `supabase/migrations/202610080001_initial_schema.sql` in the Supabase SQL Editor. It preserves table rows but replaces existing RLS policies on the app's tables with the policies defined in the migration.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings > API. Never put a service-role key in the client environment.
5. Restart the Vite dev server or rebuild the app.

The migration creates the four sample groups used by onboarding. Group codes are `LECT-2024`, `ALTAR-01`, `CHOIR-A`, and `YOUTH-GRP`.

## Bootstrap leaders and slots

There is not yet a coordinator UI. A leader must first join a group from the app. In Supabase Table Editor, find their row in `group_members`, then set `role` to `leader` and `status` to `approved`. Add slots through the SQL Editor, replacing the group code and details:

```sql
insert into public.slots (group_id, date, start_time, label, total_spots)
select id, '2026-11-01', '09:00', 'Sunday Mass', 3
from public.groups
where code = 'LECT-2024';
```

To approve a member, set that member's `group_members.status` to `approved`. The app checks membership status whenever the member taps **Check approval status**. The `approve_group_member` RPC and leader-only RLS policies are available for a future coordinator interface.

Availability is private to its owner. Group slots are visible to approved members, and volunteering/cancellation is handled by database functions. `volunteer_for_slot` locks the slot row so concurrent claims cannot exceed its capacity.

## Android builds

Vite bakes `VITE_*` values into the web bundle. Set the same variables before running `npm run android:sync`; do not commit `.env.local` or publish a service-role key.