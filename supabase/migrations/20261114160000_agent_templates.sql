-- Agent templates: the locked wording and call flow each foner receptionist is built from.
-- Private: RLS on, readable only by foner admins. Written only by the service role.
-- (The template rows themselves are not in this repo, which is public.)
create table public.agent_templates (
  template_id   text not null,
  version       text not null,
  title         text not null,
  business_type text not null,
  demo_agent_id text,
  template      jsonb not null,
  notes         text,
  created_at    timestamptz not null default now(),
  primary key (template_id, version)
);
alter table public.agent_templates enable row level security;
create policy agent_templates_admin_read on public.agent_templates for select to authenticated
  using ((select private.is_admin()));
revoke all on public.agent_templates from anon;
revoke insert, update, delete on public.agent_templates from authenticated;
