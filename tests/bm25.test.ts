import { describe, it, expect } from "vitest";
import { BM25Index, tokenize } from "../src/lib/util/bm25";

describe("BM25 Tokenizer", () => {
  it("lowercases and filters stop words", () => {
    const tokens = tokenize("The quick brown fox jumps over the lazy dog");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
    expect(tokens).toContain("fox");
    expect(tokens).toContain("jumps");
    expect(tokens).toContain("lazy");
    expect(tokens).toContain("dog");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("over");
  });

  it("handles empty or special character strings safely", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("!@#$%^&*()")).toEqual([]);
  });
});

describe("BM25 Ranking Index", () => {
  it("indexes and retrieves the most relevant document", () => {
    const index = new BM25Index();
    index.addDocuments([
      { id: 1, text: "Crash on startup when loading user profile in Linux" },
      { id: 2, text: "Add dark mode toggle to navigation settings" },
      { id: 3, text: "Profile page crashing with segmentation fault" },
    ]);

    const results = index.search("crash startup profile", 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(1);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].normalizedScore).toBeGreaterThan(0);
  });

  it("returns empty array when query does not match", () => {
    const index = new BM25Index();
    index.addDocument({ id: 10, text: "Database connection timeout error" });
    const results = index.search("xylophone quantum mechanics");
    expect(results.length).toBe(0);
  });
});
