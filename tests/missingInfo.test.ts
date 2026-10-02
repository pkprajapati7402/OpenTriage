import { describe, it, expect } from "vitest";
import { detectMissingInfo } from "../src/lib/pipeline/missingInfo";
import { Item } from "../src/lib/schemas";

describe("Missing Information Detector", () => {
  it("flags missing steps and version on vague bug descriptions", () => {
    const item: Item = {
      id: 1,
      number: 1,
      kind: "issue",
      title: "App broken",
      body: "The button doesn't work please fix.",
      author: "user",
      createdAt: new Date().toISOString(),
      state: "open",
      labels: [],
      url: "https://github.com/owner/repo/issues/1",
    };

    const res = detectMissingInfo(item);
    expect(res.hasMissingInfo).toBe(true);
    expect(res.missingFields.length).toBeGreaterThanOrEqual(2);
  });

  it("passes well-structured bug report with steps, version, and logs", () => {
    const item: Item = {
      id: 2,
      number: 2,
      kind: "issue",
      title: "TypeError in fetch handler",
      body: `### Version\nv2.4.1 on Node 20 / Linux\n\n### Steps to reproduce\n1. Run npm test\n2. Call fetch('/api')\n\n### Expected vs Actual\nExpected 200 OK but got TypeError: undefined\n\n### Logs\n\`\`\`\nTypeError: Cannot read properties of undefined\n\`\`\``,
      author: "maintainer",
      createdAt: new Date().toISOString(),
      state: "open",
      labels: [],
      url: "https://github.com/owner/repo/issues/2",
    };

    const res = detectMissingInfo(item);
    expect(res.hasMissingInfo).toBe(false);
  });
});
