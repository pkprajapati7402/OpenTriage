import { LLMProvider, EmbeddingProvider, GenerateJSONArgs, GenerateJSONResult } from "./types";
import { globalProviderCache } from "./cache";
import { logger } from "../util/logger";

export class OllamaLLMProvider implements LLMProvider {
  public readonly name = "ollama";
  public readonly model: string;
  private baseUrl: string;

  constructor(model = process.env.OLLAMA_LLM_MODEL || "gemma3:1b", baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434") {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async generateJSON<T>(args: GenerateJSONArgs<T>): Promise<GenerateJSONResult<T>> {
    const promptVersion = args.promptVersion || "v1";

    // 1. Check cache
    const cached = await globalProviderCache.get(
      this.name,
      this.model,
      promptVersion,
      args.system,
      args.user
    );
    if (cached) {
      try {
        const parsed = JSON.parse(cached.rawText);
        const validated = args.schema.parse(parsed);
        return {
          data: validated,
          latencyMs: cached.latencyMs,
          fromCache: true,
        };
      } catch (e) {
        logger.debug("Cached response failed schema parse, re-running:", e);
      }
    }

    // 2. Execute call with retry
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const startTime = Date.now();
      const currentSystem =
        attempt === 0
          ? args.system
          : `${args.system}\n\nIMPORTANT: Your previous output failed schema validation. Return ONLY valid, parseable JSON conforming strictly to the requested schema. Do not output markdown codeblocks or text outside the JSON.`;

      try {
        const res = await fetch(`${this.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            stream: false,
            format: "json",
            messages: [
              { role: "system", content: currentSystem },
              { role: "user", content: args.user },
            ],
            options: {
              temperature: args.temperature ?? 0.1,
              num_predict: args.maxTokens ?? 1024,
              num_ctx: 3072,
            },
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (!res.ok) {
          throw new Error(`Ollama HTTP error ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();
        const rawContent = json.message?.content || "";
        const latencyMs = Date.now() - startTime;

        // Clean markdown backticks if model wrapped JSON
        const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        const validated = args.schema.parse(parsed);

        // Cache valid result
        await globalProviderCache.set(
          this.name,
          this.model,
          promptVersion,
          args.system,
          args.user,
          cleaned,
          latencyMs
        );

        return {
          data: validated,
          latencyMs,
          fromCache: false,
          usage: {
            promptTokens: json.prompt_eval_count,
            completionTokens: json.eval_count,
            totalTokens: (json.prompt_eval_count || 0) + (json.eval_count || 0),
          },
        };
      } catch (err: unknown) {
        lastError = err as Error;
        logger.warn(`Ollama attempt ${attempt + 1} failed:`, err);
      }
    }

    throw new Error(`Ollama generation failed after 2 attempts: ${lastError?.message || "Unknown error"}`);
  }
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  public readonly name = "ollama";
  public readonly model: string;
  private baseUrl: string;

  constructor(model = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text", baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434") {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async embed(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const truncated = text.slice(0, 1500);
      try {
        const res = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            prompt: truncated,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          throw new Error(`Ollama embeddings HTTP ${res.status}`);
        }

        const data = await res.json();
        embeddings.push(data.embedding as number[]);
      } catch (err) {
        logger.warn(`Ollama embedding error for text snippet:`, err);
        throw err;
      }
    }

    return embeddings;
  }
}
