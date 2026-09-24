-- NØVA core schema
create extension if not exists vector;

create table if not exists providers (
  id text primary key,
  name text not null,
  region text,
  privacy_policy text,
  retention_policy text,
  training_policy text,
  enabled boolean not null default true,
  health text not null default 'unknown'
);

create table if not exists models (
  id text primary key,
  provider_id text not null references providers(id) on delete cascade,
  name text not null,
  type text not null,
  context_window integer not null,
  capabilities jsonb not null default '{}'::jsonb,
  availability boolean not null default true
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  input_hash text not null,
  task_type text not null,
  complexity numeric not null,
  privacy_level text not null,
  accuracy_requirement numeric,
  latency_requirement text,
  created_at timestamptz not null default now()
);

create table if not exists routing_decisions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  selected_provider text,
  selected_model text,
  score numeric not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists executions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  provider_id text references providers(id),
  model_id text,
  executor text not null,
  latency_ms integer not null,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  success boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists verification_results (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references executions(id) on delete cascade,
  passed boolean not null,
  confidence numeric not null,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists privacy_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  risk_level text not null,
  pii_detected jsonb not null default '[]'::jsonb,
  fields_redacted integer not null default 0,
  provider_allowed boolean not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  memory_type text not null,
  permission text not null default 'session',
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;
alter table routing_decisions enable row level security;
alter table executions enable row level security;
alter table verification_results enable row level security;
alter table privacy_events enable row level security;
alter table memory enable row level security;

create policy "Users can view their own tasks" on tasks
  for select using (auth.uid() = user_id);

create policy "Users can insert their own tasks" on tasks
  for insert with check (auth.uid() = user_id);

create policy "Users can view their own memory" on memory
  for select using (auth.uid() = user_id);

create policy "Users can manage their own memory" on memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
