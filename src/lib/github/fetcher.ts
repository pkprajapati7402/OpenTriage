import { DataCache } from "./cache";
import { normalizeItem, normalizeLabel } from "./normalizers";
import { GitHubRawFileChange, GitHubRawItem, GitHubRawLabel, GitHubRepoDetails } from "./types";
import { Item, RepoLabel } from "../schemas";
import { logger } from "../util/logger";

export interface FetchOptions {
  limit?: number;
  useCache?: boolean;
  token?: string;
}

export class GitHubFetcher {
  private owner: string;
  private repo: string;
  private cache: DataCache;
  private token?: string;
  private baseUrl = "https://api.github.com";

  constructor(owner: string, repo: string, token?: string) {
    this.owner = owner;
    this.repo = repo;
    this.cache = new DataCache(owner, repo);
    this.token = token || process.env.GITHUB_TOKEN;
  }

  public getCache(): DataCache {
    return this.cache;
  }

  private getHeaders(etag?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "OpenTriage-Assistant",
    };
    if (this.token && this.token.trim().length > 0) {
      headers.Authorization = `Bearer ${this.token.trim()}`;
    }
    if (etag) {
      headers["If-None-Match"] = etag;
    }
    return headers;
  }

  private handleRateLimitError(res: Response): never {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    const resetDate = reset ? new Date(parseInt(reset, 10) * 1000).toLocaleTimeString() : "soon";

    throw new Error(
      `GitHub API rate limit reached (Remaining: ${remaining || "0"}). Limit resets at ${resetDate}. ` +
      (this.token ? "Consider checking your GITHUB_TOKEN." : "Please add a read-only GITHUB_TOKEN in your .env file to get 5,000 req/hour.")
    );
  }

  public async verifyPublicRepo(): Promise<GitHubRepoDetails> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}`;
    const cacheKey = `repo_details`;
    const cached = await this.cache.getRawResponse<GitHubRepoDetails>(cacheKey);

    const res = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (res.status === 403 || res.status === 429) {
      if (cached) return cached;
      this.handleRateLimitError(res);
    }

    if (res.status === 404) {
      throw new Error(`Repository ${this.owner}/${this.repo} not found or is private. OpenTriage only triages public repositories.`);
    }

    if (!res.ok) {
      if (cached) return cached;
      throw new Error(`Failed to fetch repository metadata: HTTP ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as GitHubRepoDetails;
    if (data.private) {
      throw new Error(`Repository ${this.owner}/${this.repo} is private. OpenTriage only supports public repositories.`);
    }

    await this.cache.saveRawResponse(cacheKey, data);
    return data;
  }

  public async fetchLabels(useCache = true): Promise<RepoLabel[]> {
    if (useCache) {
      const cached = await this.cache.getLabels();
      if (cached && cached.length > 0) {
        return cached;
      }
    }

    const labels: RepoLabel[] = [];
    let page = 1;

    while (page <= 5) {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/labels?per_page=100&page=${page}`;
      const cacheKey = `labels_page_${page}`;
      const cached = await this.cache.getRawResponse<GitHubRawLabel[]>(cacheKey);

      let rawLabels: GitHubRawLabel[] = [];

      if (useCache && cached) {
        rawLabels = cached;
      } else {
        const res = await fetch(url, {
          method: "GET",
          headers: this.getHeaders(),
        });

        if (res.status === 403 || res.status === 429) {
          if (cached) {
            rawLabels = cached;
          } else {
            this.handleRateLimitError(res);
          }
        } else if (!res.ok) {
          logger.warn(`Could not fetch labels page ${page}: HTTP ${res.status}`);
          break;
        } else {
          rawLabels = (await res.json()) as GitHubRawLabel[];
          await this.cache.saveRawResponse(cacheKey, rawLabels);
        }
      }

      if (!rawLabels || rawLabels.length === 0) break;
      labels.push(...rawLabels.map(normalizeLabel));
      if (rawLabels.length < 100) break;
      page++;
    }

    await this.cache.saveLabels(labels);
    return labels;
  }

  public async fetchPrFiles(prNumber: number): Promise<GitHubRawFileChange[]> {
    const cacheKey = `pr_files_${prNumber}`;
    const cached = await this.cache.getRawResponse<GitHubRawFileChange[]>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/pulls/${prNumber}/files?per_page=30`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const files = (await res.json()) as GitHubRawFileChange[];
        await this.cache.saveRawResponse(cacheKey, files);
        return files;
      }
    } catch (err) {
      logger.warn(`Failed to fetch PR #${prNumber} files:`, err);
    }
    return [];
  }

  public async fetchItems(options: FetchOptions = {}): Promise<Item[]> {
    const limit = options.limit ?? 200;
    const useCache = options.useCache ?? true;

    if (useCache) {
      const cached = await this.cache.getItems();
      if (cached && cached.length >= Math.min(limit, 20)) {
        return cached.slice(0, limit);
      }
    }

    // First ensure repo is public
    await this.verifyPublicRepo();

    const normalizedItems: Item[] = [];
    let page = 1;
    const perPage = 100;

    while (normalizedItems.length < limit) {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/issues?state=all&sort=created&direction=desc&per_page=${perPage}&page=${page}`;
      const cacheKey = `issues_page_${page}`;
      const cached = await this.cache.getRawResponse<GitHubRawItem[]>(cacheKey);

      let rawItems: GitHubRawItem[] = [];

      if (useCache && cached) {
        rawItems = cached;
      } else {
        const res = await fetch(url, {
          method: "GET",
          headers: this.getHeaders(),
        });

        if (res.status === 403 || res.status === 429) {
          if (cached) {
            rawItems = cached;
          } else {
            this.handleRateLimitError(res);
          }
        } else if (!res.ok) {
          throw new Error(`Failed to fetch issues page ${page}: HTTP ${res.status} ${res.statusText}`);
        } else {
          rawItems = (await res.json()) as GitHubRawItem[];
          await this.cache.saveRawResponse(cacheKey, rawItems);
        }
      }

      if (!rawItems || rawItems.length === 0) break;

      for (const raw of rawItems) {
        if (normalizedItems.length >= limit) break;

        let fileChanges: GitHubRawFileChange[] | undefined = undefined;
        if (raw.pull_request) {
          // Fetch PR file diff summary
          fileChanges = await this.fetchPrFiles(raw.number);
        }

        const item = normalizeItem(raw, fileChanges);
        normalizedItems.push(item);
      }

      if (rawItems.length < perPage) break;
      page++;
    }

    await this.cache.saveItems(normalizedItems);
    await this.fetchLabels(useCache);

    return normalizedItems;
  }
}
