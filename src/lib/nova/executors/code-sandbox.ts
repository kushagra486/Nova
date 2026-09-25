/**
 * Level 2 "specialized tool" execution: runs a given code snippet in an
 * isolated container and returns its actual output — no LLM guesses what
 * the code does.
 *
 * Uses Wandbox (https://wandbox.org), a long-running free, keyless,
 * publicly hosted compile-and-run API — genuinely a sandbox (each request
 * runs in an isolated environment on Wandbox's infrastructure), genuinely
 * no cost, nothing runs on this process or host. (Piston, the more
 * commonly cited option, restricted its public API to a whitelist in
 * February 2026 — verified live while building this, not assumed from
 * training data — so it no longer fits "no cost, no signup".)
 *
 * Known limitation: unlike the AI path, this sends the *raw* code, not
 * Guardian's redacted text — redacting a code snippet (replacing a string
 * literal with "[EMAIL]") would silently change its behavior or break its
 * syntax. Guardian's hard P3 block still applies upstream, so credentials/
 * API keys never reach here; anything below that bar (P0-P2) is sent as-is.
 */

const WANDBOX_URL = process.env.WANDBOX_API_URL ?? "https://wandbox.org/api/compile.json";

const LANGUAGE_COMPILERS: Record<string, string> = {
  python: "cpython-3.10.15",
  python3: "cpython-3.10.15",
  javascript: "nodejs-20.17.0",
  js: "nodejs-20.17.0",
  typescript: "typescript-5.6.2",
  ts: "typescript-5.6.2",
  java: "openjdk-jdk-22+36",
  c: "gcc-13.2.0-c",
  cpp: "gcc-13.2.0",
  "c++": "gcc-13.2.0",
  go: "go-1.23.2",
  ruby: "ruby-3.4.9",
  rust: "rust-1.82.0",
  bash: "bash",
  sh: "bash",
};

export interface ExtractedCodeBlock {
  language: string;
  code: string;
}

const CODE_FENCE_RE = /```(\w+)?\n([\s\S]*?)```/;

export function extractCodeBlock(task: string): ExtractedCodeBlock | null {
  const match = task.match(CODE_FENCE_RE);
  if (!match || !match[2].trim()) return null;
  const language = (match[1] || "python").toLowerCase();
  return { language, code: match[2] };
}

export function isLanguageSupported(language: string): boolean {
  return language in LANGUAGE_COMPILERS;
}

export interface CodeExecutionResult {
  language: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCodeSandboxed(language: string, code: string): Promise<CodeExecutionResult> {
  const compiler = LANGUAGE_COMPILERS[language];
  if (!compiler) {
    throw new Error(`Unsupported language for the sandbox: "${language}"`);
  }

  const res = await fetch(WANDBOX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, compiler }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Sandbox API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    language,
    stdout: data.program_output ?? "",
    stderr: [data.compiler_error, data.program_error].filter(Boolean).join("\n"),
    exitCode: Number(data.status ?? 0),
  };
}

export function formatCodeExecutionOutput(result: CodeExecutionResult): string {
  const parts: string[] = [];
  if (result.stdout.trim()) parts.push(result.stdout.trim());
  if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr.trim()}`);
  if (parts.length === 0) parts.push("(no output)");
  parts.push(`[exit code ${result.exitCode}]`);
  return parts.join("\n\n");
}
