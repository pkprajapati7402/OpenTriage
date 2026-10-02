import { EmbeddingProvider } from "./types";
import { tokenize } from "../util/bm25";

/**
 * Pure TypeScript deterministic TF-IDF / term-hashing embedding provider.
 * Guarantees that duplicate detection and retrieval run 100% offline
 * even if Ollama or hosted embedding endpoints are not installed or reachable!
 */
export class LexicalEmbeddingProvider implements EmbeddingProvider {
  public readonly name = "lexical";
  public readonly model = "bm25-tfidf-hash-128";
  private dim: number;

  constructor(dim = 128) {
    this.dim = dim;
  }

  public async isAvailable(): Promise<boolean> {
    return true; // Always available, no network or external process required!
  }

  public async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedSingle(t));
  }

  private embedSingle(text: string): number[] {
    const tokens = tokenize(text);
    const vec = new Array<number>(this.dim).fill(0);

    if (tokens.length === 0) return vec;

    for (const token of tokens) {
      // Simple string hash
      let h = 0;
      for (let i = 0; i < token.length; i++) {
        h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
      }
      const idx = Math.abs(h) % this.dim;
      vec[idx] += 1;
    }

    // L2 normalize vector
    let norm = 0;
    for (let i = 0; i < this.dim; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dim; i++) {
        vec[i] /= norm;
      }
    }

    return vec;
  }
}
