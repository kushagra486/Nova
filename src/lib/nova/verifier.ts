import type { VerificationResult } from "./types";

/**
 * Independently checks execution output before it's returned to the user.
 * Deterministic paths are trusted (their correctness is provable by
 * construction); AI output gets a lightweight sanity check.
 */
export function runVerifier(output: string, wasDeterministic: boolean): VerificationResult {
  if (wasDeterministic) {
    return { passed: true, confidence: 1, issues: [] };
  }

  const issues: string[] = [];
  if (!output || output.trim().length === 0) {
    issues.push("Empty output");
  }
  if (output.length > 20000) {
    issues.push("Output exceeds expected length bound");
  }

  return {
    passed: issues.length === 0,
    confidence: issues.length === 0 ? 0.85 : 0.3,
    issues,
  };
}
