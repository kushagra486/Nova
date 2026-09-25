import type { ScoutResult, ThinkerProfile, GuardianResult, RoutingDecision } from "./types";
import { providers } from "./providers/registry";
import { scoreProviderModel, formatScoreBreakdown } from "./scoring";
import { isWebSearchConfigured } from "./executors/web-search";

/**
 * Router selects the minimum sufficient execution path: deterministic tools
 * first, then the AI provider/model with the highest NØVA score (capability,
 * accuracy, privacy, latency and reliability fit, minus token cost and
 * failure risk — see scoring.ts), subject to Guardian's privacy constraint
 * (a hard constraint, never just a score input).
 */
export function runRouter(
  scout: ScoutResult,
  guardian: GuardianResult,
  thinker: ThinkerProfile,
  overridePrivacy: boolean = false
): RoutingDecision {
  if (!guardian.externalTransmissionAllowed && !overridePrivacy) {
    return {
      executor: "blocked",
      executorName: "guardian_block",
      provider: null,
      model: null,
      score: 1,
      reason:
        "Privacy class P3 (credentials/API keys) detected — external AI transmission is blocked by default policy. Resubmit with explicit approval to send it anyway.",
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

  if (scout.taskType === "web_search") {
    if (!isWebSearchConfigured()) {
      return {
        executor: "specialized",
        executorName: "unavailable",
        provider: null,
        model: null,
        score: 0,
        reason: "Web search requires no LLM, but no search provider is configured (missing BRAVE_SEARCH_API_KEY).",
      };
    }
    return {
      executor: "specialized",
      executorName: "web_search",
      provider: null,
      model: null,
      score: 1,
      reason: "A web search satisfies the task without an LLM call.",
    };
  }

  if (scout.taskType === "code_execution") {
    return {
      executor: "specialized",
      executorName: "code_sandbox",
      provider: null,
      model: null,
      score: 1,
      reason: "Code executed in an isolated sandbox without an LLM call.",
    };
  }

  if (guardian.privacyClass !== "P0" && !overridePrivacy) {
    return {
      executor: "needs_approval",
      executorName: "privacy_confirmation",
      provider: null,
      model: null,
      score: 0,
      reason: `This request is classified ${guardian.privacyClass} and would send content to an external AI provider. Resubmit with explicit approval to proceed anyway.`,
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

  const candidates = candidateProviders.map((provider) => {
    const model = provider.defaultModel(scout.taskType);
    const breakdown = scoreProviderModel(
      provider,
      model,
      scout.taskType,
      thinker.accuracyRequirement,
      thinker.latencyRequirement,
      guardian.privacyClass,
      guardian.redactedText
    );
    return { provider, model, breakdown };
  });

  const best = candidates.reduce((top, candidate) => (candidate.breakdown.total > top.breakdown.total ? candidate : top));

  const runnerUp = candidates.find((c) => c !== best);
  const comparison = runnerUp
    ? ` (beat ${runnerUp.provider.name}/${runnerUp.model} at ${runnerUp.breakdown.total.toFixed(2)})`
    : "";

  return {
    executor: "ai",
    executorName: "ai_model",
    provider: best.provider.id,
    model: best.model,
    score: best.breakdown.total,
    reason: `NØVA score ${best.breakdown.total.toFixed(2)} [${formatScoreBreakdown(best.breakdown)}] routed to ${best.provider.name}/${best.model}${comparison}.`,
  };
}
