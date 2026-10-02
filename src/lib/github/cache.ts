import fs from "fs";
import path from "path";
import { Item, RepoLabel, ItemTriageSuggestion, Feedback } from "../schemas";
import { logger } from "../util/logger";

export class DataCache {
  private repoKey: string;
  private baseDir: string;
  private memoryCache: Map<string, unknown> = new Map();

  constructor(owner: string, repo: string) {
    this.repoKey = `${owner.toLowerCase()}__${repo.toLowerCase()}`;
    this.baseDir = path.resolve(process.cwd(), "data", this.repoKey);
  }

  public getRepoKey(): string {
    return this.repoKey;
  }

  private ensureDir(dir: string): void {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      logger.warn(`Could not create directory ${dir}, falling back to memory:`, err);
    }
  }

  private getFilePath(filename: string): string {
    return path.join(this.baseDir, filename);
  }

  private getSamplePath(filename: string): string {
    return path.resolve(process.cwd(), "samples", this.repoKey, filename);
  }

  public async saveRawResponse(endpointKey: string, data: unknown): Promise<void> {
    const rawDir = path.join(this.baseDir, "raw");
    this.ensureDir(rawDir);
    const safeKey = endpointKey.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(rawDir, `${safeKey}.json`);
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch {
      this.memoryCache.set(`raw_${safeKey}`, data);
    }
  }

  public async getRawResponse<T>(endpointKey: string): Promise<T | null> {
    const safeKey = endpointKey.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(this.baseDir, "raw", `${safeKey}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const content = await fs.promises.readFile(filePath, "utf8");
        return JSON.parse(content) as T;
      }
    } catch {
      // Fall through to memory
    }
    return (this.memoryCache.get(`raw_${safeKey}`) as T) || null;
  }

  public async saveItems(items: Item[]): Promise<void> {
    this.ensureDir(this.baseDir);
    const filePath = this.getFilePath("items.json");
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(items, null, 2), "utf8");
    } catch {
      this.memoryCache.set("items", items);
    }
  }

  public async getItems(): Promise<Item[] | null> {
    const primary = this.getFilePath("items.json");
    const sample = this.getSamplePath("items.json");

    for (const p of [primary, sample]) {
      try {
        if (fs.existsSync(p)) {
          const content = await fs.promises.readFile(p, "utf8");
          return JSON.parse(content) as Item[];
        }
      } catch {
        // try next
      }
    }
    return (this.memoryCache.get("items") as Item[]) || null;
  }

  public async saveLabels(labels: RepoLabel[]): Promise<void> {
    this.ensureDir(this.baseDir);
    const filePath = this.getFilePath("labels.json");
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(labels, null, 2), "utf8");
    } catch {
      this.memoryCache.set("labels", labels);
    }
  }

  public async getLabels(): Promise<RepoLabel[] | null> {
    const primary = this.getFilePath("labels.json");
    const sample = this.getSamplePath("labels.json");

    for (const p of [primary, sample]) {
      try {
        if (fs.existsSync(p)) {
          const content = await fs.promises.readFile(p, "utf8");
          return JSON.parse(content) as RepoLabel[];
        }
      } catch {
        // try next
      }
    }
    return (this.memoryCache.get("labels") as RepoLabel[]) || null;
  }

  public async saveEmbeddings(embeddings: Record<string, number[]>): Promise<void> {
    this.ensureDir(this.baseDir);
    const filePath = this.getFilePath("embeddings.json");
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(embeddings, null, 2), "utf8");
    } catch {
      this.memoryCache.set("embeddings", embeddings);
    }
  }

  public async getEmbeddings(): Promise<Record<string, number[]> | null> {
    const primary = this.getFilePath("embeddings.json");
    const sample = this.getSamplePath("embeddings.json");

    for (const p of [primary, sample]) {
      try {
        if (fs.existsSync(p)) {
          const content = await fs.promises.readFile(p, "utf8");
          return JSON.parse(content) as Record<string, number[]>;
        }
      } catch {
        // try next
      }
    }
    return (this.memoryCache.get("embeddings") as Record<string, number[]>) || null;
  }

  public async saveSuggestions(suggestions: Record<number, ItemTriageSuggestion>): Promise<void> {
    this.ensureDir(this.baseDir);
    const filePath = this.getFilePath("suggestions.json");
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(suggestions, null, 2), "utf8");
    } catch {
      this.memoryCache.set("suggestions", suggestions);
    }
  }

  public async getSuggestions(): Promise<Record<number, ItemTriageSuggestion> | null> {
    const primary = this.getFilePath("suggestions.json");
    const sample = this.getSamplePath("suggestions.json");

    for (const p of [primary, sample]) {
      try {
        if (fs.existsSync(p)) {
          const content = await fs.promises.readFile(p, "utf8");
          return JSON.parse(content) as Record<number, ItemTriageSuggestion>;
        }
      } catch {
        // try next
      }
    }
    return (this.memoryCache.get("suggestions") as Record<number, ItemTriageSuggestion>) || null;
  }

  public async saveFeedback(feedback: Feedback): Promise<void> {
    this.ensureDir(this.baseDir);
    const filePath = this.getFilePath("feedback.json");
    let list: Feedback[] = [];
    try {
      if (fs.existsSync(filePath)) {
        const content = await fs.promises.readFile(filePath, "utf8");
        list = JSON.parse(content) as Feedback[];
      }
    } catch {
      list = (this.memoryCache.get("feedback") as Feedback[]) || [];
    }

    list.push(feedback);

    try {
      await fs.promises.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
    } catch {
      this.memoryCache.set("feedback", list);
    }
  }

  public async getFeedbackList(): Promise<Feedback[]> {
    const primary = this.getFilePath("feedback.json");
    try {
      if (fs.existsSync(primary)) {
        const content = await fs.promises.readFile(primary, "utf8");
        return JSON.parse(content) as Feedback[];
      }
    } catch {
      // fallback
    }
    return (this.memoryCache.get("feedback") as Feedback[]) || [];
  }
}
