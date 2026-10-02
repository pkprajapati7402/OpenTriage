import { Item, DuplicateCandidate, DuplicateAssessment } from "../schemas";
import { BM25Index } from "../util/bm25";
import { EmbeddingProvider } from "../providers/types";
import { logger } from "../util/logger";

export interface DuplicateOptions {
  threshold?: number;
  topK?: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

export class DuplicateDetector {
  private historyItems: Item[];
  private bm25Index: BM25Index<Item>;
  private embeddings: Map<number, number[]> = new Map();
  private embeddingProvider?: EmbeddingProvider;
  private defaultThreshold: number;

  constructor(
    historyItems: Item[],
    options: {
      threshold?: number;
      embeddingProvider?: EmbeddingProvider;
      precomputedEmbeddings?: Record<string | number, number[]>;
    } = {}
  ) {
    this.historyItems = historyItems;
    this.defaultThreshold = options.threshold ?? 0.68;
    this.embeddingProvider = options.embeddingProvider;

    // Load precomputed embeddings
    if (options.precomputedEmbeddings) {
      for (const [key, vec] of Object.entries(options.precomputedEmbeddings)) {
        this.embeddings.set(Number(key), vec);
      }
    }

    // Build BM25 index over all history items
    this.bm25Index = new BM25Index<Item>({ k1: 1.5, b: 0.75 });
    this.bm25Index.addDocuments(
      historyItems.map((item) => ({
        id: item.number,
        text: `${item.title} ${item.body.slice(0, 1000)}`,
        data: item,
      }))
    );
  }

  public async prepareEmbeddings(): Promise<void> {
    if (!this.embeddingProvider) return;

    const missingItems = this.historyItems.filter((item) => !this.embeddings.has(item.number));
    if (missingItems.length === 0) return;

    logger.info(`Computing embeddings for ${missingItems.length} history items...`);
    const texts = missingItems.map((item) => `${item.title}\n\n${item.body.slice(0, 1000)}`);

    try {
      const vecs = await this.embeddingProvider.embed(texts);
      for (let i = 0; i < missingItems.length; i++) {
        this.embeddings.set(missingItems[i].number, vecs[i]);
      }
    } catch (err) {
      logger.warn("Failed to generate some embeddings, BM25 fallback will be used:", err);
    }
  }

  public getEmbeddingsMap(): Record<string, number[]> {
    const obj: Record<string, number[]> = {};
    for (const [num, vec] of this.embeddings.entries()) {
      obj[num.toString()] = vec;
    }
    return obj;
  }

  public async findDuplicates(
    targetItem: Item,
    options: DuplicateOptions = {}
  ): Promise<DuplicateAssessment> {
    const threshold = options.threshold ?? this.defaultThreshold;
    const topK = options.topK ?? 3;

    const queryText = `${targetItem.title} ${targetItem.body.slice(0, 1000)}`;

    // 1. BM25 Search
    const bm25Results = this.bm25Index.search(queryText, 15);
    const bm25Scores = new Map<number, number>();
    for (const res of bm25Results) {
      const num = Number(res.id);
      if (num !== targetItem.number) {
        bm25Scores.set(num, res.normalizedScore);
      }
    }

    // 2. Embeddings search (if target and history have embeddings)
    let targetVec = this.embeddings.get(targetItem.number);
    if (!targetVec && this.embeddingProvider) {
      try {
        const [vec] = await this.embeddingProvider.embed([queryText]);
        targetVec = vec;
        if (targetVec) {
          this.embeddings.set(targetItem.number, targetVec);
        }
      } catch {
        // use bm25 only
      }
    }

    // 3. Score all history candidates (excluding target itself)
    const scoredCandidates: DuplicateCandidate[] = [];

    for (const hist of this.historyItems) {
      if (hist.number === targetItem.number) continue;

      const bm25Score = bm25Scores.get(hist.number) || 0;
      const histVec = this.embeddings.get(hist.number);

      let hybridScore = bm25Score;

      if (targetVec && histVec) {
        const embedSim = cosineSimilarity(targetVec, histVec);
        hybridScore = 0.65 * embedSim + 0.35 * bm25Score;
      }

      if (hybridScore > 0.15) {
        let reason = "";
        if (hybridScore >= threshold) {
          reason = `High similarity (${Math.round(hybridScore * 100)}%) in issue title and described behavior`;
        } else {
          reason = `Moderate keyword overlap (${Math.round(hybridScore * 100)}%)`;
        }

        scoredCandidates.push({
          number: hist.number,
          title: hist.title,
          url: hist.url,
          score: Math.round(hybridScore * 100) / 100,
          state: hist.state,
          matchedSnippet: hist.body.slice(0, 140),
          reason,
        });
      }
    }

    scoredCandidates.sort((a, b) => b.score - a.score);
    const topCandidates = scoredCandidates.slice(0, topK);

    const topScore = topCandidates.length > 0 ? topCandidates[0].score : 0;
    const isDuplicate = topScore >= threshold;

    return {
      candidates: topCandidates,
      isDuplicate,
      topScore,
    };
  }
}
