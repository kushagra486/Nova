/**
 * In-memory rolling reliability tracker per provider, fed by actual
 * generate() outcomes in the pipeline. This is process-local (resets on
 * cold start), which is an accepted limitation for the MVP — the
 * `providers.health` column in the Supabase schema is where this should
 * eventually live so it survives across serverless instances.
 */

interface HealthStats {
  successes: number;
  failures: number;
}

const stats = new Map<string, HealthStats>();

const UNKNOWN_PROVIDER_PRIOR = 0.9;

export function recordOutcome(providerId: string, success: boolean): void {
  const current = stats.get(providerId) ?? { successes: 0, failures: 0 };
  if (success) current.successes += 1;
  else current.failures += 1;
  stats.set(providerId, current);
}

/** Rolling success rate in [0, 1]. Optimistic prior when there's no data yet. */
export function getReliability(providerId: string): number {
  const s = stats.get(providerId);
  if (!s || s.successes + s.failures === 0) return UNKNOWN_PROVIDER_PRIOR;
  return s.successes / (s.successes + s.failures);
}
