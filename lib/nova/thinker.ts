import type { ScoutResult, ThinkerProfile, TaskRequest } from "./types";

const LATENCY_TO_SCORE: Record<NonNullable<TaskRequest["latency"]>, number> = {
  low: 0.9,
  medium: 0.5,
  high: 0.2,
};

const PRIVACY_TO_SCORE: Record<NonNullable<TaskRequest["privacy"]>, number> = {
  low: 0.1,
  medium: 0.5,
  high: 0.9,
};

/**
 * Thinker turns the Scout's classification plus the caller's stated
 * requirements and Guardian's measured privacy risk into a single task
 * profile that the Router scores execution paths against.
 */
export function runThinker(
  scout: ScoutResult,
  guardianPrivacyScore: number,
  request: TaskRequest
): ThinkerProfile {
  const reasoningRequirement =
    scout.taskType === "reasoning"
      ? 0.9
      : scout.taskType === "coding"
        ? 0.75
        : scout.taskType === "summarization"
          ? 0.5
          : scout.taskType === "classification"
            ? 0.25
            : scout.estimatedComplexity;

  const statedPrivacy = request.privacy ? PRIVACY_TO_SCORE[request.privacy] : 0;
  const privacySensitivity = Math.max(guardianPrivacyScore, statedPrivacy);

  return {
    taskComplexity: scout.estimatedComplexity,
    reasoningRequirement,
    privacySensitivity,
    accuracyRequirement: request.accuracy ?? 0.85,
    latencyRequirement: request.latency ? LATENCY_TO_SCORE[request.latency] : 0.5,
  };
}
