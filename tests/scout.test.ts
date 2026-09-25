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

  it("classifies explicit search requests as web_search", () => {
    const result = runScout("search for the latest Next.js 16 release notes");
    expect(result.taskType).toBe("web_search");
    expect(result.requiresTools).toContain("web_search");
  });

  it("classifies 'look up' and 'google' as web_search too", () => {
    expect(runScout("look up the capital of Iceland").taskType).toBe("web_search");
    expect(runScout("google the current price of gold").taskType).toBe("web_search");
  });

  it("classifies a fenced code block with run intent as code_execution", () => {
    const result = runScout("Run this and tell me the output:\n```python\nprint(sum(range(1, 11)))\n```");
    expect(result.taskType).toBe("code_execution");
    expect(result.requiresTools).toContain("sandbox");
  });

  it("still classifies a fenced code block without run intent as coding", () => {
    const result = runScout("Here's a function, please refactor it:\n```python\ndef f(x): return x+1\n```");
    expect(result.taskType).toBe("coding");
  });
});
