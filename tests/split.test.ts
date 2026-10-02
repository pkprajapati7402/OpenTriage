import { describe, it, expect } from "vitest";
import { temporalSplit } from "../src/lib/eval/split";
import { Item } from "../src/lib/schemas";

function createItem(num: number, dateStr: string, labels: string[]): Item {
  return {
    id: num,
    number: num,
    kind: "issue",
    title: `Issue #${num}`,
    body: "Body description",
    author: "author",
    createdAt: dateStr,
    state: "open",
    labels,
    url: `https://github.com/test/repo/issues/${num}`,
  };
}

describe("Temporal Split", () => {
  it("strictly sorts items by creation date and prevents future leakage", () => {
    const items: Item[] = [
      createItem(1, "2026-01-01T00:00:00Z", ["bug"]),
      createItem(2, "2026-02-01T00:00:00Z", ["bug"]),
      createItem(3, "2026-03-01T00:00:00Z", ["bug"]),
      createItem(4, "2026-04-01T00:00:00Z", ["feature"]),
      createItem(5, "2026-05-01T00:00:00Z", ["bug"]),
      createItem(6, "2026-06-01T00:00:00Z", ["feature"]),
      createItem(7, "2026-07-01T00:00:00Z", ["bug"]),
      createItem(8, "2026-08-01T00:00:00Z", ["bug"]),
      createItem(9, "2026-09-01T00:00:00Z", ["bug"]),
      createItem(10, "2026-10-01T00:00:00Z", ["feature"]),
    ];

    const split = temporalSplit(items, { historyRatio: 0.7, minLabelCount: 2 });
    expect(split.history.length).toBe(7);
    expect(split.test.length).toBe(3);

    // Latest history item date must be <= earliest test item date
    const lastHistDate = new Date(split.history[split.history.length - 1].createdAt).getTime();
    const firstTestDate = new Date(split.test[0].createdAt).getTime();
    expect(lastHistDate).toBeLessThanOrEqual(firstTestDate);

    // "bug" appears >= 2 times in history, so it must be an eligible label
    expect(split.eligibleLabels).toContain("bug");
  });
});
