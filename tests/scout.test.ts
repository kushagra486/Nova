import { describe, it, expect } from "vitest";
import { runScout } from "@/lib/nova/scout";

describe("Scout", () => {
  it("classifies arithmetic expressions as calculation", () => {
    const result = runScout("92837 * 728");
    expect(result.taskType).toBe("calculation");
    expect(result.requiresTools).toContain("calculator");
  });

  it("classifies email extraction requests", () => {
    const result = runScout("Extract all email addresses from: jane@acme.com");
    expect(result.taskType).toBe("extraction");
  });

  it("classifies coding requests", () => {
    const result = runScout("Write a function that reverses a linked list in Python.");
    expect(result.taskType).toBe("coding");
  });

  it("classifies analytical requests as reasoning", () => {
    const result = runScout("Analyze these research papers and identify contradictory conclusions.");
    expect(result.taskType).toBe("reasoning");
    expect(result.estimatedComplexity).toBeGreaterThan(0.5);
  });

  it("falls back to general_query for unrecognized text", () => {
    const result = runScout("hello there");
    expect(result.taskType).toBe("general_query");
  });
});
