create extension if not exists pgcrypto;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'lead' check (status in ('lead','qualified','proposal','won','active','delivered','lost')),
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  currency text not null default 'usd',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  kind text not null,
  source_name text,
  extracted_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  body text not null,
  model text,
  approved boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  stripe_session_id text unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  event_type text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_status on projects(status);
create index if not exists idx_projects_client_id on projects(client_id);
create index if not exists idx_documents_project_id on documents(project_id);
create index if not exists idx_proposals_project_id on proposals(project_id);
create index if not exists idx_audit_events_created_at on audit_events(created_at desc);

alter table clients enable row level security;
alter table projects enable row level security;
alter table documents enable row level security;
alter table proposals enable row level security;
alter table payments enable row level security;
alter table audit_events enable row level security;

-- This app intentionally uses the server-side service role key only.
-- No anonymous/browser policy is created; browser clients cannot read these tables directly.
