-- ============================================================================
-- Block privilege escalation on profiles.role / profiles.permissions
-- ============================================================================
-- REVIEW BEFORE APPLYING. This guards against a coach self-promoting to admin.
--
-- WHY: the admin API routes (promote / demote / update-permissions) write
-- role/permissions using the SERVICE-ROLE key, which bypasses this trigger. But
-- if the profiles table's RLS lets an authenticated user UPDATE their own row
-- (the "any authenticated user" model this project uses for operational tables),
-- a coach could run, straight from the browser console:
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', <self>)
-- and become an admin, bypassing every server-side admin check.
--
-- This trigger rejects role/permissions CHANGES from any non service_role
-- session, while leaving:
--   * the legitimate service-role admin routes working (they bypass it), and
--   * all other profile edits (display_name, initials, …) untouched.
--
-- It does NOT change any current app behaviour — the app already mutates
-- role/permissions only via the service-role admin routes.
-- ============================================================================

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (the admin API routes) may change anything.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Everyone else: role and permissions must stay exactly as they were.
  if new.role is distinct from old.role
     or new.permissions is distinct from old.permissions then
    raise exception 'not allowed to change role or permissions';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;

create trigger trg_prevent_profile_privilege_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();
