import { NextRequest, NextResponse } from "next/server";
import { DataCache } from "@/lib/github/cache";

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; name: string } }
) {
  const { owner, name } = params;
  const cache = new DataCache(owner, name);

  const items = await cache.getItems();
  if (!items) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `No data found for ${owner}/${name}. Please load it first.` } },
      { status: 404 }
    );
  }

  const labels = (await cache.getLabels()) || [];
  const suggestions = (await cache.getSuggestions()) || {};

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind"); // "issue" | "pr"
  const state = url.searchParams.get("state"); // "open" | "closed"
  const hasDuplicate = url.searchParams.get("hasDuplicate"); // "true"
  const band = url.searchParams.get("band"); // "OK" | "REVIEW" | "LIKELY_LOW_EFFORT"
  const abstained = url.searchParams.get("abstained"); // "true"
  const search = (url.searchParams.get("search") || "").toLowerCase().trim();
  const sort = url.searchParams.get("sort") || "newest";

  // Combine items with suggestions
  let combined = items.map((item) => {
    const sugg = suggestions[item.number];
    return {
      ...item,
      suggestion: sugg,
    };
  });

  // Apply filters
  if (kind && kind !== "all") {
    combined = combined.filter((i) => i.kind === kind);
  }
  if (state && state !== "all") {
    combined = combined.filter((i) => i.state === state);
  }
  if (hasDuplicate === "true") {
    combined = combined.filter((i) => i.suggestion?.duplicates?.isDuplicate);
  }
  if (band && band !== "all") {
    combined = combined.filter((i) => i.suggestion?.prAssessment?.band === band);
  }
  if (abstained === "true") {
    combined = combined.filter((i) => i.suggestion?.labels?.abstain);
  }
  if (search) {
    combined = combined.filter(
      (i) =>
        i.title.toLowerCase().includes(search) ||
        i.body.toLowerCase().includes(search) ||
        i.number.toString().includes(search)
    );
  }

  // Sort
  if (sort === "oldest") {
    combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (sort === "confidence") {
    combined.sort((a, b) => {
      const confA = a.suggestion?.labels?.labels?.[0]?.confidence || 0;
      const confB = b.suggestion?.labels?.labels?.[0]?.confidence || 0;
      return confB - confA;
    });
  } else if (sort === "score") {
    combined.sort((a, b) => {
      const scoreA = a.suggestion?.prAssessment?.score || a.suggestion?.duplicates?.topScore || 0;
      const scoreB = b.suggestion?.prAssessment?.score || b.suggestion?.duplicates?.topScore || 0;
      return scoreB - scoreA;
    });
  } else {
    // newest first (default)
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return NextResponse.json({
    owner,
    repo: name,
    total: combined.length,
    labels,
    items: combined,
  });
}
