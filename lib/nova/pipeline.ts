import type { NovaResponse, TaskRequest, TraceStep } from "./types";
import { runScout } from "./scout";
import { runGuardian, privacyClassToScore } from "./guardian";
import { runThinker } from "./thinker";
import { runRouter } from "./router";
import { runVerifier } from "./verifier";
import { evaluateArithmetic, extractEmails } from "./executors/deterministic";
import { getProvider, providers } from "./providers/registry";
import { persistPipelineRun } from "./persistence";

/**
 * The full NØVA agent loop: OBSERVE -> UNDERSTAND -> PLAN -> SELECT ->
 * EXECUTE -> VERIFY -> RESPOND. Each stage appends a trace step so the
 * decision is explainable end to end.
 */
export async function runNovaPipeline(request: TaskRequest): Promise<NovaResponse> {
  const started = Date.now();
  const trace: TraceStep[] = [];
  const mark = (step: string, detail: string) =>
    trace.push({ step, detail, timestampMs: Date.now() - started });

  mark("request_received", `Task: "${request.task.slice(0, 120)}"`);

  const scout = runScout(request.task);
  mark("scout_classified", `type=${scout.taskType} complexity=${scout.estimatedComplexity.toFixed(2)}`);

  const guardian = runGuardian(request.task);
  mark(
    "guardian_scan",
    `privacy_class=${guardian.privacyClass} findings=${guardian.findings.length} allowed=${guardian.externalTransmissionAllowed}`
  );

  const thinker = runThinker(scout, privacyClassToScore(guardian.privacyClass), request);
  mark(
    "thinker_profile",
    `reasoning=${thinker.reasoningRequirement.toFixed(2)} privacy=${thinker.privacySensitivity.toFixed(2)} latency=${thinker.latencyRequirement.toFixed(2)}`
  );

  const routing = runRouter(scout, guardian, thinker);
  mark("router_decision", `${routing.executor}/${routing.executorName} — ${routing.reason}`);

  let output = "";
  let tokensInput = 0;
  let tokensOutput = 0;
  let success = true;
  let aiCallsUsed = 0;
  let usedProvider = routing.provider;
  let usedModel = routing.model;

  if (routing.executor === "blocked") {
    output = "This request was blocked by Guardian: it contains credentials or API keys that must not be sent to an external AI provider.";
    success = false;
  } else if (routing.executor === "deterministic" && routing.executorName === "calculator") {
    try {
      const result = evaluateArithmetic(request.task);
      output = String(result);
      mark("execution", `deterministic calculator -> ${output}`);
    } catch (err) {
      output = `Could not evaluate expression: ${(err as Error).message}`;
      success = false;
    }
  } else if (routing.executor === "deterministic" && routing.executorName === "regex_extractor") {
    const emails = extractEmails(request.task);
    output = emails.length > 0 ? emails.join(", ") : "No email addresses found.";
    mark("execution", `regex extractor -> ${emails.length} match(es)`);
  } else if (routing.executor === "ai" && routing.provider) {
    const provider = getProvider(routing.provider);
    let lastError: Error | null = null;
    const attempted = provider ? [provider, ...providers.filter((p) => p.id !== provider.id && p.isConfigured())] : [];

    for (const candidate of attempted) {
      try {
        const model = candidate.id === routing.provider ? routing.model! : candidate.defaultModel(scout.taskType);
        const response = await candidate.generate({ prompt: guardian.redactedText, model });
        output = response.text;
        tokensInput = response.tokensInput;
        tokensOutput = response.tokensOutput;
        aiCallsUsed += 1;
        usedProvider = candidate.id;
        usedModel = model;
        mark("execution", `${candidate.name}/${model} -> ${tokensOutput} tokens generated`);
        lastError = null;
        break;
      } catch (err) {
        lastError = err as Error;
        mark("provider_failure", `${candidate.name} failed: ${lastError.message}`);
      }
    }

    if (lastError) {
      output = `All configured AI providers failed. Last error: ${lastError.message}`;
      success = false;
    }
  } else {
    output = routing.reason;
    success = false;
  }

  let verification = runVerifier(output, routing.executor === "deterministic");
  mark("verification", `passed=${verification.passed} confidence=${verification.confidence}`);

  if (!verification.passed && routing.executor === "ai" && success && usedProvider) {
    const provider = getProvider(usedProvider)!;
    const strongerModel = provider.escalatedModel(scout.taskType);

    if (strongerModel !== usedModel) {
      try {
        const response = await provider.generate({ prompt: guardian.redactedText, model: strongerModel });
        aiCallsUsed += 1;
        const escalatedVerification = runVerifier(response.text, false);
        mark(
          "escalation",
          `${provider.name}/${strongerModel} -> passed=${escalatedVerification.passed} confidence=${escalatedVerification.confidence}`
        );

        output = response.text;
        tokensInput += response.tokensInput;
        tokensOutput += response.tokensOutput;
        usedModel = strongerModel;
        verification = escalatedVerification;
      } catch (err) {
        mark("escalation", `${provider.name}/${strongerModel} failed: ${(err as Error).message}`);
      }
    } else {
      mark("escalation", `No stronger model available on ${provider.name} for this task type.`);
    }
  }

  const latencyMs = Date.now() - started;
  const finalRouting = { ...routing, provider: usedProvider, model: usedModel };

  const taskId = await persistPipelineRun({
    request,
    scout,
    guardian,
    thinker,
    routing: finalRouting,
    verification,
    outcome: { tokensInput, tokensOutput, latencyMs, success },
  });
  mark("persisted", taskId ? `task_id=${taskId}` : "skipped (Supabase not configured)");
  mark("respond", `total_latency_ms=${latencyMs}`);

  return {
    taskId,
    taskType: scout.taskType,
    complexity: scout.estimatedComplexity,
    privacy: thinker.privacySensitivity,
    privacyClass: guardian.privacyClass,
    selectedExecutor: routing.executor,
    executorName: routing.executorName,
    provider: usedProvider,
    model: usedModel,
    reason: routing.reason,
    output,
    verified: verification.passed && success,
    verification,
    aiCallsUsed,
    tokensUsed: tokensInput + tokensOutput,
    latencyMs,
    trace,
  };
}
