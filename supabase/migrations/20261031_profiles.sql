create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  warframe_account text not null default '',
  mastery integer,
  collection jsonb not null default '{"parts":[],"built":[],"items":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Lee su lista" on public.profiles;
drop policy if exists "Crea su lista" on public.profiles;
drop policy if exists "Actualiza su lista" on public.profiles;

create policy "Lee su lista"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Crea su lista"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Actualiza su lista"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
