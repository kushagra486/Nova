import type { AIProvider } from "./types";
import { nvidiaProvider } from "./nvidia";
import { deepseekProvider } from "./deepseek";

/** Ordered primary → secondary. Router falls back down this list on failure. */
export const providers: AIProvider[] = [nvidiaProvider, deepseekProvider];

export function getProvider(id: string): AIProvider | undefined {
  return providers.find((p) => p.id === id);
}
