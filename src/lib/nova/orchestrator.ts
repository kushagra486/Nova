import type { NovaResponse, ScoutResult, TaskRequest, TraceStep } from "./types";
import { runScout } from "./scout";
import { runGuardian, privacyClassToScore } from "./guardian";
import { runThinker } from "./thinker";
import { runRouter } from "./router";
import { runVerifier } from "./verifier";
import { evaluateArithmetic, extractEmails } from "./executors/deterministic";
import { extractSearchQuery, webSearch, formatWebSearchOutput } from "./executors/web-search";
import {
  extractCodeBlock,
  isLanguageSupported,
  runCodeSandboxed,
  formatCodeExecutionOutput,
} from "./executors/code-sandbox";
import { extractPdfText, formatPdfExtractionOutput } from "./executors/pdf-extract";
import { getProvider, providers } from "./providers/registry";
import { recordOutcome } from "./providers/health-tracker";
import { persistPipelineRun } from "./persistence";

/** A bare "extract/scan/read" instruction (or no instruction at all) means: just give me the text, zero AI. */
const EXTRACTION_ONLY_RE = /^(extract|scan|read|ocr)\b/i;

/**
 * The full NØVA agent loop: OBSERVE -> UNDERSTAND -> PLAN -> SELECT ->
 * EXECUTE -> VERIFY -> RESPOND. Each stage appends a trace step so the
 * decision is explainable end to end.
 */
export async function novaOrchestrator(request: TaskRequest, userId: string | null = null): Promise<NovaResponse> {
  const started = Date.now();
  const trace: TraceStep[] = [];
  const mark = (step: string, detail: string) =>
    trace.push({ step, detail, timestampMs: Date.now() - started });

  let documentText = "";
  let documentPages = 0;

  if (request.fileBase64) {
    mark(
      "request_received",
      `Task: "${request.task.slice(0, 120)}" (+ attached file${request.fileName ? `: ${request.fileName}` : ""})`
    );
    try {
      const extraction = await extractPdfText(request.fileBase64);
      documentText = extraction.text;
      documentPages = extraction.numPages;
      mark("pdf_extraction", `Extracted ${documentText.length} chars from ${documentPages} page(s) locally — zero AI calls`);
    } catch (err) {
      const message = (err as Error).message;
      mark("pdf_extraction", `Failed: ${message}`);
      const latencyMs = Date.now() - started;
      mark("respond", `total_latency_ms=${latencyMs}`);
      return {
        taskId: null,
        taskType: "document_extraction",
        complexity: 0,
        privacy: 0,
        privacyClass: "P0",
        selectedExecutor: "specialized",
        executorName: "pdf_extractor",
        provider: null,
        model: null,
        reason: "PDF extraction failed.",
        output: `Could not read this PDF: ${message}`,
        verified: false,
        verification: { passed: false, confidence: 0, issues: [message] },
        aiCallsUsed: 0,
        tokensUsed: 0,
        latencyMs,
        trace,
        requiresApproval: false,
        findings: [],
      };
    }
  } else {
    mark("request_received", `Task: "${request.task.slice(0, 120)}"`);
  }

  const question = request.task.trim();
  const wantsExtractionOnly = Boolean(documentText) && (!question || EXTRACTION_ONLY_RE.test(question));
  const effectiveText = documentText
    ? wantsExtractionOnly
      ? documentText
      : `${question}\n\nDocument content:\n${documentText}`
    : request.task;

  const scout: ScoutResult = wantsExtractionOnly
    ? {
        taskType: "document_extraction",
        inputType: "document",
        estimatedComplexity: 0.05,
        requiresTools: ["pdf_parser"],
        expectedOutputFormat: "text",
      }
    : runScout(effectiveText);
  mark("scout_classified", `type=${scout.taskType} complexity=${scout.estimatedComplexity.toFixed(2)}`);

  const guardian = runGuardian(effectiveText);
  mark(
    "guardian_scan",
    `privacy_class=${guardian.privacyClass} findings=${guardian.findings.length} allowed=${guardian.externalTransmissionAllowed}`
  );

  const thinker = runThinker(scout, privacyClassToScore(guardian.privacyClass), request);
  mark(
    "thinker_profile",
    `reasoning=${thinker.reasoningRequirement.toFixed(2)} privacy=${thinker.privacySensitivity.toFixed(2)} latency=${thinker.latencyRequirement.toFixed(2)}`
  );

  const routing = wantsExtractionOnly
    ? {
        executor: "specialized" as const,
        executorName: "pdf_extractor",
        provider: null,
        model: null,
        score: 1,
        reason: `PDF text extracted locally from ${documentPages} page(s) — zero AI calls.`,
      }
    : runRouter(scout, guardian, thinker, request.overridePrivacy ?? false);
  mark("router_decision", `${routing.executor}/${routing.executorName} — ${routing.reason}`);

  let output = "";
  let tokensInput = 0;
  let tokensOutput = 0;
  let success = true;
  let aiCallsUsed = 0;
  let usedProvider = routing.provider;
  let usedModel = routing.model;

  if (routing.executor === "blocked") {
    output = `This request was blocked by Guardian: ${routing.reason}`;
    success = false;
  } else if (routing.executor === "deterministic" && routing.executorName === "calculator") {
    try {
      const result = evaluateArithmetic(request.task);
      output = String(result);
      mark("execution", `deterministic calculator -> ${output}`);
    } catch (err) {
      output = `Could not evaluate expression: ${(err as Error).message}`;
      success = false;
    }
  } else if (routing.executor === "deterministic" && routing.executorName === "regex_extractor") {
    const emails = extractEmails(request.task);
    output = emails.length > 0 ? emails.join(", ") : "No email addresses found.";
    mark("execution", `regex extractor -> ${emails.length} match(es)`);
  } else if (routing.executor === "specialized" && routing.executorName === "web_search") {
    try {
      const query = extractSearchQuery(guardian.redactedText);
      const searchResult = await webSearch(query);
      output = formatWebSearchOutput(searchResult);
      mark("execution", `web search "${query}" -> ${searchResult.results.length} result(s)`);
    } catch (err) {
      output = `Web search failed: ${(err as Error).message}`;
      success = false;
    }
  } else if (routing.executor === "specialized" && routing.executorName === "pdf_extractor") {
    output = formatPdfExtractionOutput({ text: documentText, numPages: documentPages });
    mark("execution", `pdf extractor -> ${documentText.length} chars from ${documentPages} page(s)`);
  } else if (routing.executor === "specialized" && routing.executorName === "code_sandbox") {
    const block = extractCodeBlock(request.task);
    if (!block) {
      output = "No code block found to execute.";
      success = false;
    } else if (!isLanguageSupported(block.language)) {
      output = `"${block.language}" isn't supported by the sandbox.`;
      success = false;
    } else {
      try {
        const result = await runCodeSandboxed(block.language, block.code);
        output = formatCodeExecutionOutput(result);
        success = result.exitCode === 0;
        mark("execution", `sandbox ${block.language} -> exit ${result.exitCode}`);
      } catch (err) {
        output = `Sandbox execution failed: ${(err as Error).message}`;
        success = false;
      }
    }
  } else if (routing.executor === "ai" && routing.provider) {
    const provider = getProvider(routing.provider);
    let lastError: Error | null = null;
    const attempted = provider ? [provider, ...providers.filter((p) => p.id !== provider.id && p.isConfigured())] : [];

    for (const candidate of attempted) {
      try {
        const model = candidate.id === routing.provider ? routing.model! : candidate.defaultModel(scout.taskType);
        const response = await candidate.generate({ prompt: guardian.redactedText, model });
        output = response.text;
        tokensInput = response.tokensInput;
        tokensOutput = response.tokensOutput;
        aiCallsUsed += 1;
        usedProvider = candidate.id;
        usedModel = model;
        recordOutcome(candidate.id, true);
        mark("execution", `${candidate.name}/${model} -> ${tokensOutput} tokens generated`);
        if (response.reasoningText) {
          mark("reasoning", response.reasoningText.slice(0, 300) + (response.reasoningText.length > 300 ? "…" : ""));
        }
        lastError = null;
        break;
      } catch (err) {
        lastError = err as Error;
        recordOutcome(candidate.id, false);
        mark("provider_failure", `${candidate.name} failed: ${lastError.message}`);
      }
    }

    if (lastError) {
      output = `All configured AI providers failed. Last error: ${lastError.message}`;
      success = false;
    }
  } else {
    output = routing.reason;
    success = false;
  }

  let verification = runVerifier(output, routing.executor === "deterministic");
  mark("verification", `passed=${verification.passed} confidence=${verification.confidence}`);

  if (!verification.passed && routing.executor === "ai" && success && usedProvider) {
    const provider = getProvider(usedProvider)!;
    const strongerModel = provider.escalatedModel(scout.taskType);

    if (strongerModel !== usedModel) {
      try {
        const response = await provider.generate({ prompt: guardian.redactedText, model: strongerModel });
        aiCallsUsed += 1;
        recordOutcome(provider.id, true);
        const escalatedVerification = runVerifier(response.text, false);
        mark(
          "escalation",
          `${provider.name}/${strongerModel} -> passed=${escalatedVerification.passed} confidence=${escalatedVerification.confidence}`
        );
        if (response.reasoningText) {
          mark("reasoning", response.reasoningText.slice(0, 300) + (response.reasoningText.length > 300 ? "…" : ""));
        }

        output = response.text;
        tokensInput += response.tokensInput;
        tokensOutput += response.tokensOutput;
        usedModel = strongerModel;
        verification = escalatedVerification;
      } catch (err) {
        recordOutcome(provider.id, false);
        mark("escalation", `${provider.name}/${strongerModel} failed: ${(err as Error).message}`);
      }
    } else {
      mark("escalation", `No stronger model available on ${provider.name} for this task type.`);
    }
  }

  const latencyMs = Date.now() - started;
  const finalRouting = { ...routing, provider: usedProvider, model: usedModel };

  const taskId = await persistPipelineRun({
    request,
    scout,
    guardian,
    thinker,
    routing: finalRouting,
    verification,
    outcome: { tokensInput, tokensOutput, latencyMs, success },
    userId,
  });
  mark("persisted", taskId ? `task_id=${taskId}` : "skipped (Supabase not configured)");
  mark("respond", `total_latency_ms=${latencyMs}`);

  return {
    taskId,
    taskType: scout.taskType,
    complexity: scout.estimatedComplexity,
    privacy: thinker.privacySensitivity,
    privacyClass: guardian.privacyClass,
    selectedExecutor: routing.executor,
    executorName: routing.executorName,
    provider: usedProvider,
    model: usedModel,
    reason: routing.reason,
    output,
    verified: verification.passed && success,
    verification,
    aiCallsUsed,
    tokensUsed: tokensInput + tokensOutput,
    latencyMs,
    trace,
    requiresApproval: routing.executor === "needs_approval",
    findings: [...new Set(guardian.findings.map((f) => f.type))],
  };
}
