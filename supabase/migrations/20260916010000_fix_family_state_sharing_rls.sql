-- The previous family-sharing policies queried auth.users to look up the caller's
-- family_owner_id, but the `authenticated` role has no SELECT grant on auth.users,
-- so every policy check failed with a permission error for family members
-- (their reads/writes to the owner's shared row silently errored out).
-- Use auth.jwt() instead, which decodes the caller's own token and needs no table grant.

drop policy if exists "Family members can read family owner state" on public.lifeos_state;
create policy "Family members can read family owner state"
on public.lifeos_state
for select
to authenticated
using (
    user_id = (select auth.uid())
    or user_id = nullif(
        (select auth.jwt() -> 'app_metadata' ->> 'family_owner_id'),
        ''
    )::uuid
);

drop policy if exists "Family members can insert family owner state" on public.lifeos_state;
create policy "Family members can insert family owner state"
on public.lifeos_state
for insert
to authenticated
with check (
    user_id = (select auth.uid())
    or user_id = nullif(
        (select auth.jwt() -> 'app_metadata' ->> 'family_owner_id'),
        ''
    )::uuid
);

drop policy if exists "Family members can update family owner state" on public.lifeos_state;
create policy "Family members can update family owner state"
on public.lifeos_state
for update
to authenticated
using (
    user_id = (select auth.uid())
    or user_id = nullif(
        (select auth.jwt() -> 'app_metadata' ->> 'family_owner_id'),
        ''
    )::uuid
)
with check (
    user_id = (select auth.uid())
    or user_id = nullif(
        (select auth.jwt() -> 'app_metadata' ->> 'family_owner_id'),
        ''
    )::uuid
);
