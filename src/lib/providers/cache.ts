import fs from "fs";
import path from "path";
import { cacheKey } from "../util/hash";
import { logger } from "../util/logger";

interface CachedLLMResponse {
  rawText: string;
  latencyMs: number;
  timestamp: string;
}

export class ProviderCache {
  private baseDir: string;
  private memoryCache: Map<string, CachedLLMResponse> = new Map();

  constructor() {
    this.baseDir = path.resolve(process.cwd(), "data", ".provider_cache");
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch {
      // fallback to memory
    }
  }

  private getKey(provider: string, model: string, promptVersion: string, system: string, user: string): string {
    return cacheKey([provider, model, promptVersion, system, user]);
  }

  public async get(
    provider: string,
    model: string,
    promptVersion: string,
    system: string,
    user: string
  ): Promise<CachedLLMResponse | null> {
    const key = this.getKey(provider, model, promptVersion, system, user);

    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)!;
    }

    const filePath = path.join(this.baseDir, `${key}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const content = await fs.promises.readFile(filePath, "utf8");
        const parsed = JSON.parse(content) as CachedLLMResponse;
        this.memoryCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public async set(
    provider: string,
    model: string,
    promptVersion: string,
    system: string,
    user: string,
    rawText: string,
    latencyMs: number
  ): Promise<void> {
    const key = this.getKey(provider, model, promptVersion, system, user);
    const data: CachedLLMResponse = {
      rawText,
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    this.memoryCache.set(key, data);
    this.ensureDir();

    const filePath = path.join(this.baseDir, `${key}.json`);
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      logger.debug("ProviderCache disk write failed:", err);
    }
  }
}

export const globalProviderCache = new ProviderCache();
