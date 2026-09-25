import type { AIProvider } from "./types";
import { nvidiaProvider } from "./nvidia";

/**
 * NVIDIA NIM is the only provider: it's free (no funded account required) and
 * already exposes DeepSeek's own model (deepseek-ai/deepseek-v4.1-flash)
 * alongside others, so a separate paid direct-to-DeepSeek provider added a
 * funding dependency without adding capability.
 */
export const providers: AIProvider[] = [nvidiaProvider];

export function getProvider(id: string): AIProvider | undefined {
  return providers.find((p) => p.id === id);
}
