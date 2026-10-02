"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  GitPullRequest,
  AlertCircle,
  Sparkles,
  Layers,
  ShieldAlert,
  ArrowUpDown,
  Tag,
  Loader2,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { Item, ItemTriageSuggestion } from "@/lib/schemas";
import { ItemDetailModal } from "@/components/ItemDetailModal";

interface QueueItem extends Item {
  suggestion?: ItemTriageSuggestion;
}

export default function QueuePage() {
  const [repoName, setRepoName] = useState<string>("expressjs/express");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTriage, setRunningTriage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "issue" | "pr">("all");
  const [duplicateFilter, setDuplicateFilter] = useState(false);
  const [lowEffortFilter, setLowEffortFilter] = useState(false);
  const [abstainedFilter, setAbstainedFilter] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "confidence" | "score">("newest");

  // Selected item modal & keyboard nav index
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  const fetchItems = useCallback(async (currentRepo: string) => {
    if (!currentRepo.includes("/")) return;
    const [owner, name] = currentRepo.split("/");
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/repo/${owner}/${name}/items`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to load repository items.");
      }
      setItems(data.items || []);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedRepo = localStorage.getItem("opentriage_repo") || "expressjs/express";
    setRepoName(savedRepo);
    fetchItems(savedRepo);
  }, [fetchItems]);

  // Keyboard navigation: J (down), K (up), Enter (open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return Math.min(items.length - 1, prev + 1);
        });
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return Math.max(0, prev - 1);
        });
      } else if (e.key === "Enter" && selectedIndex !== null) {
        e.preventDefault();
        if (items[selectedIndex]) {
          setSelectedItem(items[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        setSelectedItem(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex]);

  const handleRunTriage = async () => {
    if (!repoName.includes("/")) return;
    const [owner, name] = repoName.split("/");
    setRunningTriage(true);

    try {
      const res = await fetch(`/api/repo/${owner}/${name}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 30, method: "llm-fewshot" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to run triage pipeline.");
      }
      await fetchItems(repoName);
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Error running triage: ${error.message}`);
    } finally {
      setRunningTriage(false);
    }
  };

  // Client-side filtering
  const filteredItems = items.filter((item) => {
    if (kindFilter !== "all" && item.kind !== kindFilter) return false;
    if (duplicateFilter && !item.suggestion?.duplicates?.isDuplicate) return false;
    if (lowEffortFilter && item.suggestion?.prAssessment?.band !== "LIKELY_LOW_EFFORT") return false;
    if (abstainedFilter && !item.suggestion?.labels?.abstain) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const inTitle = item.title.toLowerCase().includes(q);
      const inBody = item.body.toLowerCase().includes(q);
      const inNum = item.number.toString().includes(q);
      if (!inTitle && !inBody && !inNum) return false;
    }

    return true;
  });

  const [owner, name] = repoName.split("/");

  return (
    <div className="space-y-6">
      {/* Top Header & Triage Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">{repoName}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {items.length} items
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Maintainer Triage Queue · Keyboard shortcuts: <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">J</kbd> next, <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">K</kbd> prev, <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">Enter</kbd> inspect
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchItems(repoName)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh items from cache"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleRunTriage}
            disabled={runningTriage || loading}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            {runningTriage ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Triage...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run AI Triage</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by title, description, or #number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Kind Pill Selector */}
          <div className="flex items-center p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => setKindFilter("all")}
              className={`px-3 py-1 rounded-md transition ${
                kindFilter === "all" ? "bg-slate-800 text-white font-medium shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setKindFilter("issue")}
              className={`px-3 py-1 rounded-md transition ${
                kindFilter === "issue" ? "bg-slate-800 text-blue-400 font-medium shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Issues ({items.filter((i) => i.kind === "issue").length})
            </button>
            <button
              onClick={() => setKindFilter("pr")}
              className={`px-3 py-1 rounded-md transition ${
                kindFilter === "pr" ? "bg-slate-800 text-purple-400 font-medium shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              PRs ({items.filter((i) => i.kind === "pr").length})
            </button>
          </div>
        </div>

        {/* Specialized Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-500 flex items-center space-x-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Signals:</span>
          </span>

          <button
            onClick={() => setDuplicateFilter(!duplicateFilter)}
            className={`px-2.5 py-1 rounded-lg border text-xs transition ${
              duplicateFilter
                ? "bg-amber-950/80 text-amber-300 border-amber-700 font-semibold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            🔁 Has Duplicate
          </button>

          <button
            onClick={() => setLowEffortFilter(!lowEffortFilter)}
            className={`px-2.5 py-1 rounded-lg border text-xs transition ${
              lowEffortFilter
                ? "bg-rose-950/80 text-rose-300 border-rose-700 font-semibold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            🚩 Low-Effort PRs
          </button>

          <button
            onClick={() => setAbstainedFilter(!abstainedFilter)}
            className={`px-2.5 py-1 rounded-lg border text-xs transition ${
              abstainedFilter
                ? "bg-slate-800 text-slate-200 border-slate-600 font-semibold"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            Abstained Labels
          </button>
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
          <p className="text-sm">Loading queue items...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center rounded-xl bg-rose-950/30 border border-rose-900/60 text-rose-300 space-y-2">
          <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
          <p className="text-sm font-semibold">{errorMsg}</p>
          <p className="text-xs text-slate-400">Try loading the repository from the Home page first.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <p className="text-sm">No items match the current filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            const sugg = item.suggestion;
            const isPr = item.kind === "pr";
            const prBand = sugg?.prAssessment?.band;

            return (
              <div
                key={item.number}
                onClick={() => {
                  setSelectedIndex(idx);
                  setSelectedItem(item);
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-slate-850 border-emerald-500/80 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/50"
                    : "bg-slate-900/90 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850/80"
                }`}
              >
                {/* Left: Metadata & Title */}
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex items-center space-x-2 text-xs">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                        isPr
                          ? "bg-purple-950/80 text-purple-300 border border-purple-800"
                          : "bg-blue-950/80 text-blue-300 border border-blue-800"
                      }`}
                    >
                      {isPr ? <GitPullRequest className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                      #{item.number}
                    </span>

                    <span className="text-slate-400 font-mono">@{item.author}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-slate-100 hover:text-emerald-400 transition">
                    {item.title}
                  </h3>

                  {/* Badges / Suggestions row */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {/* Suggested Labels */}
                    {sugg?.labels?.labels && sugg.labels.labels.length > 0 ? (
                      sugg.labels.labels.map((l) => (
                        <span
                          key={l.name}
                          className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800"
                          title={l.reason}
                        >
                          <Tag className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                          {l.name} ({Math.round(l.confidence * 100)}%)
                        </span>
                      ))
                    ) : sugg?.labels?.abstain ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 italic">
                        Abstained
                      </span>
                    ) : null}

                    {/* Duplicate Indicator */}
                    {sugg?.duplicates?.isDuplicate && (
                      <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800">
                        <Layers className="w-2.5 h-2.5 mr-1 text-amber-400" />
                        Dupe of #{sugg.duplicates.candidates[0]?.number} ({Math.round(sugg.duplicates.topScore * 100)}%)
                      </span>
                    )}

                    {/* Low-Effort PR Signal */}
                    {isPr && prBand && (
                      <span
                        className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          prBand === "LIKELY_LOW_EFFORT"
                            ? "bg-rose-950 text-rose-300 border border-rose-800"
                            : prBand === "REVIEW"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        }`}
                      >
                        <ShieldAlert className="w-2.5 h-2.5 mr-1" />
                        {prBand.replace(/_/g, " ")}
                      </span>
                    )}

                    {/* Draft Reply Indicator */}
                    {sugg?.draftReply && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        Draft: {sugg.draftReply.type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Quick Action Arrow */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center space-x-1">
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Item Detail Modal Drawer */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          suggestion={selectedItem.suggestion}
          owner={owner}
          repo={name}
          onClose={() => setSelectedItem(null)}
          onFeedbackSaved={() => fetchItems(repoName)}
        />
      )}
    </div>
  );
}
