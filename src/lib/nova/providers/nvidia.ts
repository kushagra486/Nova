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

// Verified live against NVIDIA's endpoint (not assumed): most reasoning-capable
// models here (nemotron-3-ultra, both glm-5.3 variants, deepseek-v4.1-flash)
// emit delta.reasoning_content on their own with no special request params —
// generate() below always captures it opportunistically. nemotron-3.5-lightning
// is the one exception: it needs chat_template_kwargs.enable_thinking +
// reasoning_budget to unlock thinking mode at all, and — confirmed by testing —
// sending those same params to the other models breaks them (400/500), so this
// opt-in is scoped to exactly the models that need it, not a general "reasoning" flag.
const THINKING_OPT_IN_MODELS = new Set(["nvidia/nemotron-3.5-lightning-30b-a3b"]);

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
    const maxTokens = request.maxTokens ?? 512;
    const start = Date.now();

    const params: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: request.prompt }],
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (THINKING_OPT_IN_MODELS.has(model)) {
      params.chat_template_kwargs = { enable_thinking: true };
      params.reasoning_budget = maxTokens;
    }

    const stream = await getClient().chat.completions.create(
      params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      { signal: AbortSignal.timeout(60000) }
    );

    let text = "";
    let reasoningText = "";
    let tokensInput = 0;
    let tokensOutput = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta as { content?: string | null; reasoning_content?: string | null } | undefined;
      if (delta?.reasoning_content) reasoningText += delta.reasoning_content;
      if (delta?.content) text += delta.content;
      if (chunk.usage) {
        tokensInput = chunk.usage.prompt_tokens;
        tokensOutput = chunk.usage.completion_tokens;
      }
    }

    return {
      text,
      model,
      reasoningText: reasoningText || undefined,
      tokensInput: tokensInput || Math.ceil(request.prompt.length / 4),
      tokensOutput: tokensOutput || Math.ceil(text.length / 4),
      latencyMs: Date.now() - start,
    };
  },
};
