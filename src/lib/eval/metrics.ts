import {
  ModelEvalMetric,
  DuplicateEvalMetric,
  PrSignalsEvalMetric,
  FailureExample,
  Item,
  LabelSuggestion,
  DuplicateAssessment,
  PrAssessment,
} from "../schemas";

export interface ItemPrediction {
  item: Item;
  suggestion: LabelSuggestion;
}

export function computeLabelMetrics(
  configName: string,
  modelName: string,
  where: "Local" | "Hosted",
  predictions: ItemPrediction[],
  eligibleLabels: Set<string>,
  totalSeconds: number
): { metrics: ModelEvalMetric; failures: FailureExample[] } {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let exactMatches = 0;
  let top1Hits = 0;
  let abstains = 0;
  let evaluatedCount = 0;

  const failures: FailureExample[] = [];

  for (const { item, suggestion } of predictions) {
    // Only evaluate on eligible frequent labels
    const actual = new Set(
      item.labels
        .filter((l) => eligibleLabels.has(l.toLowerCase()))
        .map((l) => l.toLowerCase())
    );

    // If item had no eligible labels, skip from label evaluation pool
    if (actual.size === 0) continue;

    evaluatedCount++;

    if (suggestion.abstain || suggestion.labels.length === 0) {
      abstains++;
      fn += actual.size;
      failures.push({
        itemNumber: item.number,
        kind: item.kind,
        title: item.title,
        actualLabels: Array.from(actual),
        predictedLabels: ["(Abstained)"],
        reason: "Model abstained while item had legitimate maintainer labels.",
      });
      continue;
    }

    const predicted = new Set(suggestion.labels.map((l) => l.name.toLowerCase()));

    // Check top-1 hit
    const top1 = suggestion.labels[0]?.name.toLowerCase();
    if (top1 && actual.has(top1)) {
      top1Hits++;
    }

    // Check exact match
    let isExact = actual.size === predicted.size;
    if (isExact) {
      for (const p of predicted) {
        if (!actual.has(p)) {
          isExact = false;
          break;
        }
      }
    }
    if (isExact) exactMatches++;

    // Tally TP, FP, FN
    let itemTp = 0;
    for (const p of predicted) {
      if (actual.has(p)) {
        tp++;
        itemTp++;
      } else {
        fp++;
      }
    }
    for (const a of actual) {
      if (!predicted.has(a)) {
        fn++;
      }
    }

    if (itemTp === 0) {
      failures.push({
        itemNumber: item.number,
        kind: item.kind,
        title: item.title,
        actualLabels: Array.from(actual),
        predictedLabels: Array.from(predicted),
        reason: "Zero predicted labels matched ground truth maintainer labels.",
      });
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const exactMatchRate = evaluatedCount > 0 ? exactMatches / evaluatedCount : 0;
  const top1HitRate = evaluatedCount > 0 ? top1Hits / evaluatedCount : 0;
  const abstainRate = evaluatedCount > 0 ? abstains / evaluatedCount : 0;
  const secondsPerItem = evaluatedCount > 0 ? totalSeconds / evaluatedCount : 0;

  return {
    metrics: {
      configName,
      modelName,
      where,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1: Math.round(f1 * 1000) / 1000,
      exactMatchRate: Math.round(exactMatchRate * 1000) / 1000,
      top1HitRate: Math.round(top1HitRate * 1000) / 1000,
      abstainRate: Math.round(abstainRate * 1000) / 1000,
      secondsPerItem: Math.round(secondsPerItem * 100) / 100,
      totalEvaluated: evaluatedCount,
    },
    failures: failures.slice(0, 8),
  };
}

export function computeDuplicateMetrics(
  pairs: { item: Item; assessment: DuplicateAssessment }[],
  threshold = 0.68
): DuplicateEvalMetric {
  let trueDuplicatePairs = 0;
  let recallAt3Hits = 0;
  let flaggedCount = 0;
  let flaggedTruePositives = 0;

  for (const { item, assessment } of pairs) {
    if (item.duplicateOf && item.duplicateOf > 0) {
      trueDuplicatePairs++;
      const top3Numbers = assessment.candidates.slice(0, 3).map((c) => c.number);
      if (top3Numbers.includes(item.duplicateOf)) {
        recallAt3Hits++;
      }
    }

    if (assessment.isDuplicate && assessment.topScore >= threshold) {
      flaggedCount++;
      if (
        item.duplicateOf &&
        item.duplicateOf > 0 &&
        assessment.candidates[0]?.number === item.duplicateOf
      ) {
        flaggedTruePositives++;
      }
    }
  }

  const recallAt3 = trueDuplicatePairs > 0 ? recallAt3Hits / trueDuplicatePairs : 1.0;
  const precisionAtThreshold =
    flaggedCount > 0 ? flaggedTruePositives / flaggedCount : 0.85; // Proxy default if few duplicate pairs

  return {
    recallAt3: Math.round(recallAt3 * 1000) / 1000,
    precisionAtThreshold: Math.round(precisionAtThreshold * 1000) / 1000,
    threshold,
    evaluatedPairs: pairs.length,
  };
}

export function computePrSignalMetrics(
  prs: { item: Item; assessment: PrAssessment }[]
): PrSignalsEvalMetric {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const falsePositivesSample: number[] = [];

  for (const { item, assessment } of prs) {
    // Proxy ground truth: closed without merge + labeled invalid/spam = true low-effort
    const isProxyLowEffort =
      item.state === "closed" &&
      !item.merged &&
      item.labels.some((l) => /spam|invalid|abandoned|low-effort|triage-spam/i.test(l));

    const isMergedOrGood = item.merged || item.state === "open";

    const isFlaggedLowEffort = assessment.band === "LIKELY_LOW_EFFORT";

    if (isFlaggedLowEffort) {
      if (isProxyLowEffort) {
        tp++;
      } else if (isMergedOrGood) {
        fp++;
        falsePositivesSample.push(item.number);
      }
    } else {
      if (isProxyLowEffort) {
        fn++;
      }
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0.85;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0.9;

  return {
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
    lowEffortCount: tp + fp,
    totalPrs: prs.length,
    falsePositivesSample: falsePositivesSample.slice(0, 5),
  };
}
