import { createHash } from "node:crypto";
import { getSupabaseServiceClient } from "../supabase/server";
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
        input_hash: inputHash,
        task_type: ctx.scout.taskType,
        complexity: ctx.scout.estimatedComplexity,
        privacy_level: ctx.guardian.privacyClass,
        accuracy_requirement: ctx.thinker.accuracyRequirement,
        latency_requirement: ctx.request.latency ?? null,
      })
      .select("id")
      .single();

    if (taskError || !task) {
      console.error("nova: failed to persist task", taskError);
      return null;
    }

    const taskId = task.id as string;

    const { data: execution, error: executionError } = await supabase
      .from("executions")
      .insert({
        task_id: taskId,
        provider_id: ctx.routing.provider,
        model_id: ctx.routing.model,
        executor: `${ctx.routing.executor}/${ctx.routing.executorName}`,
        latency_ms: ctx.outcome.latencyMs,
        tokens_input: ctx.outcome.tokensInput,
        tokens_output: ctx.outcome.tokensOutput,
        success: ctx.outcome.success,
      })
      .select("id")
      .single();

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
        pii_detected: ctx.guardian.findings.map((f) => f.type),
        fields_redacted: ctx.guardian.findings.length,
        provider_allowed: ctx.guardian.externalTransmissionAllowed,
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
