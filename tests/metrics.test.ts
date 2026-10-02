import { describe, it, expect } from "vitest";
import { computeLabelMetrics, computeDuplicateMetrics, computePrSignalMetrics } from "../src/lib/eval/metrics";
import { Item, LabelSuggestion } from "../src/lib/schemas";

describe("Metrics Calculation", () => {
  it("computes precision, recall, and F1 accurately for label predictions", () => {
    const item1: Item = {
      id: 1,
      number: 1,
      kind: "issue",
      title: "Bug 1",
      body: "",
      author: "user",
      createdAt: "2026-01-01T00:00:00Z",
      state: "open",
      labels: ["bug"],
      url: "",
    };

    const sugg1: LabelSuggestion = {
      labels: [{ name: "bug", confidence: 0.9, reason: "Matches symptoms" }],
      abstain: false,
      method: "knn",
    };

    const eligibleLabels = new Set(["bug", "feature"]);
    const { metrics } = computeLabelMetrics(
      "TestConfig",
      "ModelTest",
      "Local",
      [{ item: item1, suggestion: sugg1 }],
      eligibleLabels,
      0.5
    );

    expect(metrics.precision).toBe(1.0);
    expect(metrics.recall).toBe(1.0);
    expect(metrics.f1).toBe(1.0);
    expect(metrics.exactMatchRate).toBe(1.0);
    expect(metrics.top1HitRate).toBe(1.0);
    expect(metrics.abstainRate).toBe(0.0);
  });

  it("handles duplicate evaluation metrics with recall@3", () => {
    const item: Item = {
      id: 2,
      number: 20,
      kind: "issue",
      title: "Dupe of 10",
      body: "",
      author: "user",
      createdAt: "2026-01-01T00:00:00Z",
      state: "closed",
      labels: ["duplicate"],
      duplicateOf: 10,
      url: "",
    };

    const assessment = {
      candidates: [
        { number: 10, title: "Original issue", url: "", score: 0.85, state: "open" },
        { number: 12, title: "Another issue", url: "", score: 0.4, state: "open" },
      ],
      isDuplicate: true,
      topScore: 0.85,
    };

    const dupMetrics = computeDuplicateMetrics([{ item, assessment }], 0.68);
    expect(dupMetrics.recallAt3).toBe(1.0);
    expect(dupMetrics.precisionAtThreshold).toBe(1.0);
  });
});
