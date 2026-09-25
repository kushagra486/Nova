import { describe, it, expect } from "vitest";
import { runRouter } from "@/lib/nova/router";
import { runScout } from "@/lib/nova/scout";
import { runGuardian, privacyClassToScore } from "@/lib/nova/guardian";
import { runThinker } from "@/lib/nova/thinker";

function route(task: string, overridePrivacy = false) {
  const scout = runScout(task);
  const guardian = runGuardian(task);
  const thinker = runThinker(scout, privacyClassToScore(guardian.privacyClass), { task });
  return runRouter(scout, guardian, thinker, overridePrivacy);
}

describe("Router", () => {
  it("selects the deterministic calculator for arithmetic", () => {
    const decision = route("92837 * 728");
    expect(decision.executor).toBe("deterministic");
    expect(decision.executorName).toBe("calculator");
    expect(decision.provider).toBeNull();
  });

  it("selects the regex extractor for email extraction", () => {
    const decision = route("Extract all email addresses from: jane@acme.com");
    expect(decision.executor).toBe("deterministic");
    expect(decision.executorName).toBe("regex_extractor");
  });

  it("blocks requests containing credentials before any provider is considered", () => {
    const decision = route("My password: hunter2, please help me log in.");
    expect(decision.executor).toBe("blocked");
    expect(decision.provider).toBeNull();
  });

  it("reports AI as unavailable when no provider is configured", () => {
    const decision = route("Analyze these research papers and identify contradictory conclusions.");
    expect(decision.executor).toBe("ai");
    expect(decision.executorName).toBe("unavailable");
    expect(decision.provider).toBeNull();
  });

  it("routes search requests to the specialized web_search executor", () => {
    const decision = route("search for the latest Next.js 16 release notes");
    expect(decision.executor).toBe("specialized");
    // No BRAVE_SEARCH_API_KEY in the test environment, so it reports unavailable
    // rather than silently falling through to an AI provider.
    expect(decision.executorName).toBe("unavailable");
    expect(decision.reason).toMatch(/BRAVE_SEARCH_API_KEY/);
  });

  it("routes runnable code to the specialized code_sandbox executor", () => {
    const decision = route("Run this and tell me the output:\n```python\nprint(1 + 1)\n```");
    expect(decision.executor).toBe("specialized");
    expect(decision.executorName).toBe("code_sandbox");
    expect(decision.provider).toBeNull();
  });

  it("still blocks a code_execution request containing credentials", () => {
    const decision = route("Run this:\n```python\nprint('sk-abcdefghijklmnopqrstuvwx1234567890')\n```");
    expect(decision.executor).toBe("blocked");
  });

  it("requires approval instead of silently routing P1 data to an AI provider", () => {
    const decision = route("Please write a nice birthday message for jane@acme.com");
    expect(decision.executor).toBe("needs_approval");
    expect(decision.provider).toBeNull();
  });

  it("requires approval instead of silently routing P2 data to an AI provider", () => {
    const decision = route("Is this card number valid? 4111 1111 1111 1111");
    expect(decision.executor).toBe("needs_approval");
  });

  it("proceeds past the P1 approval gate once explicitly overridden", () => {
    const decision = route("Please write a nice birthday message for jane@acme.com", true);
    expect(decision.executor).not.toBe("needs_approval");
  });

  it("proceeds past the P3 hard block once explicitly overridden", () => {
    const decision = route("My password: hunter2, please help me log in.", true);
    expect(decision.executor).not.toBe("blocked");
  });
});
