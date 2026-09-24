import { describe, it, expect } from "vitest";
import { runGuardian } from "@/lib/nova/guardian";

describe("Guardian", () => {
  it("detects an email and classifies it as P1", () => {
    const result = runGuardian("My email is rahul@example.com, can you help?");
    expect(result.findings.some((f) => f.type === "email")).toBe(true);
    expect(result.privacyClass).toBe("P1");
    expect(result.externalTransmissionAllowed).toBe(true);
    expect(result.redactedText).toContain("[EMAIL]");
    expect(result.redactedText).not.toContain("rahul@example.com");
  });

  it("classifies plain text with no PII as P0", () => {
    const result = runGuardian("What is the capital of France?");
    expect(result.findings.length).toBe(0);
    expect(result.privacyClass).toBe("P0");
  });

  it("detects API keys and classifies as P3, blocking external transmission", () => {
    const result = runGuardian("Here is my key sk-abcdefghijklmnopqrstuvwx1234567890, please debug this.");
    expect(result.privacyClass).toBe("P3");
    expect(result.externalTransmissionAllowed).toBe(false);
  });

  it("classifies a credit-card-shaped number as P2", () => {
    const result = runGuardian("My card is 4111 1111 1111 1111, please process it.");
    expect(result.privacyClass).toBe("P2");
    expect(result.externalTransmissionAllowed).toBe(true);
  });
});
