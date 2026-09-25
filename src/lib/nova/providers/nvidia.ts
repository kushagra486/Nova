import OpenAI from "openai";
import type { AIProvider, AIRequest, AIResponse, ModelInfo, UsageEstimate } from "./types";

const NVIDIA_BASE_URL = process.env.NVIDIA_API_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

const MODELS: ModelInfo[] = [
  { name: "deepseek-ai/deepseek-v4.1-flash", type: "reasoning", contextWindow: 1_000_000, toolCalling: true },
  { name: "z-ai/glm-5.3", type: "reasoning", contextWindow: 128_000, toolCalling: true },
  { name: "z-ai/glm-5.3-flash", type: "multimodal", contextWindow: 128_000, toolCalling: true },
  { name: "nvidia/nemotron-3.5-lightning-30b-a3b", type: "lightweight", contextWindow: 32_000, toolCalling: false },
  { name: "nvidia/nemotron-3-ultra-550b-a55b", type: "reasoning", contextWindow: 128_000, toolCalling: true },
];

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: NVIDIA_BASE_URL,
    });
  }
  return cachedClient;
}

/**
 * NVIDIA NIM adapter. NVIDIA's hosted NIM endpoints (on DGX Cloud) expose an
 * OpenAI-compatible chat completions API, so this uses the `openai` SDK
 * pointed at NVIDIA's baseURL rather than a bespoke fetch client. Model IDs
 * should be kept in sync with whatever the NVIDIA catalog currently lists —
 * the ones below are a snapshot, not a permanent guarantee of availability.
 * Free development endpoints are subject to NVIDIA's own quota/availability policy.
 */
export const nvidiaProvider: AIProvider = {
  id: "nvidia",
  name: "NVIDIA NIM",

  isConfigured() {
    return Boolean(process.env.NVIDIA_API_KEY);
  },

  models() {
    return MODELS;
  },

  defaultModel(taskType: string) {
    if (taskType === "coding" || taskType === "reasoning") return "deepseek-ai/deepseek-v4.1-flash";
    if (taskType === "classification") return "nvidia/nemotron-3.5-lightning-30b-a3b";
    return "z-ai/glm-5.3-flash";
  },

  escalatedModel(taskType: string) {
    if (taskType === "coding" || taskType === "reasoning") return "nvidia/nemotron-3-ultra-550b-a55b";
    return "z-ai/glm-5.3";
  },

  async healthCheck() {
    if (!this.isConfigured()) return false;
    try {
      await getClient().models.list({ signal: AbortSignal.timeout(5000) });
      return true;
    } catch {
      return false;
    }
  },

  estimate(request: AIRequest): UsageEstimate {
    return {
      estimatedTokens: Math.ceil(request.prompt.length / 4) + (request.maxTokens ?? 512),
      estimatedLatencyMs: 600,
    };
  },

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new Error("NVIDIA_API_KEY is not configured");
    }
    const model = request.model ?? this.defaultModel("general_query");
    const start = Date.now();

    const completion = await getClient().chat.completions.create(
      {
        model,
        messages: [{ role: "user", content: request.prompt }],
        max_tokens: request.maxTokens ?? 512,
      },
      { signal: AbortSignal.timeout(30000) }
    );

    const text = completion.choices[0]?.message?.content ?? "";

    return {
      text,
      model,
      tokensInput: completion.usage?.prompt_tokens ?? Math.ceil(request.prompt.length / 4),
      tokensOutput: completion.usage?.completion_tokens ?? Math.ceil(text.length / 4),
      latencyMs: Date.now() - start,
    };
  },
};
