import { NextRequest, NextResponse } from "next/server";
import { GitHubFetcher } from "@/lib/github/fetcher";
import { checkRateLimit } from "@/lib/util/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repoStr = body.repo as string;
    const limit = typeof body.limit === "number" ? body.limit : 50;
    const forceRefresh = Boolean(body.forceRefresh);

    if (!repoStr || !repoStr.includes("/")) {
      return NextResponse.json(
        { error: { code: "INVALID_REPO", message: "Please specify repository as 'owner/repo'." } },
        { status: 400 }
      );
    }

    const [owner, repo] = repoStr.split("/").map((s) => s.trim());

    // Rate limit guard for hosted mode
    if (process.env.APP_MODE === "hosted") {
      const ip = req.headers.get("x-forwarded-for") || "client";
      const rl = checkRateLimit(ip, 30, 300);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: { code: "RATE_LIMITED", message: rl.error } },
          { status: 429 }
        );
      }
    }

    const fetcher = new GitHubFetcher(owner, repo);
    const cache = fetcher.getCache();

    // Check if repo data already exists
    let items = forceRefresh ? null : await cache.getItems();
    let labels = forceRefresh ? null : await cache.getLabels();

    if (!items || !labels || items.length === 0) {
      items = await fetcher.fetchItems({ limit, useCache: !forceRefresh });
      labels = await fetcher.fetchLabels(!forceRefresh);
    }

    const suggestions = await cache.getSuggestions();

    const issues = items.filter((i) => i.kind === "issue");
    const prs = items.filter((i) => i.kind === "pr");

    return NextResponse.json({
      owner,
      repo,
      totalItems: items.length,
      issuesCount: issues.length,
      prsCount: prs.length,
      labelsCount: labels.length,
      hasSuggestions: Boolean(suggestions && Object.keys(suggestions).length > 0),
      suggestionsCount: suggestions ? Object.keys(suggestions).length : 0,
    });
  } catch (err: unknown) {
    const error = err as Error;
    const isRateLimit = error.message.includes("rate limit");
    return NextResponse.json(
      { error: { code: isRateLimit ? "GITHUB_RATE_LIMIT" : "FETCH_ERROR", message: error.message } },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
