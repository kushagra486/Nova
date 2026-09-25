export interface ModelInfo {
  name: string;
  type: "reasoning" | "lightweight" | "coding" | "multimodal" | "embedding";
  contextWindow: number;
  toolCalling: boolean;
}

export interface AIRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  /** Chain-of-thought/thinking trace, for models that expose one (see AIProvider docs). */
  reasoningText?: string;
}

export interface UsageEstimate {
  estimatedTokens: number;
  estimatedLatencyMs: number;
}

export interface AIProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  models(): ModelInfo[];
  defaultModel(taskType: string): string;
  /** A strictly stronger model than defaultModel() for the same task, used on verification failure. */
  escalatedModel(taskType: string): string;
  healthCheck(): Promise<boolean>;
  estimate(request: AIRequest): UsageEstimate;
  generate(request: AIRequest): Promise<AIResponse>;
}
