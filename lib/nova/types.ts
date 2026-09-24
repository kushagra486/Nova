export type PrivacyClass = "P0" | "P1" | "P2" | "P3";

export type ExecutorKind =
  | "deterministic"
  | "specialized"
  | "ai"
  | "blocked";

export interface TaskRequest {
  task: string;
  privacy?: "low" | "medium" | "high";
  accuracy?: number;
  latency?: "low" | "medium" | "high";
}

export interface ScoutResult {
  taskType: string;
  inputType: string;
  estimatedComplexity: number;
  requiresTools: string[];
  expectedOutputFormat: string;
}

export interface PiiFinding {
  type: "email" | "phone" | "api_key" | "credential" | "name" | "financial";
  match: string;
  redacted: string;
}

export interface GuardianResult {
  privacyClass: PrivacyClass;
  findings: PiiFinding[];
  redactedText: string;
  externalTransmissionAllowed: boolean;
}

export interface ThinkerProfile {
  taskComplexity: number;
  reasoningRequirement: number;
  privacySensitivity: number;
  accuracyRequirement: number;
  latencyRequirement: number;
}

export interface RoutingDecision {
  executor: ExecutorKind;
  executorName: string;
  provider: string | null;
  model: string | null;
  score: number;
  reason: string;
}

export interface ProviderHealth {
  id: string;
  name: string;
  online: boolean;
  configured: boolean;
  latencyMs: number | null;
  /** Rolling success rate from real generate() outcomes; feeds the Router's NØVA score. */
  reliability: number;
}

export interface ExecutionResult {
  output: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  success: boolean;
}

export interface VerificationResult {
  passed: boolean;
  confidence: number;
  issues: string[];
}

export interface TraceStep {
  step: string;
  detail: string;
  timestampMs: number;
}

export interface NovaResponse {
  taskId: string | null;
  taskType: string;
  complexity: number;
  privacy: number;
  privacyClass: PrivacyClass;
  selectedExecutor: ExecutorKind;
  executorName: string;
  provider: string | null;
  model: string | null;
  reason: string;
  output: string;
  verified: boolean;
  verification: VerificationResult;
  aiCallsUsed: number;
  tokensUsed: number;
  latencyMs: number;
  trace: TraceStep[];
}
