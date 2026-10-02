import { NextResponse } from "next/server";
import { OllamaLLMProvider, OllamaEmbeddingProvider } from "@/lib/providers/ollama";

export async function GET() {
  const ollamaLlm = new OllamaLLMProvider();
  const ollamaEmbed = new OllamaEmbeddingProvider();

  const [ollamaLlmOk, ollamaEmbedOk] = await Promise.all([
    ollamaLlm.isAvailable().catch(() => false),
    ollamaEmbed.isAvailable().catch(() => false),
  ]);

  const hasGithubToken = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim().length > 0);
  const appMode = process.env.APP_MODE || "local";

  return NextResponse.json({
    status: "ok",
    appMode,
    providers: {
      ollama: {
        available: ollamaLlmOk,
        llmModel: ollamaLlm.model,
        embedAvailable: ollamaEmbedOk,
        embedModel: ollamaEmbed.model,
        url: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      },
      hosted: {
        configured: Boolean(process.env.HOSTED_API_KEY || process.env.HOSTED_BASE_URL),
        model: process.env.HOSTED_MODEL || "gemma-2-9b-it",
      },
      lexical: {
        available: true,
        model: "in-repo BM25 + TF-IDF",
      },
    },
    githubTokenConfigured: hasGithubToken,
  });
}
