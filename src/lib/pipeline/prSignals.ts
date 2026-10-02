import { Item, PrAssessment, PrSignal, PrBand } from "../schemas";

const GENERIC_TITLES = [
  /^update readme(?:\.md)?$/i,
  /^create [a-z0-9_.-]+$/i,
  /^add files via upload$/i,
  /^fix typo$/i,
  /^typo$/i,
  /^minor fix$/i,
  /^patch$/i,
  /^changes$/i,
  /^update$/i,
  /^readme$/i,
];

export interface PrSignalWeights {
  EMPTY_BODY: number;
  TEMPLATE_UNFILLED: number;
  TRIVIAL_DOCS_EDIT: number;
  WHITESPACE_ONLY: number;
  GENERIC_TITLE: number;
  NO_LINKED_ISSUE: number;
  ADDS_SELF_PROMO_LINK: number;
}

export const DEFAULT_PR_SIGNAL_WEIGHTS: PrSignalWeights = {
  EMPTY_BODY: 40,
  TEMPLATE_UNFILLED: 25,
  TRIVIAL_DOCS_EDIT: 35,
  WHITESPACE_ONLY: 50,
  GENERIC_TITLE: 20,
  NO_LINKED_ISSUE: 15,
  ADDS_SELF_PROMO_LINK: 45,
};

export function assessPrSignals(item: Item, customWeights?: Partial<PrSignalWeights>): PrAssessment {
  if (item.kind !== "pr") {
    return {
      band: "OK",
      score: 0,
      signals: [],
      explanation: "Item is an issue, not a pull request.",
    };
  }

  const weights = { ...DEFAULT_PR_SIGNAL_WEIGHTS, ...customWeights };
  const signals: PrSignal[] = [];

  const rawBody = item.body || "";
  const cleanedBody = rawBody.replace(/<!--[\s\S]*?-->/g, "").trim();

  // 1. EMPTY_BODY
  if (cleanedBody.length === 0) {
    signals.push({
      id: "EMPTY_BODY",
      weight: weights.EMPTY_BODY,
      evidence: "PR description is completely empty or contains only HTML comment templates.",
    });
  } else if (cleanedBody.length < 15) {
    signals.push({
      id: "EMPTY_BODY",
      weight: weights.EMPTY_BODY,
      evidence: `PR description has only ${cleanedBody.length} characters ("${cleanedBody}").`,
    });
  }

  // 2. TEMPLATE_UNFILLED
  const hasUncheckedBoxes = (rawBody.match(/- \[\s*\]/g) || []).length;
  const hasCheckedBoxes = (rawBody.match(/- \[[xX]\]/g) || []).length;
  const hasPlaceholders = /\[TODO\]|\[fill\s+in\]|\[describe\s+changes\]|<your-description>/i.test(rawBody);

  if ((hasUncheckedBoxes > 0 && hasCheckedBoxes === 0) || hasPlaceholders) {
    signals.push({
      id: "TEMPLATE_UNFILLED",
      weight: weights.TEMPLATE_UNFILLED,
      evidence: `Checklist items or template placeholders left untouched (${hasUncheckedBoxes} unchecked, 0 checked).`,
    });
  }

  // 3. GENERIC_TITLE
  const trimmedTitle = item.title.trim();
  const isGenericTitle = GENERIC_TITLES.some((regex) => regex.test(trimmedTitle));
  if (isGenericTitle) {
    signals.push({
      id: "GENERIC_TITLE",
      weight: weights.GENERIC_TITLE,
      evidence: `Title matches generic default pattern: "${trimmedTitle}".`,
    });
  }

  // 4. NO_LINKED_ISSUE
  const hasIssueLink = /#\d+|fixes\s+#\d+|closes\s+#\d+|resolves\s+#\d+/i.test(rawBody);
  if (!hasIssueLink) {
    signals.push({
      id: "NO_LINKED_ISSUE",
      weight: weights.NO_LINKED_ISSUE,
      evidence: "No linked issue reference (e.g. #123) found in PR description.",
    });
  }

  // 5. Inspect file diffs if available
  if (item.pr && item.pr.changedFiles && item.pr.changedFiles.length > 0) {
    const files = item.pr.changedFiles;
    const isOnlyDocs = files.every((f) => {
      const p = f.path.toLowerCase();
      return (
        p.endsWith(".md") ||
        p.endsWith(".txt") ||
        p.includes("readme") ||
        p.includes("docs/") ||
        p.includes("license")
      );
    });

    const totalChanges = item.pr.totalAdditions + item.pr.totalDeletions;

    // TRIVIAL_DOCS_EDIT
    if (isOnlyDocs && totalChanges <= 3) {
      signals.push({
        id: "TRIVIAL_DOCS_EDIT",
        weight: weights.TRIVIAL_DOCS_EDIT,
        evidence: `Only documentation changed with ${totalChanges} total line change(s) across ${files.length} file(s).`,
      });
    }

    // WHITESPACE_ONLY check
    const allPatchesAreWhitespace = files.every((f) => {
      if (!f.patch) return false;
      const addedLines = f.patch
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1).trim());
      const removedLines = f.patch
        .split("\n")
        .filter((l) => l.startsWith("-") && !l.startsWith("---"))
        .map((l) => l.slice(1).trim());

      if (addedLines.length === 0 && removedLines.length === 0) {
        return false;
      }

      // If stripped lines are identical or blank
      return addedLines.join("") === removedLines.join("");
    });

    if (allPatchesAreWhitespace && files.length > 0 && files.some((f) => Boolean(f.patch))) {
      signals.push({
        id: "WHITESPACE_ONLY",
        weight: weights.WHITESPACE_ONLY,
        evidence: "Diff inspection indicates changes consist solely of whitespace, formatting, or line endings.",
      });
    }

    // ADDS_SELF_PROMO_LINK
    const isSelfPromo = files.every((f) => {
      if (!f.patch) return false;
      const patch = f.patch.toLowerCase();
      return (
        (patch.includes("http://") || patch.includes("https://") || patch.includes("github.com/")) &&
        totalChanges <= 4 &&
        (f.path.toLowerCase().includes("contributor") || f.path.toLowerCase().includes("readme"))
      );
    });

    if (isSelfPromo) {
      signals.push({
        id: "ADDS_SELF_PROMO_LINK",
        weight: weights.ADDS_SELF_PROMO_LINK,
        evidence: "PR adds external link or author reference to README/contributors list without substantive content changes.",
      });
    }
  }

  // Calculate total score
  const totalScore = signals.reduce((sum, s) => sum + s.weight, 0);

  let band: PrBand = "OK";
  if (totalScore >= 60) {
    band = "LIKELY_LOW_EFFORT";
  } else if (totalScore >= 30) {
    band = "REVIEW";
  }

  // Build transparent, objective summary explanation
  let explanation = "";
  if (band === "LIKELY_LOW_EFFORT") {
    explanation = `High low-effort signals detected (${signals.map((s) => s.id).join(", ")}). Maintainer review recommended before merging.`;
  } else if (band === "REVIEW") {
    explanation = `Moderate triage signals observed (${signals.map((s) => s.id).join(", ")}). May require clarification or additional context.`;
  } else {
    explanation = "No significant low-effort signals identified; standard review workflow applies.";
  }

  return {
    band,
    score: totalScore,
    signals,
    explanation,
  };
}
