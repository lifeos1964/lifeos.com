-- Enable family members to read and update the shared family owner's state in public.lifeos_state

-- 1. Ensure public.lifeos_state is included in the Supabase Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lifeos_state'
  ) then
    alter publication supabase_realtime add table public.lifeos_state;
  end if;
exception
  when undefined_object then null;
end $$;

-- 2. Drop existing RLS policies on public.lifeos_state
drop policy if exists "Users can read their own LifeOS state" on public.lifeos_state;
drop policy if exists "Users can create their own LifeOS state" on public.lifeos_state;
drop policy if exists "Users can update their own LifeOS state" on public.lifeos_state;
drop policy if exists "Users can delete their own LifeOS state" on public.lifeos_state;
drop policy if exists "Family members can read family owner state" on public.lifeos_state;
drop policy if exists "Family members can insert family owner state" on public.lifeos_state;
drop policy if exists "Family members can update family owner state" on public.lifeos_state;
drop policy if exists "Authenticated users can read shared family state" on public.lifeos_state;
drop policy if exists "Authenticated users can insert shared family state" on public.lifeos_state;
drop policy if exists "Authenticated users can update shared family state" on public.lifeos_state;
drop policy if exists "Authenticated users can delete shared family state" on public.lifeos_state;

-- Policy for SELECT: Read own state OR family owner's state
create policy "Authenticated users can read shared family state"
on public.lifeos_state
for select
to authenticated
using (
    user_id = (select auth.uid())
    or user_id = nullif((select raw_app_meta_data->>'family_owner_id' from auth.users where id = (select auth.uid())), '')::uuid
    or user_id in (
        select owner_id
        from public.family_invitations
        where (invited_user_id = (select auth.uid()) or lower(invited_email) = lower(coalesce((select auth.email()), '')))
    )
);

-- Policy for INSERT: Insert own state OR family owner's state
create policy "Authenticated users can insert shared family state"
on public.lifeos_state
for insert
to authenticated
with check (
    user_id = (select auth.uid())
    or user_id = nullif((select raw_app_meta_data->>'family_owner_id' from auth.users where id = (select auth.uid())), '')::uuid
    or user_id in (
        select owner_id
        from public.family_invitations
        where (invited_user_id = (select auth.uid()) or lower(invited_email) = lower(coalesce((select auth.email()), '')))
    )
);

-- Policy for UPDATE: Update own state OR family owner's state
create policy "Authenticated users can update shared family state"
on public.lifeos_state
for update
to authenticated
using (
    user_id = (select auth.uid())
    or user_id = nullif((select raw_app_meta_data->>'family_owner_id' from auth.users where id = (select auth.uid())), '')::uuid
    or user_id in (
        select owner_id
        from public.family_invitations
        where (invited_user_id = (select auth.uid()) or lower(invited_email) = lower(coalesce((select auth.email()), '')))
    )
)
with check (
    user_id = (select auth.uid())
    or user_id = nullif((select raw_app_meta_data->>'family_owner_id' from auth.users where id = (select auth.uid())), '')::uuid
    or user_id in (
        select owner_id
        from public.family_invitations
        where (invited_user_id = (select auth.uid()) or lower(invited_email) = lower(coalesce((select auth.email()), '')))
    )
);

-- Policy for DELETE: Delete own state OR family owner's state
create policy "Authenticated users can delete shared family state"
on public.lifeos_state
for delete
to authenticated
using (
    user_id = (select auth.uid())
    or user_id = nullif((select raw_app_meta_data->>'family_owner_id' from auth.users where id = (select auth.uid())), '')::uuid
);

-- 3. Update claim_family_invitation procedure to link member to family owner metadata
create or replace function public.claim_family_invitation(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    invite_record public.family_invitations%rowtype;
begin
    if auth.uid() is null then
        return false;
    end if;

    select *
    into invite_record
    from public.family_invitations
    where invite_code = upper(trim(input_code))
      and status in ('pending', 'claimed')
    limit 1;

    if invite_record.id is null then
        return false;
    end if;

    update public.family_invitations
    set invited_user_id = auth.uid(),
        invited_email = coalesce(nullif(trim(auth.email()), ''), invited_email),
        status = 'claimed',
        updated_at = now()
    where id = invite_record.id;

    update auth.users
    set raw_app_meta_data = jsonb_set(
            jsonb_set(
                coalesce(raw_app_meta_data, '{}'::jsonb),
                '{family_owner_id}',
                to_jsonb(invite_record.owner_id),
                true
            ),
            '{family_activities}',
            coalesce(invite_record.activities, '[]'::jsonb),
            true
        )
    where id = auth.uid();

    return true;
end;
$$;
