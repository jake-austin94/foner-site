-- "Make it yours" answers from the scan page: how a new sign-up wants their receptionist to behave.
-- The website can add a row but never read one back; only foner admins can read.
create table public.setup_requests (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scan_id    uuid references public.website_scans(id) on delete set null,
  email      text not null check (length(email) between 3 and 320),
  name       text check (length(name) <= 200),
  answers    jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 8000)
);
alter table public.setup_requests enable row level security;
revoke all on public.setup_requests from anon, authenticated;
grant insert (scan_id, email, name, answers) on public.setup_requests to anon, authenticated;
grant select on public.setup_requests to authenticated;
create policy setup_requests_insert on public.setup_requests for insert to anon, authenticated with check (true);
create policy setup_requests_admin_read on public.setup_requests for select to authenticated using ((select private.is_admin()));

-- A daily ceiling so the open insert can't be used to fill the table.
create or replace function private.setup_requests_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.setup_requests where created_at > now() - interval '1 day') >= 200 then
    raise exception 'Too many requests today';
  end if;
  return new;
end $$;
create trigger setup_requests_limit before insert on public.setup_requests
  for each row execute function private.setup_requests_limit();
