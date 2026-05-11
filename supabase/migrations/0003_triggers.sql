-- DVA Dashboard — triggers and helper functions

-- 1. Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name, initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    upper(coalesce(new.raw_user_meta_data->>'initials', substr(new.email,1,2)))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Mark briefing stale when a new call is logged
create or replace function public.mark_briefing_stale()
returns trigger language plpgsql as $$
begin
  insert into public.student_briefings (student_id, summary_md, is_stale, source_calls_count)
  values (new.student_id, '', true, 0)
  on conflict (student_id) do update
    set is_stale = true;
  return new;
end;
$$;

drop trigger if exists call_logs_mark_briefing_stale on public.call_logs;
create trigger call_logs_mark_briefing_stale
  after insert on public.call_logs
  for each row execute procedure public.mark_briefing_stale();

-- 3. updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students
  for each row execute procedure public.touch_updated_at();

drop trigger if exists emi_touch on public.emi_schedule;
create trigger emi_touch before update on public.emi_schedule
  for each row execute procedure public.touch_updated_at();

-- 4. Audit log triggers (writes captured via service role)
create or replace function public.write_audit()
returns trigger language plpgsql security definer as $$
declare
  diff jsonb;
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_log (actor_id, entity, entity_id, action, diff)
    values (auth.uid(), tg_table_name, new.id, 'create', to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    diff = jsonb_strip_nulls(to_jsonb(new) - to_jsonb(old));
    if diff <> '{}'::jsonb then
      insert into public.audit_log (actor_id, entity, entity_id, action, diff)
      values (auth.uid(), tg_table_name, new.id, 'update', diff);
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_log (actor_id, entity, entity_id, action, diff)
    values (auth.uid(), tg_table_name, old.id, 'delete', to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists students_audit on public.students;
create trigger students_audit
  after insert or update or delete on public.students
  for each row execute procedure public.write_audit();

drop trigger if exists emi_audit on public.emi_schedule;
create trigger emi_audit
  after insert or update or delete on public.emi_schedule
  for each row execute procedure public.write_audit();

-- 5. Auto-update emi status as dates roll
create or replace function public.refresh_emi_statuses()
returns void language sql as $$
  update public.emi_schedule
     set status = case
       when status = 'paid' then 'paid'
       when due_date < current_date then 'overdue'
       when due_date <= current_date + interval '7 days' then 'due_soon'
       else 'upcoming'
     end
   where status not in ('paid','cancelled');
$$;
