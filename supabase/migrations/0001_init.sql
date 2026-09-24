-- NØVA core schema
create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  enabled boolean not null default true,
  region text,
  training_policy text,
  retention_policy text,
  privacy_level text,
  health text not null default 'unknown',
  created_at timestamptz not null default now()
);

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  name text not null,
  model_type text,
  context_window integer,
  capabilities jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (provider_id, name)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  input_hash text not null,
  task_type text not null,
  complexity numeric,
  privacy_level text,
  accuracy_requirement numeric,
  latency_requirement text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.executions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  provider_id uuid references public.providers(id),
  model_id uuid references public.models(id),
  executor text not null,
  latency_ms integer not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  success boolean not null,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.routing_decisions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  selected_provider text,
  selected_model text,
  score numeric not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_results (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions(id) on delete cascade,
  passed boolean not null,
  confidence numeric not null,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.privacy_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  risk_level text not null,
  pii_detected boolean not null default false,
  fields_detected jsonb not null default '[]'::jsonb,
  fields_redacted jsonb not null default '[]'::jsonb,
  action text not null,
  created_at timestamptz not null default now()
);

-- Embedding dimension must match whichever embedding model is actually
-- selected (see spec section 8) — 768 is a placeholder until then.
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(768),
  memory_type text,
  permission text not null default 'session',
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.executions enable row level security;
alter table public.routing_decisions enable row level security;
alter table public.verification_results enable row level security;
alter table public.privacy_events enable row level security;
alter table public.memories enable row level security;

-- providers/models are reference data: readable by any authenticated user,
-- writable only via the service role (used by lib/supabase/admin.ts).
alter table public.providers enable row level security;
alter table public.models enable row level security;

create policy "Authenticated users can view providers" on public.providers
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can view models" on public.models
  for select using (auth.role() = 'authenticated');

create policy "Users can view their own tasks" on public.tasks
  for select using (auth.uid() = user_id);

create policy "Users can create their own tasks" on public.tasks
  for insert with check (auth.uid() = user_id);

create policy "Users can view executions for their own tasks" on public.executions
  for select using (
    exists (select 1 from public.tasks t where t.id = executions.task_id and t.user_id = auth.uid())
  );

create policy "Users can view routing decisions for their own tasks" on public.routing_decisions
  for select using (
    exists (select 1 from public.tasks t where t.id = routing_decisions.task_id and t.user_id = auth.uid())
  );

create policy "Users can view verification results for their own executions" on public.verification_results
  for select using (
    exists (
      select 1 from public.executions e
      join public.tasks t on t.id = e.task_id
      where e.id = verification_results.execution_id and t.user_id = auth.uid()
    )
  );

create policy "Users can view privacy events for their own tasks" on public.privacy_events
  for select using (
    exists (select 1 from public.tasks t where t.id = privacy_events.task_id and t.user_id = auth.uid())
  );

create policy "Users can view their own memories" on public.memories
  for select using (auth.uid() = user_id);

create policy "Users can manage their own memories" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
