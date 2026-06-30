create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text,
  name text not null,
  city text not null default '北京',
  type text not null,
  address text,
  district text,
  lat double precision,
  lng double precision,
  image_url text,
  source text,
  tags text[] not null default '{}',
  rating numeric,
  price numeric,
  duration_minutes integer,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_places_type_check check (
    type in ('scenic', 'food', 'hotel', 'shopping', 'cultural', 'other')
  ),
  constraint saved_places_user_place_unique unique (user_id, place_id)
);

create table if not exists public.trip_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null default '北京',
  title text default '北京智能行程草稿',
  status text default 'draft',
  days integer,
  budget_min numeric,
  budget_max numeric,
  pace text,
  preferences text[] not null default '{}',
  selected_place_ids uuid[] not null default '{}',
  draft_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_drafts_status_check check (status in ('draft', 'archived'))
);

create table if not exists public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null default '北京',
  title text not null default '北京智能行程',
  start_date date,
  end_date date,
  days integer not null default 1,
  budget numeric,
  score integer,
  status text default 'saved',
  cover_image_url text,
  summary text,
  weather_summary jsonb not null default '{}'::jsonb,
  preferences text[] not null default '{}',
  plan_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_trips_status_check check (status in ('saved', 'archived'))
);

create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.saved_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_index integer not null,
  date date,
  title text,
  summary text,
  weather jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_days_trip_day_unique unique (trip_id, day_index)
);

create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.saved_trips(id) on delete cascade,
  day_id uuid references public.trip_days(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_index integer not null,
  item_type text not null,
  place_id text,
  name text not null,
  city text default '北京',
  address text,
  district text,
  lat double precision,
  lng double precision,
  start_time text,
  end_time text,
  duration_minutes integer,
  transport_mode text,
  route_data jsonb not null default '{}'::jsonb,
  image_url text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_items_type_check check (
    item_type in ('scenic', 'food', 'hotel', 'transit', 'rest', 'note')
  )
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists saved_places_user_id_idx on public.saved_places (user_id);
create index if not exists saved_places_user_city_idx on public.saved_places (user_id, city);
create index if not exists trip_drafts_user_status_updated_idx on public.trip_drafts (user_id, status, updated_at desc);
create index if not exists saved_trips_user_updated_idx on public.saved_trips (user_id, updated_at desc);
create index if not exists trip_days_trip_id_idx on public.trip_days (trip_id);
create index if not exists trip_days_user_id_idx on public.trip_days (user_id);
create index if not exists trip_items_trip_id_idx on public.trip_items (trip_id);
create index if not exists trip_items_day_id_idx on public.trip_items (day_id);
create index if not exists trip_items_user_id_idx on public.trip_items (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_saved_places_updated_at on public.saved_places;
create trigger set_saved_places_updated_at
before update on public.saved_places
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_drafts_updated_at on public.trip_drafts;
create trigger set_trip_drafts_updated_at
before update on public.trip_drafts
for each row execute function public.set_updated_at();

drop trigger if exists set_saved_trips_updated_at on public.saved_trips;
create trigger set_saved_trips_updated_at
before update on public.saved_trips
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_days_updated_at on public.trip_days;
create trigger set_trip_days_updated_at
before update on public.trip_days
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_items_updated_at on public.trip_items;
create trigger set_trip_items_updated_at
before update on public.trip_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.saved_places enable row level security;
alter table public.trip_drafts enable row level security;
alter table public.saved_trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_items enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "saved_places_select_own" on public.saved_places;
create policy "saved_places_select_own"
on public.saved_places
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved_places_insert_own" on public.saved_places;
create policy "saved_places_insert_own"
on public.saved_places
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "saved_places_update_own" on public.saved_places;
create policy "saved_places_update_own"
on public.saved_places
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "saved_places_delete_own" on public.saved_places;
create policy "saved_places_delete_own"
on public.saved_places
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "trip_drafts_select_own" on public.trip_drafts;
create policy "trip_drafts_select_own"
on public.trip_drafts
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "trip_drafts_insert_own" on public.trip_drafts;
create policy "trip_drafts_insert_own"
on public.trip_drafts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "trip_drafts_update_own" on public.trip_drafts;
create policy "trip_drafts_update_own"
on public.trip_drafts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "trip_drafts_delete_own" on public.trip_drafts;
create policy "trip_drafts_delete_own"
on public.trip_drafts
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved_trips_select_own" on public.saved_trips;
create policy "saved_trips_select_own"
on public.saved_trips
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved_trips_insert_own" on public.saved_trips;
create policy "saved_trips_insert_own"
on public.saved_trips
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "saved_trips_update_own" on public.saved_trips;
create policy "saved_trips_update_own"
on public.saved_trips
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "saved_trips_delete_own" on public.saved_trips;
create policy "saved_trips_delete_own"
on public.saved_trips
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "trip_days_select_own" on public.trip_days;
create policy "trip_days_select_own"
on public.trip_days
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "trip_days_insert_own" on public.trip_days;
create policy "trip_days_insert_own"
on public.trip_days
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "trip_days_update_own" on public.trip_days;
create policy "trip_days_update_own"
on public.trip_days
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "trip_days_delete_own" on public.trip_days;
create policy "trip_days_delete_own"
on public.trip_days
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "trip_items_select_own" on public.trip_items;
create policy "trip_items_select_own"
on public.trip_items
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "trip_items_insert_own" on public.trip_items;
create policy "trip_items_insert_own"
on public.trip_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "trip_items_update_own" on public.trip_items;
create policy "trip_items_update_own"
on public.trip_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "trip_items_delete_own" on public.trip_items;
create policy "trip_items_delete_own"
on public.trip_items
for delete
to authenticated
using ((select auth.uid()) = user_id);
