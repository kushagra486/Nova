import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runNovaPipeline } from "../../lib/nova/pipeline";
import tasks from "../datasets/tasks.json";

/**
 * Compares NØVA's adaptive routing against a "conventional AI app" baseline
 * that sends every request straight to an LLM with no classification,
 * deterministic short-circuiting or privacy screening (the architecture
 * described in section 3 of the spec). This does not require AI provider
 * keys: it measures routing decisions (what would be sent to a model and
 * why), not model output quality — see the report's `notes` field.
 */

interface BenchmarkTask {
  id: string;
  category: string;
  task: string;
}

interface TaskResult {
  id: string;
  category: string;
  novaExecutor: string;
  novaExecutorName: string;
  novaPrivacyClass: string;
  /** Router decided this task needed a model call — independent of whether a provider key was configured. */
  routedToAi: boolean;
  /** A model call actually completed (requires a configured provider). */
  aiCallSucceeded: boolean;
  baselineAiCallUsed: true;
  estimatedTokensIfSentToAi: number;
  novaTokensUsed: number;
}

function estimateTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4) + 512;
}

async function main() {
  const dataset = tasks as BenchmarkTask[];
  const results: TaskResult[] = [];

  for (const item of dataset) {
    const response = await runNovaPipeline({ task: item.task });
    results.push({
      id: item.id,
      category: item.category,
      novaExecutor: response.selectedExecutor,
      novaExecutorName: response.executorName,
      novaPrivacyClass: response.privacyClass,
      routedToAi: response.selectedExecutor === "ai",
      aiCallSucceeded: response.aiCallsUsed > 0,
      baselineAiCallUsed: true,
      estimatedTokensIfSentToAi: estimateTokens(item.task),
      novaTokensUsed: response.tokensUsed,
    });
  }

  const totalTasks = results.length;
  const routedToAiCount = results.filter((r) => r.routedToAi).length;
  const aiCallsSucceededCount = results.filter((r) => r.aiCallSucceeded).length;
  const baselineAiCalls = totalTasks; // every task, unconditionally, in the baseline
  const deterministicTasks = results.filter((r) => r.novaExecutor === "deterministic").length;
  const blockedTasks = results.filter((r) => r.novaExecutor === "blocked").length;
  const tokensBaselineWouldSpend = results.reduce((sum, r) => sum + r.estimatedTokensIfSentToAi, 0);
  // "Avoided by design" = the Router chose a non-AI path (deterministic or blocked), not merely
  // that a call failed for lack of a configured provider key.
  const tokensNovaAvoided = results
    .filter((r) => !r.routedToAi)
    .reduce((sum, r) => sum + r.estimatedTokensIfSentToAi, 0);

  const byCategory: Record<
    string,
    { total: number; deterministic: number; blocked: number; routedToAi: number; aiCallsSucceeded: number }
  > = {};
  for (const r of results) {
    byCategory[r.category] ??= { total: 0, deterministic: 0, blocked: 0, routedToAi: 0, aiCallsSucceeded: 0 };
    byCategory[r.category].total += 1;
    if (r.novaExecutor === "deterministic") byCategory[r.category].deterministic += 1;
    if (r.novaExecutor === "blocked") byCategory[r.category].blocked += 1;
    if (r.routedToAi) byCategory[r.category].routedToAi += 1;
    if (r.aiCallSucceeded) byCategory[r.category].aiCallsSucceeded += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sampleSize: totalTasks,
    hypothesis: "H1: adaptive routing reduces unnecessary AI execution while maintaining task quality (section 43).",
    notes:
      "AI call counts reflect what NØVA's Router *decided* to send to a model, not model output quality. " +
      "Accuracy/quality comparison requires live NVIDIA_API_KEY / DEEPSEEK_API_KEY and is not measured here.",
    summary: {
      totalTasks,
      baselineAiCalls,
      novaRoutedToAiCalls: routedToAiCount,
      novaAiCallsSucceeded: aiCallsSucceededCount,
      aiCallsAvoidedPct: Math.round(((baselineAiCalls - routedToAiCount) / baselineAiCalls) * 100),
      deterministicTasks,
      blockedTasks,
      tokensBaselineWouldSpend,
      tokensNovaAvoided,
      tokensSavedPct: Math.round((tokensNovaAvoided / tokensBaselineWouldSpend) * 100),
    },
    byCategory,
    results,
  };

  console.log("\nNØVA Benchmark — Adaptive Routing vs. Always-AI Baseline\n" + "=".repeat(58));
  console.log(`Sample size:            ${totalTasks}`);
  console.log(`Baseline AI calls:      ${baselineAiCalls}`);
  console.log(`NØVA calls routed to AI:${routedToAiCount} (${aiCallsSucceededCount} actually completed — needs provider keys)`);
  console.log(`AI calls avoided:       ${report.summary.aiCallsAvoidedPct}%`);
  console.log(`Deterministic tasks:    ${deterministicTasks}`);
  console.log(`Blocked (Guardian):     ${blockedTasks}`);
  console.log(`Est. tokens saved:      ${tokensNovaAvoided} / ${tokensBaselineWouldSpend} (${report.summary.tokensSavedPct}%)`);
  console.log("\nBy category:");
  for (const [category, stats] of Object.entries(byCategory)) {
    console.log(
      `  ${category.padEnd(20)} total=${stats.total} deterministic=${stats.deterministic} blocked=${stats.blocked} routed_to_ai=${stats.routedToAi} ai_calls_succeeded=${stats.aiCallsSucceeded}`
    );
  }

  const outPath = join(__dirname, "..", "reports", "latest.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
