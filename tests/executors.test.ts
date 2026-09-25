import { describe, it, expect } from "vitest";
import { extractSearchQuery } from "@/lib/nova/executors/web-search";
import { extractCodeBlock, isLanguageSupported } from "@/lib/nova/executors/code-sandbox";

describe("extractSearchQuery", () => {
  it("strips a 'search for' prefix", () => {
    expect(extractSearchQuery("search for the latest Next.js release")).toBe("the latest Next.js release");
  });

  it("strips a 'look up' prefix", () => {
    expect(extractSearchQuery("look up the capital of Iceland")).toBe("the capital of Iceland");
  });

  it("strips a 'google' prefix", () => {
    expect(extractSearchQuery("google current gold prices")).toBe("current gold prices");
  });

  it("returns the original text when no intent phrase is present", () => {
    expect(extractSearchQuery("capital of Iceland")).toBe("capital of Iceland");
  });
});

describe("extractCodeBlock", () => {
  it("extracts language and code from a fenced block", () => {
    const block = extractCodeBlock("Run this:\n```python\nprint(1 + 1)\n```");
    expect(block).not.toBeNull();
    expect(block?.language).toBe("python");
    expect(block?.code.trim()).toBe("print(1 + 1)");
  });

  it("defaults to python when no language tag is given", () => {
    const block = extractCodeBlock("```\nprint(1)\n```");
    expect(block?.language).toBe("python");
  });

  it("returns null when there is no fenced block", () => {
    expect(extractCodeBlock("just some text, no code here")).toBeNull();
  });

  it("returns null for an empty fenced block", () => {
    expect(extractCodeBlock("```python\n\n```")).toBeNull();
  });
});

describe("isLanguageSupported", () => {
  it("accepts known sandbox languages", () => {
    expect(isLanguageSupported("python")).toBe(true);
    expect(isLanguageSupported("javascript")).toBe(true);
  });

  it("rejects unknown languages", () => {
    expect(isLanguageSupported("cobol-2003-dialect")).toBe(false);
  });
});
