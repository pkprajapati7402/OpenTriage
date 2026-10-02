import { LLMProvider, EmbeddingProvider } from "./types";
import { OllamaLLMProvider, OllamaEmbeddingProvider } from "./ollama";
import { OpenAICompatLLMProvider } from "./openai-compat";
import { LexicalEmbeddingProvider } from "./lexical";
import { logger } from "../util/logger";

export interface ProviderOptions {
  providerName?: "ollama" | "openai-compat" | "hosted" | "baseline";
  modelName?: string;
  baseUrl?: string;
  apiKey?: string;
}

export function getLLMProvider(options: ProviderOptions = {}): LLMProvider {
  const mode = process.env.APP_MODE || "local";
  const requestedProvider = options.providerName || (mode === "hosted" ? "openai-compat" : "ollama");

  if (requestedProvider === "baseline" || (process.env.BASELINE_MODEL && options.modelName === process.env.BASELINE_MODEL)) {
    return new OpenAICompatLLMProvider({
      name: "baseline",
      baseUrl: options.baseUrl || process.env.BASELINE_BASE_URL,
      apiKey: options.apiKey || process.env.BASELINE_API_KEY,
      model: options.modelName || process.env.BASELINE_MODEL || "gpt-4o-mini",
    });
  }

  if (requestedProvider === "openai-compat" || requestedProvider === "hosted") {
    return new OpenAICompatLLMProvider({
      name: "hosted-openai-compat",
      baseUrl: options.baseUrl || process.env.HOSTED_BASE_URL,
      apiKey: options.apiKey || process.env.HOSTED_API_KEY,
      model: options.modelName || process.env.HOSTED_MODEL || "gemma-2-9b-it",
    });
  }

  // Default: Ollama local
  return new OllamaLLMProvider(
    options.modelName || process.env.OLLAMA_LLM_MODEL || "gemma3:1b",
    options.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434"
  );
}

export async function getEmbeddingProvider(preferOllama = true): Promise<EmbeddingProvider> {
  if (preferOllama) {
    const ollamaEmbed = new OllamaEmbeddingProvider();
    const available = await ollamaEmbed.isAvailable().catch(() => false);
    if (available) {
      return ollamaEmbed;
    }
    logger.info("Ollama embeddings not reachable, using local LexicalEmbeddingProvider fallback.");
  }

  return new LexicalEmbeddingProvider();
}
