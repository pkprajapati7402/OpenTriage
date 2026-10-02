import { describe, it, expect } from "vitest";
import { assessPrSignals } from "../src/lib/pipeline/prSignals";
import { Item } from "../src/lib/schemas";

function createMockPr(overrides: Partial<Item>): Item {
  return {
    id: 101,
    number: 101,
    kind: "pr",
    title: "Update README.md",
    body: "",
    author: "contributor1",
    createdAt: new Date().toISOString(),
    state: "open",
    labels: [],
    url: "https://github.com/test/repo/pull/101",
    ...overrides,
  };
}

describe("PR Signals Assessment", () => {
  it("flags empty body with generic title as LIKELY_LOW_EFFORT", () => {
    const pr = createMockPr({
      title: "Update README.md",
      body: "",
      pr: {
        changedFiles: [{ path: "README.md", additions: 1, deletions: 1, patch: "+ hello\n- hi" }],
        totalAdditions: 1,
        totalDeletions: 1,
        changedFilesCount: 1,
      },
    });

    const assessment = assessPrSignals(pr);
    expect(assessment.band).toBe("LIKELY_LOW_EFFORT");
    expect(assessment.score).toBeGreaterThanOrEqual(60);
    const signalIds = assessment.signals.map((s) => s.id);
    expect(signalIds).toContain("EMPTY_BODY");
    expect(signalIds).toContain("GENERIC_TITLE");
    expect(signalIds).toContain("TRIVIAL_DOCS_EDIT");
  });

  it("identifies whitespace only diffs", () => {
    const pr = createMockPr({
      title: "Refactor core module",
      body: "Addresses code style in core module #42",
      pr: {
        changedFiles: [
          {
            path: "src/index.ts",
            additions: 1,
            deletions: 1,
            patch: "@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 1;  \n",
          },
        ],
        totalAdditions: 1,
        totalDeletions: 1,
        changedFilesCount: 1,
      },
    });

    const assessment = assessPrSignals(pr);
    const signalIds = assessment.signals.map((s) => s.id);
    expect(signalIds).toContain("WHITESPACE_ONLY");
    expect(assessment.score).toBeGreaterThanOrEqual(30);
  });

  it("passes legitimate substantive PR as OK", () => {
    const pr = createMockPr({
      title: "Fix null pointer in authentication session parser",
      body: "Fixes #452. Added null checks when reading user tokens and added comprehensive tests.",
      pr: {
        changedFiles: [
          { path: "src/auth.ts", additions: 45, deletions: 12, patch: "@@ -10,3 +10,12 @@..." },
          { path: "tests/auth.test.ts", additions: 60, deletions: 0, patch: "@@ -1,5 +1,60 @@..." },
        ],
        totalAdditions: 105,
        totalDeletions: 12,
        changedFilesCount: 2,
      },
    });

    const assessment = assessPrSignals(pr);
    expect(assessment.band).toBe("OK");
    expect(assessment.score).toBe(0);
  });

  it("treats non-PR items safely as OK", () => {
    const issue: Item = {
      id: 1,
      number: 1,
      kind: "issue",
      title: "Bug report",
      body: "",
      author: "user",
      createdAt: new Date().toISOString(),
      state: "open",
      labels: [],
      url: "https://github.com/test/repo/issues/1",
    };
    const assessment = assessPrSignals(issue);
    expect(assessment.band).toBe("OK");
    expect(assessment.score).toBe(0);
  });
});
