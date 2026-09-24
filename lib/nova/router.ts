import type { ScoutResult, ThinkerProfile, GuardianResult, RoutingDecision } from "./types";
import { providers } from "./providers/registry";

/**
 * Router selects the minimum sufficient execution path: deterministic tools
 * first, then the cheapest AI provider/model capable of the task, subject to
 * Guardian's privacy constraint (a hard constraint, never just a score).
 */
export function runRouter(
  scout: ScoutResult,
  guardian: GuardianResult,
  thinker: ThinkerProfile
): RoutingDecision {
  if (!guardian.externalTransmissionAllowed) {
    return {
      executor: "blocked",
      executorName: "guardian_block",
      provider: null,
      model: null,
      score: 1,
      reason:
        "Privacy class P3 (credentials/API keys) detected — external AI transmission is blocked by default policy.",
    };
  }

  if (scout.taskType === "calculation") {
    return {
      executor: "deterministic",
      executorName: "calculator",
      provider: null,
      model: null,
      score: 1,
      reason: "Arithmetic expression solved deterministically without an LLM.",
    };
  }

  if (scout.taskType === "extraction") {
    return {
      executor: "deterministic",
      executorName: "regex_extractor",
      provider: null,
      model: null,
      score: 1,
      reason: "Pattern-based extraction satisfies the task without an LLM.",
    };
  }

  const candidateProviders = providers.filter((p) => p.isConfigured());

  if (candidateProviders.length === 0) {
    return {
      executor: "ai",
      executorName: "unavailable",
      provider: null,
      model: null,
      score: 0,
      reason:
        "Task requires an AI model but no provider is configured (missing NVIDIA_API_KEY / DEEPSEEK_API_KEY).",
    };
  }

  const provider = candidateProviders[0];
  const model = provider.defaultModel(scout.taskType);

  const capabilityFit = 1 - Math.abs(thinker.reasoningRequirement - scout.estimatedComplexity);
  const privacyPenalty = guardian.privacyClass === "P2" ? 0.2 : 0;
  const score = Math.max(0, Math.min(1, capabilityFit - privacyPenalty));

  return {
    executor: "ai",
    executorName: "ai_model",
    provider: provider.id,
    model,
    score,
    reason: `Reasoning requirement (${thinker.reasoningRequirement.toFixed(2)}) exceeds deterministic capability; routed to ${provider.name}/${model}.`,
  };
}
