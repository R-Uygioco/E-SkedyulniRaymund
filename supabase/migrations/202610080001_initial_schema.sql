create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'leader')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  days text[] not null,
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table if not exists public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  type text not null check (type in ('free', 'blocked')),
  start_time time,
  end_time time,
  check ((type = 'blocked') or (start_time is not null and end_time is not null and start_time < end_time))
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  start_time time not null,
  mass_name text not null,
  role text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  date date not null,
  start_time time not null,
  label text not null,
  total_spots integer not null check (total_spots > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.slot_volunteers (
  slot_id uuid not null references public.slots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (slot_id, user_id)
);

create index if not exists availability_rules_member_idx on public.availability_rules (group_id, user_id);
create index if not exists availability_overrides_member_idx on public.availability_overrides (group_id, user_id, date);
create index if not exists slots_group_date_idx on public.slots (group_id, date, start_time);

create or replace function public.is_approved_member(target_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.is_group_leader(target_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid() and role = 'leader' and status = 'approved'
  );
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_overrides enable row level security;
alter table public.assignments enable row level security;
alter table public.slots enable row level security;
alter table public.slot_volunteers enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'groups', 'group_members', 'availability_rules',
        'availability_overrides', 'assignments', 'slots', 'slot_volunteers'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I',
      existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  end loop;
end;
$$;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "groups read own membership" on public.groups;
create policy "groups read own membership" on public.groups for select to authenticated
  using (exists (
    select 1 from public.group_members where group_id = id and user_id = auth.uid()
  ));
drop policy if exists "members read self or leaders" on public.group_members;
drop policy if exists "members read self" on public.group_members;
create policy "members read self" on public.group_members for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "leaders update membership" on public.group_members;
create policy "leaders update membership" on public.group_members for update to authenticated
  using (public.is_group_leader(group_id)) with check (public.is_group_leader(group_id));

drop policy if exists "members manage own recurring availability" on public.availability_rules;
create policy "members manage own recurring availability" on public.availability_rules for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member(group_id))
  with check (user_id = auth.uid() and public.is_approved_member(group_id));
drop policy if exists "members manage own availability overrides" on public.availability_overrides;
create policy "members manage own availability overrides" on public.availability_overrides for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member(group_id))
  with check (user_id = auth.uid() and public.is_approved_member(group_id));
drop policy if exists "members read own assignments" on public.assignments;
create policy "members read own assignments" on public.assignments for select to authenticated
  using (user_id = auth.uid() and public.is_approved_member(group_id));
drop policy if exists "leaders manage group assignments" on public.assignments;
create policy "leaders manage group assignments" on public.assignments for all to authenticated
  using (public.is_group_leader(group_id)) with check (public.is_group_leader(group_id));
drop policy if exists "members read group slots" on public.slots;
create policy "members read group slots" on public.slots for select to authenticated using (public.is_approved_member(group_id));
drop policy if exists "leaders manage group slots" on public.slots;
create policy "leaders manage group slots" on public.slots for all to authenticated
  using (public.is_group_leader(group_id)) with check (public.is_group_leader(group_id));
drop policy if exists "members read own volunteer rows" on public.slot_volunteers;
create policy "members read own volunteer rows" on public.slot_volunteers for select to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.groups to authenticated;
grant select, update on public.group_members to authenticated;
grant select, insert, update, delete on public.availability_rules to authenticated;
grant select, insert, update, delete on public.availability_overrides to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.slots to authenticated;
grant select on public.slot_volunteers to authenticated;

create or replace function public.join_group_by_code(group_code text)
returns table (joined_group_id uuid, joined_group_name text, membership_status text)
language plpgsql security definer
set search_path = public
as $$
declare
  selected_group public.groups%rowtype;
  current_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into selected_group from public.groups where code = upper(trim(group_code));
  if not found then raise exception 'group_not_found'; end if;
  insert into public.group_members (group_id, user_id) values (selected_group.id, auth.uid())
    on conflict (group_id, user_id) do nothing;
  select status into current_status from public.group_members
    where group_id = selected_group.id and user_id = auth.uid();
  return query select selected_group.id, selected_group.name, current_status;
end;
$$;

create or replace function public.approve_group_member(target_group uuid, target_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_group_leader(target_group) then raise exception 'leader_required'; end if;
  update public.group_members set status = 'approved'
    where group_id = target_group and user_id = target_user and status = 'pending';
end;
$$;

create or replace function public.list_group_slots(target_group uuid)
returns table (
  slot_id uuid,
  slot_date date,
  slot_time time,
  slot_label text,
  spot_limit integer,
  spots_filled bigint,
  member_volunteering boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_approved_member(target_group) then raise exception 'approved_membership_required'; end if;
  return query
    select s.id, s.date, s.start_time, s.label, s.total_spots,
      count(v.user_id), coalesce(bool_or(v.user_id = auth.uid()), false)
    from public.slots s
    left join public.slot_volunteers v on v.slot_id = s.id
    where s.group_id = target_group
    group by s.id
    order by s.date, s.start_time;
end;
$$;

create or replace function public.volunteer_for_slot(target_slot uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  selected_slot public.slots%rowtype;
  volunteer_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into selected_slot from public.slots where id = target_slot for update;
  if not found then raise exception 'slot_not_found'; end if;
  if not public.is_approved_member(selected_slot.group_id) then raise exception 'approved_membership_required'; end if;
  if exists (select 1 from public.slot_volunteers where slot_id = target_slot and user_id = auth.uid()) then return; end if;
  select count(*) into volunteer_count from public.slot_volunteers where slot_id = target_slot;
  if volunteer_count >= selected_slot.total_spots then raise exception 'slot_full'; end if;
  insert into public.slot_volunteers (slot_id, user_id) values (target_slot, auth.uid());
end;
$$;

create or replace function public.cancel_slot_volunteer(target_slot uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.slot_volunteers where slot_id = target_slot and user_id = auth.uid();
end;
$$;

grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.approve_group_member(uuid, uuid) to authenticated;
grant execute on function public.list_group_slots(uuid) to authenticated;
grant execute on function public.volunteer_for_slot(uuid) to authenticated;
grant execute on function public.cancel_slot_volunteer(uuid) to authenticated;
revoke all on function public.is_approved_member(uuid) from public;
revoke all on function public.is_group_leader(uuid) from public;
revoke all on function public.join_group_by_code(text) from public;
revoke all on function public.approve_group_member(uuid, uuid) from public;
revoke all on function public.list_group_slots(uuid) from public;
revoke all on function public.volunteer_for_slot(uuid) from public;
revoke all on function public.cancel_slot_volunteer(uuid) from public;
grant execute on function public.is_approved_member(uuid) to authenticated;
grant execute on function public.is_group_leader(uuid) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.approve_group_member(uuid, uuid) to authenticated;
grant execute on function public.list_group_slots(uuid) to authenticated;
grant execute on function public.volunteer_for_slot(uuid) to authenticated;
grant execute on function public.cancel_slot_volunteer(uuid) to authenticated;

insert into public.groups (name, code) values
  ('Lectors Ministry', 'LECT-2024'),
  ('Altar Servers', 'ALTAR-01'),
  ('Parish Choir', 'CHOIR-A'),
  ('Youth Ministry', 'YOUTH-GRP')
on conflict (code) do nothing;