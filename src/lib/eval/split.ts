import { Item } from "../schemas";

export interface SplitResult {
  history: Item[];
  test: Item[];
  eligibleLabels: string[];
}

export interface SplitOptions {
  historyRatio?: number;
  testSize?: number;
  minLabelCount?: number;
  ignoredLabelPatterns?: string[];
}

export function temporalSplit(items: Item[], options: SplitOptions = {}): SplitResult {
  const historyRatio = options.historyRatio ?? 0.7;
  const maxTestSize = options.testSize ?? 150;
  const minLabelCount = options.minLabelCount ?? 5;
  const ignoredPatterns = (options.ignoredLabelPatterns || [
    "^size/.*",
    "^dependencies$",
    "^bot$",
    "^stale$",
    "^automerge.*",
    "^renovate.*",
    "^dependabot.*",
  ]).map((p) => new RegExp(p, "i"));

  // 1. Sort strictly chronologically by createdAt (oldest first)
  const sorted = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (sorted.length < 5) {
    return {
      history: sorted,
      test: [],
      eligibleLabels: [],
    };
  }

  // 2. Temporal split
  const splitIdx = Math.floor(sorted.length * historyRatio);
  const rawHistory = sorted.slice(0, splitIdx);
  const rawTest = sorted.slice(splitIdx);

  // Cap test size to most recent items
  const test = rawTest.slice(-maxTestSize);
  const history = rawHistory;

  // 3. Count label frequencies in history
  const labelCounts = new Map<string, number>();
  for (const item of history) {
    for (const label of item.labels) {
      const isIgnored = ignoredPatterns.some((pattern) => pattern.test(label));
      if (!isIgnored) {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }
    }
  }

  // 4. Eligible labels used at least minLabelCount times in history
  const eligibleLabels: string[] = [];
  for (const [label, count] of labelCounts.entries()) {
    if (count >= minLabelCount) {
      eligibleLabels.push(label);
    }
  }

  return {
    history,
    test,
    eligibleLabels,
  };
}
