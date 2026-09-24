import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "../supabase/admin";
import type {
  TaskRequest,
  ScoutResult,
  GuardianResult,
  ThinkerProfile,
  RoutingDecision,
  VerificationResult,
} from "./types";

export interface PipelineRunOutcome {
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  success: boolean;
}

export interface PipelineRunContext {
  request: TaskRequest;
  scout: ScoutResult;
  guardian: GuardianResult;
  thinker: ThinkerProfile;
  routing: RoutingDecision;
  verification: VerificationResult;
  outcome: PipelineRunOutcome;
  /** Authenticated user, if any — anonymous/service-triggered runs persist with user_id = null. */
  userId?: string | null;
}

// providers/models are small, mostly-static reference tables (seeded via
// supabase/seed.sql) — cache the name -> uuid lookup for the process
// lifetime instead of round-tripping on every execution.
const providerIdCache = new Map<string, string | null>();
const modelIdCache = new Map<string, string | null>();

async function resolveProviderId(supabase: SupabaseClient, providerName: string): Promise<string | null> {
  if (providerIdCache.has(providerName)) return providerIdCache.get(providerName)!;
  const { data } = await supabase.from("providers").select("id").eq("name", providerName).maybeSingle();
  const id = data?.id ?? null;
  providerIdCache.set(providerName, id);
  return id;
}

async function resolveModelId(supabase: SupabaseClient, providerRowId: string, modelName: string): Promise<string | null> {
  const cacheKey = `${providerRowId}::${modelName}`;
  if (modelIdCache.has(cacheKey)) return modelIdCache.get(cacheKey)!;
  const { data } = await supabase
    .from("models")
    .select("id")
    .eq("provider_id", providerRowId)
    .eq("name", modelName)
    .maybeSingle();
  const id = data?.id ?? null;
  modelIdCache.set(cacheKey, id);
  return id;
}

/**
 * Persists a completed pipeline run to Supabase for the benchmark/metrics
 * system (section 40 of the spec). Best-effort: Guardian's decision about
 * what may leave the process already happened upstream, so this never
 * stores the raw task text or raw PII matches — only a hash and finding
 * *types* — and any failure here is logged, never thrown, so a missing or
 * misconfigured database never breaks the user-facing response.
 */
export async function persistPipelineRun(ctx: PipelineRunContext): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const inputHash = createHash("sha256").update(ctx.request.task).digest("hex");

  try {
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        user_id: ctx.userId ?? null,
        input_hash: inputHash,
        task_type: ctx.scout.taskType,
        complexity: ctx.scout.estimatedComplexity,
        privacy_level: ctx.guardian.privacyClass,
        accuracy_requirement: ctx.thinker.accuracyRequirement,
        latency_requirement: ctx.request.latency ?? null,
        status: "completed",
      })
      .select("id")
      .single();

    if (taskError || !task) {
      console.error("nova: failed to persist task", taskError);
      return null;
    }

    const taskId = task.id as string;

    let providerRowId: string | null = null;
    let modelRowId: string | null = null;
    if (ctx.routing.provider) {
      providerRowId = await resolveProviderId(supabase, ctx.routing.provider);
      if (providerRowId && ctx.routing.model) {
        modelRowId = await resolveModelId(supabase, providerRowId, ctx.routing.model);
      }
    }

    const { data: execution, error: executionError } = await supabase
      .from("executions")
      .insert({
        task_id: taskId,
        provider_id: providerRowId,
        model_id: modelRowId,
        executor: `${ctx.routing.executor}/${ctx.routing.executorName}`,
        latency_ms: ctx.outcome.latencyMs,
        input_tokens: ctx.outcome.tokensInput,
        output_tokens: ctx.outcome.tokensOutput,
        success: ctx.outcome.success,
      })
      .select("id")
      .single();

    const findingTypes = [...new Set(ctx.guardian.findings.map((f) => f.type))];

    const inserts: PromiseLike<unknown>[] = [
      supabase.from("routing_decisions").insert({
        task_id: taskId,
        selected_provider: ctx.routing.provider,
        selected_model: ctx.routing.model,
        score: ctx.routing.score,
        reason: ctx.routing.reason,
      }),
      supabase.from("privacy_events").insert({
        task_id: taskId,
        risk_level: ctx.guardian.privacyClass,
        pii_detected: ctx.guardian.findings.length > 0,
        fields_detected: findingTypes,
        fields_redacted: findingTypes,
        action: ctx.routing.executor === "blocked" ? "blocked" : ctx.guardian.findings.length > 0 ? "redacted" : "allowed",
      }),
    ];

    if (execution && !executionError) {
      inserts.push(
        supabase.from("verification_results").insert({
          execution_id: execution.id,
          passed: ctx.verification.passed,
          confidence: ctx.verification.confidence,
          issues: ctx.verification.issues,
        })
      );
    } else if (executionError) {
      console.error("nova: failed to persist execution", executionError);
    }

    await Promise.all(inserts);
    return taskId;
  } catch (err) {
    console.error("nova: persistence failed", err);
    return null;
  }
}
