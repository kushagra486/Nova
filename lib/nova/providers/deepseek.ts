import type { AIProvider, AIRequest, AIResponse, ModelInfo, UsageEstimate } from "./types";

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_API_BASE_URL ?? "https://api.deepseek.com/v1";

const MODELS: ModelInfo[] = [
  { name: "deepseek-flash", type: "reasoning", contextWindow: 1_000_000, toolCalling: true },
];

/**
 * DeepSeek API adapter (secondary provider). Used as a fallback when
 * NVIDIA is unavailable or rate-limited. The direct API is usage-priced,
 * not permanently free — see NVIDIA for the free development endpoints.
 */
export const deepseekProvider: AIProvider = {
  id: "deepseek",
  name: "DeepSeek",

  isConfigured() {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  },

  models() {
    return MODELS;
  },

  defaultModel() {
    return "deepseek-flash";
  },

  async healthCheck() {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
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
      estimatedLatencyMs: 900,
    };
  },

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }
    const model = request.model ?? this.defaultModel("general_query");
    const start = Date.now();

    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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
      throw new Error(`DeepSeek API error: ${res.status} ${await res.text()}`);
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
