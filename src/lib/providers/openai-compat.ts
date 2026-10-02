import { LLMProvider, GenerateJSONArgs, GenerateJSONResult } from "./types";
import { globalProviderCache } from "./cache";
import { logger } from "../util/logger";

export class OpenAICompatLLMProvider implements LLMProvider {
  public readonly name: string;
  public readonly model: string;
  private baseUrl: string;
  private apiKey?: string;

  constructor(options: {
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  } = {}) {
    this.name = options.name || "openai-compat";
    this.baseUrl = (options.baseUrl || process.env.HOSTED_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    this.apiKey = options.apiKey || process.env.HOSTED_API_KEY;
    this.model = options.model || process.env.HOSTED_MODEL || "gemma-2-9b-it";
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.apiKey && !this.baseUrl.includes("localhost")) {
      return false;
    }
    return true;
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

    if (!this.apiKey && !this.baseUrl.includes("localhost")) {
      throw new Error(`OpenAI-compatible provider ${this.name} requires an API key in HOSTED_API_KEY.`);
    }

    // 2. Execute call with retry
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const startTime = Date.now();
      const currentSystem =
        attempt === 0
          ? `${args.system}\n\nIMPORTANT: Respond with pure, parseable JSON matching the requested schema. No code fences, no extra text.`
          : `${args.system}\n\nCRITICAL FIX: Your previous response failed schema validation. Return ONLY valid, parseable JSON strictly matching the schema with no preamble or explanation.`;

      try {
        const url = `${this.baseUrl}/chat/completions`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (this.apiKey) {
          headers.Authorization = `Bearer ${this.apiKey.trim()}`;
        }

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: this.model,
            temperature: args.temperature ?? 0.1,
            max_tokens: args.maxTokens ?? 1024,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: currentSystem },
              { role: "user", content: args.user },
            ],
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`OpenAI-compat HTTP error ${res.status}: ${res.statusText} (${errText.slice(0, 200)})`);
        }

        const json = await res.json();
        const rawContent = json.choices?.[0]?.message?.content || "";
        const latencyMs = Date.now() - startTime;

        // Clean json codeblocks
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
          usage: json.usage
            ? {
                promptTokens: json.usage.prompt_tokens,
                completionTokens: json.usage.completion_tokens,
                totalTokens: json.usage.total_tokens,
              }
            : undefined,
        };
      } catch (err: unknown) {
        lastError = err as Error;
        logger.warn(`OpenAI-compat attempt ${attempt + 1} failed:`, err);
      }
    }

    throw new Error(`OpenAI-compat generation failed after 2 attempts: ${lastError?.message || "Unknown error"}`);
  }
}
