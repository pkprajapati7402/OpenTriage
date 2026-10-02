import fs from "fs";
import path from "path";
import { EvalReport } from "../schemas";
import { logger } from "../util/logger";

export class ReportGenerator {
  public static generateMarkdown(report: EvalReport): string {
    const lines: string[] = [];

    lines.push(`# 📊 OpenTriage Evaluation Report: \`${report.repo}\``);
    lines.push(`\n**Generated:** ${new Date(report.evaluatedAt).toUTCString()}`);
    lines.push(`**History Pool:** ${report.historySize} items · **Test Set:** ${report.testSize} items\n`);

    lines.push(`---`);
    lines.push(`\n## 1. Label Suggestion Accuracy (M0 Baseline vs Open Models)\n`);
    lines.push(`| Config | Model | Where | Precision | Recall | F1 | Exact Match | Top-1 Hit | Abstain % | Speed (s/item) |`);
    lines.push(`|---|---|---|---|---|---|---|---|---|---|`);

    for (const m of report.labelMetrics) {
      lines.push(
        `| **${m.configName}** | \`${m.modelName}\` | ${m.where} | ${(m.precision * 100).toFixed(1)}% | ${(m.recall * 100).toFixed(1)}% | **${(m.f1 * 100).toFixed(1)}%** | ${(m.exactMatchRate * 100).toFixed(1)}% | ${(m.top1HitRate * 100).toFixed(1)}% | ${(m.abstainRate * 100).toFixed(1)}% | ${m.secondsPerItem}s |`
      );
    }

    if (report.duplicateMetrics) {
      lines.push(`\n## 2. Duplicate Detection Performance\n`);
      lines.push(`| Metric | Value | Target | Notes |`);
      lines.push(`|---|---|---|---|`);
      lines.push(`| **Recall@3** | ${(report.duplicateMetrics.recallAt3 * 100).toFixed(1)}% | ≥ 80% | True duplicate ranked in top-3 candidates |`);
      lines.push(`| **Precision at threshold (${report.duplicateMetrics.threshold})** | ${(report.duplicateMetrics.precisionAtThreshold * 100).toFixed(1)}% | ≥ 80% | True duplicates among flagged items |`);
      lines.push(`| **Pairs evaluated** | ${report.duplicateMetrics.evaluatedPairs} | — | Full temporal cross-check |`);
    }

    if (report.prMetrics) {
      lines.push(`\n## 3. Low-Effort PR Detection (Deterministic Rules)\n`);
      lines.push(`| Metric | Value | Proxy Ground Truth |`);
      lines.push(`|---|---|---|`);
      lines.push(`| **Precision** | ${(report.prMetrics.precision * 100).toFixed(1)}% | Closed-unmerged with invalid/spam tags |`);
      lines.push(`| **Recall** | ${(report.prMetrics.recall * 100).toFixed(1)}% | Detection rate of low-effort submissions |`);
      lines.push(`| **F1 Score** | ${(report.prMetrics.f1 * 100).toFixed(1)}% | Balanced performance metric |`);
      lines.push(`| **Flagged Low-Effort** | ${report.prMetrics.lowEffortCount} / ${report.prMetrics.totalPrs} PRs | Evaluated pull requests |`);
    }

    if (report.failureGallery.length > 0) {
      lines.push(`\n## 4. Notable Misses & Failure Gallery\n`);
      lines.push(`Honest analysis of difficult items where predictions differed from maintainer actions:\n`);

      for (const fail of report.failureGallery) {
        lines.push(`### #${fail.itemNumber} (${fail.kind}): "${fail.title}"`);
        lines.push(`- **Ground Truth Labels:** \`${fail.actualLabels.join("`, `")}\``);
        lines.push(`- **Suggested Labels:** \`${fail.predictedLabels.join("`, `")}\``);
        lines.push(`- **Observation:** ${fail.reason}\n`);
      }
    }

    lines.push(`\n---`);
    lines.push(`*Generated autonomously by OpenTriage reproducible evaluation harness.*`);

    return lines.join("\n");
  }

  public static async saveReport(owner: string, repo: string, report: EvalReport): Promise<{ jsonPath: string; mdPath: string }> {
    const repoKey = `${owner.toLowerCase()}__${repo.toLowerCase()}`;
    const resultsDir = path.resolve(process.cwd(), "results", repoKey);

    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(resultsDir, `${timestamp}.json`);
    const mdPath = path.join(resultsDir, `${timestamp}.md`);

    const markdown = this.generateMarkdown(report);

    await fs.promises.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
    await fs.promises.writeFile(mdPath, markdown, "utf8");

    // Also write a latest.json and latest.md for quick access
    await fs.promises.writeFile(path.join(resultsDir, "latest.json"), JSON.stringify(report, null, 2), "utf8");
    await fs.promises.writeFile(path.join(resultsDir, "latest.md"), markdown, "utf8");

    logger.info(`Saved evaluation reports:\n- ${jsonPath}\n- ${mdPath}`);
    return { jsonPath, mdPath };
  }
}
