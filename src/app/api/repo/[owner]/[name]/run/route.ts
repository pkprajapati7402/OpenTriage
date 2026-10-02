import { NextRequest, NextResponse } from "next/server";
import { TriagePipelineRunner } from "@/lib/pipeline";
import { getLLMProvider, getEmbeddingProvider } from "@/lib/providers/factory";
import { checkRateLimit } from "@/lib/util/ratelimit";

export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; name: string } }
) {
  const { owner, name } = params;

  // Rate limit guard for hosted mode
  if (process.env.APP_MODE === "hosted") {
    const ip = req.headers.get("x-forwarded-for") || "client";
    const rl = checkRateLimit(ip, 20, 300);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: rl.error } },
        { status: 429 }
      );
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? Math.min(body.limit, 50) : 30;
    const method = body.method || "llm-fewshot";
    const model = body.model;

    const llm = getLLMProvider({ modelName: model });
    const embed = await getEmbeddingProvider(true);

    const runner = new TriagePipelineRunner(owner, name);
    const suggestions = await runner.run({
      limit,
      method,
      llmProvider: llm,
      embeddingProvider: embed,
    });

    return NextResponse.json({
      success: true,
      triagedCount: Object.keys(suggestions).length,
      suggestions,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: { message: error.message || "Failed to run triage pipeline" } },
      { status: 500 }
    );
  }
}
