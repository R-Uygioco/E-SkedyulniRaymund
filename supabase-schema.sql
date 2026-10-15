-- ==============================================================================
-- E-Skedyul: Unified Supabase Database Schema & Setup Script
-- ==============================================================================
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

create extension if not exists pgcrypto;

-- 1. Profiles Table linked to Supabase auth.users
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  ministry text default 'Lectors',
  parish text default 'St. Joseph Parish',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Organizations Table (Parishes / Chapels / Ministries)
create table if not exists public.organizations (
  id varchar(40) primary key,
  name varchar(150) not null unique,
  description text not null default '',
  contact_email varchar(255) not null default '',
  phone varchar(50) not null default '',
  timezone varchar(80) not null default 'Asia/Manila',
  address varchar(255) not null default '',
  category varchar(100) not null default 'General',
  status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- 3. Events Table (Schedules & Liturgical Celebrations)
create table if not exists public.events (
  id varchar(40) primary key,
  organization_id varchar(40) not null references public.organizations(id) on delete restrict,
  title varchar(180) not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location varchar(255) not null,
  capacity integer not null default 50 check (capacity >= 1),
  registration_deadline timestamptz,
  visibility varchar(20) not null default 'members' check (visibility in ('public', 'members')),
  recurrence varchar(20) not null default 'none' check (recurrence in ('none', 'weekly', 'monthly')),
  repeat_until timestamptz,
  status varchar(20) not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  constraint events_valid_range check (ends_at > starts_at),
  constraint events_valid_registration check (registration_deadline is null or registration_deadline <= starts_at),
  constraint events_valid_recurrence check ((recurrence = 'none' and repeat_until is null) or (recurrence <> 'none' and repeat_until is not null))
);

-- Indexes for performance
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_organizations_status on public.organizations(status);
create index if not exists idx_events_organization on public.events(organization_id);
create index if not exists idx_events_starts_at on public.events(starts_at);
create index if not exists idx_events_status on public.events(status);

-- Helper function to check if the current user is an admin
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = uid
      and role = 'admin'
  );
$$;

-- 4. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.events enable row level security;

-- 5. Define RLS Policies

-- PROFILES Policies:
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin(auth.uid()));

-- ORGANIZATIONS Policies:
drop policy if exists "Organizations are viewable by authenticated users" on public.organizations;
create policy "Organizations are viewable by authenticated users"
  on public.organizations
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage organizations" on public.organizations;
create policy "Admins can manage organizations"
  on public.organizations
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- EVENTS Policies:
drop policy if exists "Events viewable by authenticated users" on public.events;
create policy "Events viewable by authenticated users"
  on public.events
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events"
  on public.events
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 6. Automatic Profile Trigger on Auth Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'member')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = coalesce(excluded.role, public.profiles.role);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Starter Seed Data (Organizations & Events)
insert into public.organizations (id, name, description, contact_email, phone, timezone, address, category, status, created_at)
values
  ('st-joseph', 'St. Joseph Parish', 'A welcoming parish community serving local families and ministries.', 'office@stjoseph.example', '(02) 8123 4567', 'Asia/Manila', '24 Mabini Street, Quezon City', 'Parish', 'active', now()),
  ('holy-family', 'Holy Family Chapel', 'Community chapel coordinating worship and outreach programs.', 'admin@holyfamily.example', '(02) 8456 7890', 'Asia/Manila', '18 Sampaguita Road, Makati City', 'Chapel', 'active', now()),
  ('sacred-heart', 'Sacred Heart Community', 'Faith community supporting youth and neighborhood programs.', 'hello@sacredheart.example', '(02) 8789 0123', 'Asia/Manila', '7 Rizal Avenue, Pasig City', 'Community', 'inactive', now())
on conflict (id) do nothing;

insert into public.events (id, organization_id, title, description, starts_at, ends_at, location, capacity, registration_deadline, visibility, recurrence, repeat_until, status, created_at)
values
  ('sunday-mass', 'st-joseph', 'Sunday Mass', 'Weekly parish celebration with assigned liturgical ministries.', now() + interval '3 days', now() + interval '3 days 1 hour 30 minutes', 'Main Church', 240, now() + interval '2 days', 'public', 'weekly', now() + interval '90 days', 'published', now()),
  ('choir-rehearsal', 'st-joseph', 'Choir Rehearsal', 'Final rehearsal for the Sunday liturgy.', now() + interval '2 days', now() + interval '2 days 2 hours', 'Parish Hall', 40, now() + interval '1 day', 'members', 'weekly', now() + interval '90 days', 'published', now()),
  ('youth-assembly', 'holy-family', 'Youth Ministry Assembly', 'Monthly formation and planning session.', now() + interval '7 days', now() + interval '7 days 2 hours', 'Formation Room', 60, now() + interval '6 days', 'members', 'monthly', now() + interval '180 days', 'draft', now())
on conflict (id) do nothing;
