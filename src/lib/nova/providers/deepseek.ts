import OpenAI from "openai";
import type { AIProvider, AIRequest, AIResponse, ModelInfo, UsageEstimate } from "./types";

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_API_BASE_URL ?? "https://api.deepseek.com/v1";

const MODELS: ModelInfo[] = [
  { name: "deepseek-flash", type: "reasoning", contextWindow: 1_000_000, toolCalling: true },
];

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_BASE_URL,
    });
  }
  return cachedClient;
}

/**
 * DeepSeek API adapter (secondary provider), kept as a separate adapter
 * from NVIDIA's hosted DeepSeek NIM endpoint per the OpenAI-compatible
 * `openai` SDK. Used as a fallback when NVIDIA is unavailable or
 * rate-limited. The direct API is usage-priced, not permanently free —
 * see NVIDIA for the free development endpoints.
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

  escalatedModel() {
    // DeepSeek's direct API currently exposes a single model tier, so
    // there is no stronger model to escalate to on this provider.
    return "deepseek-flash";
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
      estimatedLatencyMs: 900,
    };
  },

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
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
