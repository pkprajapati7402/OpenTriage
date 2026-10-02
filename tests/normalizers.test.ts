import { describe, it, expect } from "vitest";
import { normalizeItem, normalizeLabel, extractDuplicateOf } from "../src/lib/github/normalizers";
import { GitHubRawItem } from "../src/lib/github/types";

describe("GitHub Normalizers", () => {
  it("extracts duplicate issue references correctly from issue body", () => {
    expect(extractDuplicateOf("Closing this, duplicate of #452", [])).toBe(452);
    expect(extractDuplicateOf("Same as #108.", [])).toBe(108);
    expect(extractDuplicateOf("Superseded by #99", [])).toBe(99);
    expect(extractDuplicateOf("Regular bug description with no mention", ["duplicate"])).toBe(-1);
    expect(extractDuplicateOf("Regular bug description", ["bug"])).toBeUndefined();
  });

  it("normalizes a raw GitHub item into an Item schema", () => {
    const raw: GitHubRawItem = {
      id: 9991,
      number: 42,
      title: "Memory leak in event loop",
      body: "Observed high memory usage in production server.",
      user: { id: 1, login: "alice", avatar_url: "https://github.com/alice.png" },
      labels: [{ id: 1, name: "bug", color: "d73a4a" }, "performance"],
      state: "open",
      created_at: "2026-09-01T12:00:00Z",
      closed_at: null,
      html_url: "https://github.com/owner/repo/issues/42",
      author_association: "CONTRIBUTOR",
    };

    const item = normalizeItem(raw);
    expect(item.id).toBe(9991);
    expect(item.number).toBe(42);
    expect(item.kind).toBe("issue");
    expect(item.title).toBe("Memory leak in event loop");
    expect(item.labels).toEqual(["bug", "performance"]);
    expect(item.author).toBe("alice");
    expect(item.authorAssociation).toBe("CONTRIBUTOR");
  });

  it("normalizes raw label objects or strings", () => {
    expect(normalizeLabel("enhancement")).toEqual({
      name: "enhancement",
      color: "888888",
      description: "",
    });
    expect(
      normalizeLabel({
        id: 12,
        name: "documentation",
        color: "0075ca",
        description: "Improvements to docs",
      })
    ).toEqual({
      name: "documentation",
      color: "0075ca",
      description: "Improvements to docs",
    });
  });
});
