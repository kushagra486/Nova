import type { AIProvider, AIRequest, AIResponse, ModelInfo, UsageEstimate } from "./types";

const NVIDIA_BASE_URL = process.env.NVIDIA_API_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

const MODELS: ModelInfo[] = [
  { name: "deepseek-ai/deepseek-v4.1-flash", type: "reasoning", contextWindow: 1_000_000, toolCalling: true },
  { name: "zai-org/glm-5-3", type: "reasoning", contextWindow: 128_000, toolCalling: true },
  { name: "zai-org/glm-5-3-flash", type: "multimodal", contextWindow: 128_000, toolCalling: true },
  { name: "nvidia/nemotron-3.5-lightning", type: "lightweight", contextWindow: 32_000, toolCalling: false },
  { name: "nvidia/nemotron-3-ultra", type: "reasoning", contextWindow: 128_000, toolCalling: true },
];

/**
 * NVIDIA NIM/API adapter. Uses the OpenAI-compatible chat completions
 * endpoint exposed by NVIDIA's model catalog. Free development endpoints
 * are subject to NVIDIA's own quota/availability policy.
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
    if (taskType === "classification") return "nvidia/nemotron-3.5-lightning";
    return "zai-org/glm-5-3-flash";
  },

  async healthCheck() {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${NVIDIA_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
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

    const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: request.prompt }],
        max_tokens: request.maxTokens ?? 512,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`NVIDIA API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    return {
      text,
      model,
      tokensInput: data.usage?.prompt_tokens ?? Math.ceil(request.prompt.length / 4),
      tokensOutput: data.usage?.completion_tokens ?? Math.ceil(text.length / 4),
      latencyMs: Date.now() - start,
    };
  },
};
