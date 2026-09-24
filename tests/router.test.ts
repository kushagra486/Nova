import { describe, it, expect } from "vitest";
import { runRouter } from "@/lib/nova/router";
import { runScout } from "@/lib/nova/scout";
import { runGuardian, privacyClassToScore } from "@/lib/nova/guardian";
import { runThinker } from "@/lib/nova/thinker";

function route(task: string) {
  const scout = runScout(task);
  const guardian = runGuardian(task);
  const thinker = runThinker(scout, privacyClassToScore(guardian.privacyClass), { task });
  return runRouter(scout, guardian, thinker);
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
});
