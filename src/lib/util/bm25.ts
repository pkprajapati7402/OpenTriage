const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could", "couldn't",
  "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each",
  "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't",
  "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
  "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if",
  "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more",
  "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
  "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
  "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
  "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
  "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll",
  "they're", "they've", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
  "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while",
  "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you",
  "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
]);

export function tokenize(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/);

  const tokens: string[] = [];
  for (const word of words) {
    const clean = word.trim();
    if (clean.length >= 2 && !STOP_WORDS.has(clean)) {
      tokens.push(clean);
    }
  }
  return tokens;
}

export interface BM25Document<T = unknown> {
  id: string | number;
  text: string;
  data?: T;
}

export class BM25Index<T = unknown> {
  private k1: number;
  private b: number;
  private documents: Map<string | number, { tokens: string[]; length: number; data?: T }> = new Map();
  private docFrequencies: Map<string, number> = new Map();
  private avgDocLength = 0;
  private totalDocLength = 0;

  constructor(options: { k1?: number; b?: number } = {}) {
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
  }

  public addDocuments(docs: BM25Document<T>[]): void {
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  public addDocument(doc: BM25Document<T>): void {
    const tokens = tokenize(doc.text);
    const uniqueTokens = new Set(tokens);

    for (const token of uniqueTokens) {
      this.docFrequencies.set(token, (this.docFrequencies.get(token) || 0) + 1);
    }

    this.documents.set(doc.id, {
      tokens,
      length: tokens.length,
      data: doc.data,
    });

    this.totalDocLength += tokens.length;
    this.avgDocLength = this.documents.size > 0 ? this.totalDocLength / this.documents.size : 0;
  }

  public search(query: string, topK = 5): { id: string | number; score: number; normalizedScore: number; data?: T }[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.documents.size === 0) {
      return [];
    }

    const nDocs = this.documents.size;
    const scores: { id: string | number; score: number; data?: T }[] = [];

    // Calculate maximum theoretical score for query normalization
    let maxPossibleScore = 0;
    for (const qToken of queryTokens) {
      const df = this.docFrequencies.get(qToken) || 0;
      const idf = Math.log(1 + (nDocs - df + 0.5) / (df + 0.5));
      maxPossibleScore += idf * (this.k1 + 1);
    }
    if (maxPossibleScore <= 0) maxPossibleScore = 1;

    for (const [id, doc] of this.documents.entries()) {
      let score = 0;
      const termCounts: Record<string, number> = {};
      for (const t of doc.tokens) {
        termCounts[t] = (termCounts[t] || 0) + 1;
      }

      for (const qToken of queryTokens) {
        const tf = termCounts[qToken] || 0;
        if (tf === 0) continue;

        const df = this.docFrequencies.get(qToken) || 0;
        const idf = Math.log(1 + (nDocs - df + 0.5) / (df + 0.5));
        const num = tf * (this.k1 + 1);
        const denom = tf + this.k1 * (1 - this.b + this.b * (doc.length / (this.avgDocLength || 1)));

        score += idf * (num / denom);
      }

      if (score > 0) {
        scores.push({
          id,
          score,
          data: doc.data,
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, topK);

    return top.map((item) => ({
      id: item.id,
      score: item.score,
      normalizedScore: Math.min(1, Math.max(0, item.score / (maxPossibleScore * 0.8))),
      data: item.data,
    }));
  }

  public size(): number {
    return this.documents.size;
  }
}
