import { Item, RepoLabel, ChangedFile } from "../schemas";
import { GitHubRawItem, GitHubRawLabel, GitHubRawFileChange } from "./types";

export function normalizeLabel(raw: GitHubRawLabel | string): RepoLabel {
  if (typeof raw === "string") {
    return { name: raw, color: "888888", description: "" };
  }
  return {
    name: raw.name || "unnamed",
    color: raw.color || "888888",
    description: raw.description || "",
  };
}

export function extractDuplicateOf(body: string | null, labels: string[]): number | undefined {
  if (!body && labels.length === 0) return undefined;

  // Check labels for duplicate indicators
  const isDuplicateLabel = labels.some((l) => l.toLowerCase() === "duplicate" || l.toLowerCase().includes("duplicate"));
  
  if (body) {
    // Regex for "duplicate of #123" or "closed in favor of #123" or "same as #123"
    const match = body.match(/(?:duplicate\s+of|dupe\s+of|same\s+as|superseded\s+by|closing\s+in\s+favor\s+of)\s*#(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }

  return isDuplicateLabel ? -1 : undefined; // -1 indicates confirmed duplicate of unspecified issue
}

export function normalizeItem(
  raw: GitHubRawItem,
  fileChanges?: GitHubRawFileChange[]
): Item {
  const isPr = Boolean(raw.pull_request);
  const labelNames: string[] = (raw.labels || []).map((l) =>
    typeof l === "string" ? l : l.name
  );

  let prDetails = undefined;
  if (isPr) {
    const changedFiles: ChangedFile[] = (fileChanges || []).map((f) => ({
      path: f.filename,
      additions: f.additions || 0,
      deletions: f.deletions || 0,
      patch: f.patch ? f.patch.slice(0, 1500) : undefined,
    }));

    const totalAdditions = changedFiles.reduce((acc, f) => acc + f.additions, 0);
    const totalDeletions = changedFiles.reduce((acc, f) => acc + f.deletions, 0);

    prDetails = {
      changedFiles,
      totalAdditions,
      totalDeletions,
      changedFilesCount: changedFiles.length,
    };
  }

  const duplicateOf = extractDuplicateOf(raw.body, labelNames);

  return {
    id: raw.id,
    number: raw.number,
    kind: isPr ? "pr" : "issue",
    title: raw.title || "",
    body: raw.body || "",
    author: raw.user?.login || "ghost",
    authorAssociation: raw.author_association || "NONE",
    createdAt: raw.created_at,
    closedAt: raw.closed_at,
    state: raw.state === "closed" ? "closed" : "open",
    merged: Boolean(raw.pull_request?.merged_at),
    labels: labelNames,
    duplicateOf,
    url: raw.html_url,
    pr: prDetails,
  };
}
