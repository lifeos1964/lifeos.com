create table if not exists public.lifeos_state (
    user_id uuid primary key references auth.users(id) on delete cascade,
    state jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.lifeos_state enable row level security;

revoke all on table public.lifeos_state from anon;
grant select, insert, update, delete on table public.lifeos_state to authenticated;

create policy "Users can read their own LifeOS state"
on public.lifeos_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own LifeOS state"
on public.lifeos_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own LifeOS state"
on public.lifeos_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own LifeOS state"
on public.lifeos_state
for delete
to authenticated
using ((select auth.uid()) = user_id);
