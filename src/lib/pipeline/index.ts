import { Item, RepoLabel, ItemTriageSuggestion, TriageConfig } from "../schemas";
import { DataCache } from "../github/cache";
import { DuplicateDetector } from "./duplicates";
import { assessPrSignals } from "./prSignals";
import { LabelPipeline } from "./labels";
import { ReplyGenerator } from "./replies";
import { LLMProvider, EmbeddingProvider } from "../providers/types";
import { logger } from "../util/logger";

export * from "./missingInfo";
export * from "./prSignals";
export * from "./duplicates";
export * from "./labels";
export * from "./replies";

export interface PipelineRunOptions {
  limit?: number;
  method?: "knn" | "llm-zero" | "llm-fewshot";
  llmProvider?: LLMProvider;
  embeddingProvider?: EmbeddingProvider;
  config?: TriageConfig;
}

export class TriagePipelineRunner {
  private owner: string;
  private repo: string;
  private cache: DataCache;
  private replyGenerator = new ReplyGenerator();

  constructor(owner: string, repo: string) {
    this.owner = owner;
    this.repo = repo;
    this.cache = new DataCache(owner, repo);
  }

  public async run(options: PipelineRunOptions = {}): Promise<Record<number, ItemTriageSuggestion>> {
    const items = await this.cache.getItems();
    if (!items || items.length === 0) {
      throw new Error(`No items found in cache for ${this.owner}/${this.repo}. Run fetch first.`);
    }

    const labels = (await this.cache.getLabels()) || [];
    const limit = options.limit ?? 50;
    const method = options.method ?? "llm-fewshot";
    const llmProvider = options.llmProvider;
    const embeddingProvider = options.embeddingProvider;

    // Items to triage: newest items up to limit
    const targetItems = items.slice(0, limit);
    // History pool: all items
    const historyItems = items;

    logger.info(`Running OpenTriage pipeline on ${targetItems.length} items for ${this.owner}/${this.repo}...`);

    // 1. Initialize Duplicate Detector
    const precomputedEmbeddings = (await this.cache.getEmbeddings()) || undefined;
    const duplicateDetector = new DuplicateDetector(historyItems, {
      threshold: options.config?.duplicateThreshold ?? 0.68,
      embeddingProvider,
      precomputedEmbeddings,
    });

    if (embeddingProvider) {
      await duplicateDetector.prepareEmbeddings();
      const updatedEmbeddings = duplicateDetector.getEmbeddingsMap();
      await this.cache.saveEmbeddings(updatedEmbeddings);
    }

    // 2. Initialize Label Pipeline
    const labelPipeline = new LabelPipeline(
      `${this.owner}/${this.repo}`,
      labels,
      historyItems,
      {
        ignoredLabelPatterns: options.config?.ignoredLabelPatterns,
        confidenceThreshold: options.config?.confidenceThreshold ?? 0.5,
      }
    );

    // 3. Process items
    const suggestions: Record<number, ItemTriageSuggestion> = {};

    for (let i = 0; i < targetItems.length; i++) {
      const item = targetItems[i];
      logger.info(`[${i + 1}/${targetItems.length}] Triaging #${item.number}: "${item.title.slice(0, 40)}..."`);

      // A. PR Signals (deterministic)
      const prAssessment = item.kind === "pr" ? assessPrSignals(item) : undefined;

      // B. Duplicates
      const duplicateAssessment = await duplicateDetector.findDuplicates(item);

      // C. Labels
      let labelSuggestion;
      if (method === "knn" || !llmProvider) {
        labelSuggestion = labelPipeline.suggestLabelsKNN(item);
      } else {
        labelSuggestion = await labelPipeline.suggestLabelsLLM(item, llmProvider, method);
      }

      // D. Draft Reply
      const draftReply = await this.replyGenerator.generateDraftReply(
        item,
        duplicateAssessment,
        prAssessment,
        llmProvider
      );

      suggestions[item.number] = {
        itemNumber: item.number,
        labels: labelSuggestion,
        duplicates: duplicateAssessment,
        prAssessment,
        draftReply: draftReply.type !== "NONE" ? draftReply : undefined,
        triagedAt: new Date().toISOString(),
        model: labelSuggestion.model,
      };
    }

    // 4. Save suggestions
    await this.cache.saveSuggestions(suggestions);
    logger.info(`Triage pipeline complete! Saved suggestions for ${Object.keys(suggestions).length} items.`);

    return suggestions;
  }
}
