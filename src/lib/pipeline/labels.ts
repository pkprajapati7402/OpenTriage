import { z } from "zod";
import { Item, RepoLabel, LabelSuggestion, SuggestedLabelItem } from "../schemas";
import { BM25Index } from "../util/bm25";
import { LLMProvider } from "../providers/types";
import { truncateBody, sanitizePromptText } from "../util/truncate";
import {
  getLabelPromptSystem,
  getLabelFewShotContext,
  getLabelPromptUser,
  PROMPT_VERSION,
} from "../prompts/templates";
import { logger } from "../util/logger";

const LLMLabelResponseSchema = z.object({
  labels: z
    .array(
      z.object({
        name: z.string(),
        confidence: z.number().min(0).max(1),
        reason: z.string().default("Matches issue description"),
      })
    )
    .default([]),
  abstain: z.boolean().default(false),
});

export interface LabelPipelineOptions {
  ignoredLabelPatterns?: string[];
  confidenceThreshold?: number;
  kNearest?: number;
  method?: "knn" | "llm-zero" | "llm-fewshot";
}

export class LabelPipeline {
  private repoName: string;
  private allowedLabels: RepoLabel[];
  private allowedLabelNames: Set<string>;
  private historyItems: Item[];
  private bm25Index: BM25Index<Item>;
  private ignoredPatterns: RegExp[];
  private confidenceThreshold: number;

  constructor(
    repoName: string,
    allLabels: RepoLabel[],
    historyItems: Item[],
    options: LabelPipelineOptions = {}
  ) {
    this.repoName = repoName;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.5;
    this.ignoredPatterns = (options.ignoredLabelPatterns || [
      "^size/.*",
      "^dependencies$",
      "^bot$",
      "^stale$",
      "^automerge.*",
      "^renovate.*",
      "^dependabot.*",
    ]).map((p) => new RegExp(p, "i"));

    // Filter candidate labels
    this.allowedLabels = allLabels.filter((l) => !this.isIgnoredLabel(l.name));
    this.allowedLabelNames = new Set(this.allowedLabels.map((l) => l.name.toLowerCase()));

    // Filter history items to only those with valid labels
    this.historyItems = historyItems.filter((item) =>
      item.labels.some((labelName) => this.allowedLabelNames.has(labelName.toLowerCase()))
    );

    // Build BM25 index over labeled history items for kNN / retrieval
    this.bm25Index = new BM25Index<Item>();
    this.bm25Index.addDocuments(
      this.historyItems.map((item) => ({
        id: item.number,
        text: `${item.title} ${item.body.slice(0, 1000)}`,
        data: item,
      }))
    );
  }

  private isIgnoredLabel(name: string): boolean {
    return this.ignoredPatterns.some((pattern) => pattern.test(name));
  }

  public getAllowedLabels(): RepoLabel[] {
    return this.allowedLabels;
  }

  /**
   * M0: k-NN label vote baseline over labeled history
   */
  public suggestLabelsKNN(targetItem: Item, k = 5): LabelSuggestion {
    const startTime = Date.now();
    const query = `${targetItem.title} ${targetItem.body.slice(0, 1000)}`;
    const results = this.bm25Index.search(query, k * 2);

    // Filter out target item itself
    const neighbors = results.filter((r) => Number(r.id) !== targetItem.number).slice(0, k);

    if (neighbors.length === 0) {
      return {
        labels: [],
        abstain: true,
        method: "knn",
        latencyMs: Date.now() - startTime,
      };
    }

    // Tally weighted votes for each label
    const labelScores = new Map<string, { weightSum: number; matchCount: number }>();
    let totalWeight = 0;

    for (const neighbor of neighbors) {
      const neighborItem = neighbor.data;
      if (!neighborItem) continue;

      const weight = Math.max(0.1, neighbor.normalizedScore);
      totalWeight += weight;

      for (const label of neighborItem.labels) {
        if (!this.allowedLabelNames.has(label.toLowerCase())) continue;
        const current = labelScores.get(label) || { weightSum: 0, matchCount: 0 };
        current.weightSum += weight;
        current.matchCount += 1;
        labelScores.set(label, current);
      }
    }

    if (totalWeight === 0 || labelScores.size === 0) {
      return {
        labels: [],
        abstain: true,
        method: "knn",
        latencyMs: Date.now() - startTime,
      };
    }

    const suggestions: SuggestedLabelItem[] = [];
    for (const [labelName, score] of labelScores.entries()) {
      // Confidence is normalized vote share
      const confidence = Math.min(1, Math.round((score.weightSum / totalWeight) * 100) / 100);
      if (confidence >= this.confidenceThreshold) {
        suggestions.push({
          name: labelName,
          confidence,
          reason: `Observed in ${score.matchCount} similar past item(s) in repository history`,
        });
      }
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);
    const topLabels = suggestions.slice(0, 3);

    return {
      labels: topLabels,
      abstain: topLabels.length === 0,
      method: "knn",
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * M1 / M2: LLM suggestions (zero-shot or few-shot with retrieval)
   */
  public async suggestLabelsLLM(
    targetItem: Item,
    llmProvider: LLMProvider,
    method: "llm-zero" | "llm-fewshot" = "llm-fewshot"
  ): Promise<LabelSuggestion> {
    const startTime = Date.now();

    // If no candidate labels exist in repo, abstain immediately
    if (this.allowedLabels.length === 0) {
      return {
        labels: [],
        abstain: true,
        method,
        model: llmProvider.model,
        latencyMs: 1,
      };
    }

    // 1. Retrieve few-shot examples if M2
    let fewShotContext = "";
    if (method === "llm-fewshot") {
      const query = `${targetItem.title} ${targetItem.body.slice(0, 1000)}`;
      const neighbors = this.bm25Index
        .search(query, 6)
        .filter((r) => Number(r.id) !== targetItem.number)
        .slice(0, 3);

      const examples = neighbors.map((n) => {
        const item = n.data!;
        const cleanBody = item.body ? item.body.replace(/\s+/g, " ").slice(0, 300) : "No body";
        const relevantLabels = item.labels.filter((l) => this.allowedLabelNames.has(l.toLowerCase()));
        return {
          title: item.title,
          bodySnippet: cleanBody,
          labels: relevantLabels,
        };
      });

      if (examples.length > 0) {
        fewShotContext = getLabelFewShotContext(examples);
      }
    }

    // 2. Prepare truncated and sanitized item text
    const truncated = truncateBody(targetItem.body, { headChars: 1000, tailChars: 250 });
    const cleanBody = sanitizePromptText(truncated.text);
    const cleanTitle = sanitizePromptText(targetItem.title);

    const systemPrompt = getLabelPromptSystem(this.repoName, this.allowedLabels);
    const userPrompt = getLabelPromptUser(
      {
        kind: targetItem.kind,
        title: cleanTitle,
        body: cleanBody,
      },
      fewShotContext
    );

    try {
      const result = await llmProvider.generateJSON({
        system: systemPrompt,
        user: userPrompt,
        schema: LLMLabelResponseSchema,
        maxTokens: 512,
        temperature: 0.1,
        promptVersion: PROMPT_VERSION,
      });

      // Post-validate: only keep labels that genuinely exist in candidate list
      const validatedLabels: SuggestedLabelItem[] = [];

      const rawLabels = result.data.labels || [];
      for (const item of rawLabels) {
        // Find exact match or case-insensitive match from allowedLabels
        const match = this.allowedLabels.find(
          (al) => al.name.toLowerCase() === item.name.toLowerCase().trim()
        );

        if (match && item.confidence >= this.confidenceThreshold) {
          validatedLabels.push({
            name: match.name, // Use original canonical casing
            confidence: Math.round(item.confidence * 100) / 100,
            reason: (item.reason || "Matches issue description").slice(0, 150),
          });
        }
      }

      const abstain = result.data.abstain || validatedLabels.length === 0;

      return {
        labels: validatedLabels.slice(0, 3),
        abstain,
        method,
        model: `${llmProvider.name}/${llmProvider.model}`,
        latencyMs: result.latencyMs,
      };
    } catch (err) {
      logger.warn(`LLM label generation failed for #${targetItem.number}, falling back to k-NN baseline:`, err);
      // Fallback to M0 k-NN baseline
      const fallback = this.suggestLabelsKNN(targetItem);
      return {
        ...fallback,
        model: `fallback-knn (${err instanceof Error ? err.message : "unavailable"})`,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
