-- Ensure family members and the owner see each other's changes live.
-- Without this, postgres_changes subscriptions in js/supabase-sync.js never fire,
-- so shared state updates only appear after a full page reload (re-hydrate).

alter table public.lifeos_state replica identity full;

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
end
$$;
