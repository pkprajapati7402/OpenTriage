import { NextRequest, NextResponse } from "next/server";
import { DataCache } from "@/lib/github/cache";
import { FeedbackSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const owner = (body.owner as string) || "expressjs";
    const repo = (body.repo as string) || "express";

    const validated = FeedbackSchema.parse({
      itemNumber: body.itemNumber,
      target: body.target,
      useful: body.useful,
      note: body.note,
      at: new Date().toISOString(),
    });

    const cache = new DataCache(owner, repo);
    await cache.saveFeedback(validated);

    return NextResponse.json({ success: true, feedback: validated });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") || "expressjs";
  const repo = url.searchParams.get("repo") || "express";

  const cache = new DataCache(owner, repo);
  const feedbackList = await cache.getFeedbackList();

  const total = feedbackList.length;
  const usefulCount = feedbackList.filter((f) => f.useful).length;
  const usefulRate = total > 0 ? (usefulCount / total) * 100 : 0;

  return NextResponse.json({
    total,
    usefulCount,
    usefulRate: Math.round(usefulRate * 10) / 10,
    items: feedbackList,
  });
}
