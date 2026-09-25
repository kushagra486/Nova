import { z } from "zod";

/**
 * Gateway-level request validation (spec section 13). Runs before any
 * pipeline stage — a malformed request never reaches Scout, let alone an
 * AI provider.
 */
export const TaskSchema = z.object({
  task: z.string().max(50000),
  privacy: z.enum(["low", "medium", "high"]).optional(),
  accuracy: z.number().min(0).max(1).optional(),
  latency: z.enum(["low", "medium", "high"]).optional(),
  /** User's explicit consent to proceed despite a Guardian privacy finding. */
  overridePrivacy: z.boolean().optional(),
  /** Base64-encoded PDF (~3MB decoded max, enforced in the extractor; kept under Vercel's ~4.5MB request body cap). */
  fileBase64: z.string().max(4_200_000).optional(),
  fileName: z.string().max(255).optional(),
}).refine((data) => data.task.length > 0 || Boolean(data.fileBase64), {
  message: "Either task text or a file is required",
  path: ["task"],
});

export type ValidatedTaskRequest = z.infer<typeof TaskSchema>;
