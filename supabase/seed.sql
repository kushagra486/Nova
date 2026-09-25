-- Seeds the providers/models reference tables that lib/nova/persistence.ts
-- resolves provider/model names against when recording an execution.
-- Run with: supabase db execute -f supabase/seed.sql (or via the SQL editor).

insert into public.providers (name, enabled, region, training_policy, retention_policy, privacy_level, health)
values
  ('nvidia', true, 'us', 'unknown', 'unknown', 'standard', 'unknown')
on conflict (name) do nothing;

insert into public.models (provider_id, name, model_type, context_window, capabilities)
select p.id, m.name, m.model_type, m.context_window, m.capabilities::jsonb
from public.providers p
join (
  values
    ('nvidia', 'deepseek-ai/deepseek-v4.1-flash', 'reasoning', 1000000, '{"toolCalling": true}'),
    ('nvidia', 'z-ai/glm-5.3', 'reasoning', 128000, '{"toolCalling": true}'),
    ('nvidia', 'z-ai/glm-5.3-flash', 'multimodal', 128000, '{"toolCalling": true}'),
    ('nvidia', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'lightweight', 32000, '{"toolCalling": false}'),
    ('nvidia', 'nvidia/nemotron-3-ultra-550b-a55b', 'reasoning', 128000, '{"toolCalling": true}')
) as m(provider_name, name, model_type, context_window, capabilities)
on p.name = m.provider_name
on conflict (provider_id, name) do nothing;

-- If this project was previously seeded with the removed direct-DeepSeek
-- provider, clean up the now-orphaned rows (models first, for the FK):
delete from public.models where provider_id in (select id from public.providers where name = 'deepseek');
delete from public.providers where name = 'deepseek';
