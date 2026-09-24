import { z } from "zod";

/**
 * Gateway-level request validation (spec section 13). Runs before any
 * pipeline stage — a malformed request never reaches Scout, let alone an
 * AI provider.
 */
export const TaskSchema = z.object({
  task: z.string().min(1).max(50000),
  privacy: z.enum(["low", "medium", "high"]).optional(),
  accuracy: z.number().min(0).max(1).optional(),
  latency: z.enum(["low", "medium", "high"]).optional(),
});

export type ValidatedTaskRequest = z.infer<typeof TaskSchema>;
