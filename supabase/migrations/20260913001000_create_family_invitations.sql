create table if not exists public.family_invitations (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    invited_email text not null,
    member_name text not null,
    relation text not null default 'Family',
    activities jsonb not null default '[]'::jsonb,
    invite_code text not null unique,
    invited_user_id uuid references auth.users(id) on delete set null,
    status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists family_invitations_owner_id_idx on public.family_invitations(owner_id);
create index if not exists family_invitations_email_idx on public.family_invitations(lower(invited_email));

alter table public.family_invitations enable row level security;

revoke all on table public.family_invitations from anon;
grant select, insert, update, delete on table public.family_invitations to authenticated;

create policy "Owners can read their family invitations"
on public.family_invitations
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Invited users can read their pending invitation"
on public.family_invitations
for select
to authenticated
using (lower(invited_email) = lower((select auth.email())) and status = 'pending');

create policy "Owners can create family invitations"
on public.family_invitations
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update family invitations"
on public.family_invitations
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete family invitations"
on public.family_invitations
for delete
to authenticated
using ((select auth.uid()) = owner_id);

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
      and lower(invited_email) = lower(coalesce(auth.email(), ''))
      and status = 'pending'
    limit 1;

    if invite_record.id is null then
        return false;
    end if;

    update public.family_invitations
    set invited_user_id = auth.uid(),
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

revoke all on function public.claim_family_invitation(text) from public;
grant execute on function public.claim_family_invitation(text) to authenticated;
