-- =====================================================================
-- Operations Workspace: multi-tenant schema (Supabase / Postgres)
-- Safe to run more than once. Does not touch the older tables
-- (workspaces, team_members, clients, tasks).
-- =====================================================================

create extension if not exists pgcrypto;

-- One row per workspace (company / tenant).
create table if not exists public.app_workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Who can open a workspace. Rows are created by the owner (invites, keyed by
-- email) and claimed by the matching Supabase user on their first login.
create table if not exists public.app_members (
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  email        text not null check (email = lower(email)),
  user_id      uuid references auth.users(id) on delete set null,
  person_id    text not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, email)
);
create index if not exists app_members_user_idx on public.app_members(user_id);
create index if not exists app_members_email_idx on public.app_members(email);

-- All workspace data. coll = collection (tasks, ledger, clients, people, ...,
-- or _doc for small settings lists), id = record id inside that collection.
create table if not exists public.app_items (
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  coll         text not null,
  id           text not null,
  data         jsonb,
  deleted      boolean not null default false,
  seq          bigserial,
  client_id    text,
  updated_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, coll, id)
);
create index if not exists app_items_ws_seq_idx on public.app_items(workspace_id, seq);

create or replace function public.app_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists app_items_touch on public.app_items;
create trigger app_items_touch before update on public.app_items
  for each row execute function public.app_touch();

-- ---------------------------------------------------------------------
-- Membership helpers (security definer so policies don't recurse)
-- ---------------------------------------------------------------------
create or replace function public.app_is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_members where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function public.app_is_owner(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_members where workspace_id = ws and user_id = auth.uid() and role = 'owner');
$$;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.app_workspaces enable row level security;
alter table public.app_members    enable row level security;
alter table public.app_items      enable row level security;

drop policy if exists ws_select on public.app_workspaces;
drop policy if exists ws_update on public.app_workspaces;
create policy ws_select on public.app_workspaces for select to authenticated using (app_is_member(id));
create policy ws_update on public.app_workspaces for update to authenticated using (app_is_owner(id)) with check (app_is_owner(id));

drop policy if exists mem_select on public.app_members;
drop policy if exists mem_insert on public.app_members;
drop policy if exists mem_update on public.app_members;
drop policy if exists mem_delete on public.app_members;
create policy mem_select on public.app_members for select to authenticated using (app_is_member(workspace_id));
create policy mem_insert on public.app_members for insert to authenticated with check (app_is_owner(workspace_id) and user_id is null);
create policy mem_update on public.app_members for update to authenticated using (app_is_owner(workspace_id)) with check (app_is_owner(workspace_id));
create policy mem_delete on public.app_members for delete to authenticated using (app_is_owner(workspace_id) and user_id is distinct from auth.uid());

drop policy if exists items_select on public.app_items;
drop policy if exists items_insert on public.app_items;
drop policy if exists items_update on public.app_items;
create policy items_select on public.app_items for select to authenticated using (app_is_member(workspace_id));
create policy items_insert on public.app_items for insert to authenticated with check (app_is_member(workspace_id));
create policy items_update on public.app_items for update to authenticated using (app_is_member(workspace_id)) with check (app_is_member(workspace_id));
-- No delete policy: the app soft-deletes (deleted = true) so other users get the change in realtime.

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------

-- Claims any invites for the signed-in user's confirmed email, then lists
-- the workspaces they belong to.
create or replace function public.app_my_workspaces()
returns table (workspace_id uuid, name text, person_id text, role text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_email text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select lower(u.email) into v_email from auth.users u
   where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is not null then
    update app_members m set user_id = auth.uid()
     where m.user_id is null and m.email = v_email;
  end if;
  return query
    select m.workspace_id, w.name, m.person_id, m.role
      from app_members m join app_workspaces w on w.id = m.workspace_id
     where m.user_id = auth.uid()
     order by w.created_at;
end $$;

-- Creates a workspace owned by the caller, unless they already belong to one.
create or replace function public.app_create_workspace(p_name text, p_person_id text)
returns table (id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_email text;
  v_ws uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select m.workspace_id into v_ws from app_members m where m.user_id = auth.uid() limit 1;
  if v_ws is not null then
    return query select v_ws, false;
    return;
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  insert into app_workspaces (name, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'My workspace'), auth.uid())
    returning app_workspaces.id into v_ws;
  insert into app_members (workspace_id, email, user_id, person_id, role)
    values (v_ws, v_email, auth.uid(), p_person_id, 'owner');
  return query select v_ws, true;
end $$;

revoke all on function public.app_my_workspaces() from public, anon;
revoke all on function public.app_create_workspace(text, text) from public, anon;
grant execute on function public.app_my_workspaces() to authenticated;
grant execute on function public.app_create_workspace(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: push app_items changes to everyone in the workspace
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_items'
  ) then
    alter publication supabase_realtime add table public.app_items;
  end if;
end $$;
