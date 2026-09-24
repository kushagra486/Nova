import type { GuardianResult, PiiFinding, PrivacyClass } from "./types";

const PATTERNS: { type: PiiFinding["type"]; regex: RegExp; label: string }[] = [
  { type: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "EMAIL" },
  { type: "phone", regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, label: "PHONE" },
  {
    type: "api_key",
    regex: /\b(sk-[a-zA-Z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|ghp_[a-zA-Z0-9]{20,})\b/g,
    label: "API_KEY",
  },
  {
    type: "credential",
    regex: /\b(password|passwd|secret|token)\s*[:=]\s*\S+/gi,
    label: "CREDENTIAL",
  },
  {
    type: "financial",
    regex: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    label: "FINANCIAL",
  },
];

/**
 * Detects PII/secrets and classifies the request into a privacy class.
 * P3 (credentials/API keys) is blocked from external transmission by default.
 */
export function runGuardian(text: string): GuardianResult {
  const findings: PiiFinding[] = [];
  let redactedText = text;

  for (const pattern of PATTERNS) {
    const matches = text.match(pattern.regex) ?? [];
    for (const match of matches) {
      findings.push({ type: pattern.type, match, redacted: `[${pattern.label}]` });
      redactedText = redactedText.replaceAll(match, `[${pattern.label}]`);
    }
  }

  const hasP3 = findings.some((f) => f.type === "api_key" || f.type === "credential");
  const hasP2 = findings.some((f) => f.type === "financial");
  const hasP1 = findings.some((f) => f.type === "email" || f.type === "phone");

  let privacyClass: PrivacyClass = "P0";
  if (hasP3) privacyClass = "P3";
  else if (hasP2) privacyClass = "P2";
  else if (hasP1) privacyClass = "P1";

  return {
    privacyClass,
    findings,
    redactedText,
    externalTransmissionAllowed: privacyClass !== "P3",
  };
}

export function privacyClassToScore(privacyClass: PrivacyClass): number {
  switch (privacyClass) {
    case "P0":
      return 0.05;
    case "P1":
      return 0.4;
    case "P2":
      return 0.7;
    case "P3":
      return 0.98;
  }
}
