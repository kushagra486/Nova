import type { ScoutResult } from "./types";
import { extractCodeBlock } from "./executors/code-sandbox";

const ARITHMETIC_RE = /^[\s\d+\-*/().%^]+$/;
const EMAIL_EXTRACT_RE = /extract.*email|find.*email address/i;
const CLASSIFY_RE = /categor|classif|tag|label these|sentiment/i;
const REASONING_RE = /analy[sz]e|research|contradict|conflict|compar|reason|explain why|prove|strategy/i;
const CODE_RE = /```|function |def |class |bug|refactor|write (a|an|the) (script|program|function|code)/i;
const SUMMARY_RE = /summari[sz]e|tl;?dr|shorten/i;
const CODE_EXECUTION_INTENT_RE = /\b(run|execute)\b|what (does|will) this (print|output|do)|output of this/i;
const WEB_SEARCH_RE = /^(please\s+)?(search( the web)?|google|look\s?up)\b/i;

/**
 * Scout performs lightweight, deterministic intent classification on the raw
 * request text before any AI is invoked.
 */
export function runScout(text: string): ScoutResult {
  const trimmed = text.trim();

  if (trimmed.length > 0 && ARITHMETIC_RE.test(trimmed) && /\d/.test(trimmed)) {
    return {
      taskType: "calculation",
      inputType: "expression",
      estimatedComplexity: 0.02,
      requiresTools: ["calculator"],
      expectedOutputFormat: "number",
    };
  }

  if (extractCodeBlock(trimmed) && CODE_EXECUTION_INTENT_RE.test(trimmed)) {
    return {
      taskType: "code_execution",
      inputType: "code",
      estimatedComplexity: 0.05,
      requiresTools: ["sandbox"],
      expectedOutputFormat: "text",
    };
  }

  if (EMAIL_EXTRACT_RE.test(trimmed) || /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
    if (/extract|find|list|pull out/i.test(trimmed)) {
      return {
        taskType: "extraction",
        inputType: "text",
        estimatedComplexity: 0.05,
        requiresTools: ["regex"],
        expectedOutputFormat: "list",
      };
    }
  }

  if (WEB_SEARCH_RE.test(trimmed)) {
    return {
      taskType: "web_search",
      inputType: "text",
      estimatedComplexity: 0.05,
      requiresTools: ["web_search"],
      expectedOutputFormat: "list",
    };
  }

  if (CODE_RE.test(trimmed)) {
    return {
      taskType: "coding",
      inputType: "text",
      estimatedComplexity: 0.72,
      requiresTools: ["code_model"],
      expectedOutputFormat: "code",
    };
  }

  if (SUMMARY_RE.test(trimmed)) {
    return {
      taskType: "summarization",
      inputType: "document",
      estimatedComplexity: 0.5,
      requiresTools: ["language_model"],
      expectedOutputFormat: "text",
    };
  }

  if (REASONING_RE.test(trimmed)) {
    return {
      taskType: "reasoning",
      inputType: "document",
      estimatedComplexity: 0.85,
      requiresTools: ["reasoning_model", "retrieval"],
      expectedOutputFormat: "text",
    };
  }

  if (CLASSIFY_RE.test(trimmed)) {
    return {
      taskType: "classification",
      inputType: "text",
      estimatedComplexity: 0.3,
      requiresTools: ["lightweight_model"],
      expectedOutputFormat: "label",
    };
  }

  return {
    taskType: "general_query",
    inputType: "text",
    estimatedComplexity: Math.min(0.9, 0.2 + trimmed.length / 800),
    requiresTools: ["language_model"],
    expectedOutputFormat: "text",
  };
}
