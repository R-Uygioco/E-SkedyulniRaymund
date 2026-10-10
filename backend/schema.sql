create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username varchar(80) not null unique,
    email varchar(255) not null unique,
    full_name varchar(150) not null default '',
    role varchar(30) not null default 'admin' check (role = 'admin'),
    active boolean not null default true,
    created_at timestamptz not null default now()
);

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

create index if not exists idx_admin_profiles_username on public.admin_profiles(username);
create index if not exists idx_organizations_status on public.organizations(status);
create index if not exists idx_events_organization on public.events(organization_id);
create index if not exists idx_events_starts_at on public.events(starts_at);
create index if not exists idx_events_status on public.events(status);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.admin_profiles
        where user_id = uid
          and role = 'admin'
          and active = true
    );
$$;

alter table public.admin_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.events enable row level security;

drop policy if exists admin_profile_self_read on public.admin_profiles;
create policy admin_profile_self_read on public.admin_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists admin_manage_organizations on public.organizations;
create policy admin_manage_organizations on public.organizations
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists admin_manage_events on public.events;
create policy admin_manage_events on public.events
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
