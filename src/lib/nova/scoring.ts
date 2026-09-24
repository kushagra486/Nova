import type { PrivacyClass } from "./types";
import type { AIProvider, ModelInfo } from "./providers/types";
import { getReliability } from "./providers/health-tracker";

/**
 * NØVA SCORE (spec section 14):
 *   capability fit + accuracy fit + privacy compliance + latency fit + reliability
 *   - token cost - failure risk
 *
 * Every factor is normalized to [0, 1] so the weighted sum stays in [0, 1].
 * The accuracy/capability priors below are hand-set heuristics, not values
 * measured from real model benchmarks — they're deliberately conservative
 * and meant to be replaced once NØVA has real accuracy data to learn from
 * (see the benchmark harness and Intelligence Efficiency Score in the spec).
 */

const ACCURACY_PRIOR: Record<ModelInfo["type"], number> = {
  lightweight: 0.75,
  reasoning: 0.92,
  coding: 0.88,
  multimodal: 0.85,
  embedding: 0.5,
};

const TASK_PREFERRED_TYPE: Record<string, ModelInfo["type"]> = {
  coding: "coding",
  reasoning: "reasoning",
  research_analysis: "reasoning",
  document_analysis: "reasoning",
  summarization: "reasoning",
  classification: "lightweight",
  general_query: "reasoning",
};

const LATENCY_BUDGET_MS = 3000;
const TOKEN_BUDGET = 4000;

const PENALTY_WEIGHT = 0.5;

export interface ScoreBreakdown {
  capabilityFit: number;
  accuracyFit: number;
  privacyCompliance: number;
  latencyFit: number;
  reliability: number;
  tokenCostPenalty: number;
  failureRiskPenalty: number;
  total: number;
}

function capabilityFit(taskType: string, modelType: ModelInfo["type"]): number {
  const preferred = TASK_PREFERRED_TYPE[taskType] ?? "reasoning";
  if (modelType === preferred) return 1;
  if (modelType === "multimodal") return 0.8; // capable generalist, imperfect specialist match
  return 0.5;
}

function accuracyFit(requiredAccuracy: number, modelType: ModelInfo["type"]): number {
  return 1 - Math.abs(requiredAccuracy - ACCURACY_PRIOR[modelType]);
}

function privacyCompliance(privacyClass: PrivacyClass): number {
  // P3 never reaches this scorer — Guardian hard-blocks it upstream.
  switch (privacyClass) {
    case "P0":
      return 1;
    case "P1":
      return 0.85;
    case "P2":
      return 0.6;
    case "P3":
      return 0;
  }
}

function latencyFit(requiredSpeed: number, estimatedLatencyMs: number): number {
  const normalizedSlowness = Math.min(estimatedLatencyMs / LATENCY_BUDGET_MS, 1);
  const providerSpeed = 1 - normalizedSlowness;
  return 1 - Math.abs(requiredSpeed - providerSpeed);
}

function tokenCostPenalty(estimatedTokens: number): number {
  return Math.min(estimatedTokens / TOKEN_BUDGET, 1);
}

export function scoreProviderModel(
  provider: AIProvider,
  modelName: string,
  taskType: string,
  requiredAccuracy: number,
  requiredLatencySpeed: number,
  privacyClass: PrivacyClass,
  promptText: string
): ScoreBreakdown {
  const modelInfo = provider.models().find((m) => m.name === modelName);
  const modelType = modelInfo?.type ?? "reasoning";
  const estimate = provider.estimate({ prompt: promptText, model: modelName });
  const reliability = getReliability(provider.id);
  const failureRisk = 1 - reliability;

  const positives = {
    capabilityFit: capabilityFit(taskType, modelType),
    accuracyFit: accuracyFit(requiredAccuracy, modelType),
    privacyCompliance: privacyCompliance(privacyClass),
    latencyFit: latencyFit(requiredLatencySpeed, estimate.estimatedLatencyMs),
    reliability,
  };

  const penalties = {
    tokenCostPenalty: tokenCostPenalty(estimate.estimatedTokens),
    failureRiskPenalty: failureRisk,
  };

  const positiveAverage =
    (positives.capabilityFit +
      positives.accuracyFit +
      positives.privacyCompliance +
      positives.latencyFit +
      positives.reliability) /
    5;

  const total = Math.max(
    0,
    Math.min(1, positiveAverage - PENALTY_WEIGHT * penalties.tokenCostPenalty - PENALTY_WEIGHT * penalties.failureRiskPenalty)
  );

  return { ...positives, ...penalties, total };
}

export function formatScoreBreakdown(b: ScoreBreakdown): string {
  return `capability=${b.capabilityFit.toFixed(2)} accuracy=${b.accuracyFit.toFixed(2)} privacy=${b.privacyCompliance.toFixed(2)} latency=${b.latencyFit.toFixed(2)} reliability=${b.reliability.toFixed(2)} token_cost=-${b.tokenCostPenalty.toFixed(2)} failure_risk=-${b.failureRiskPenalty.toFixed(2)}`;
}
