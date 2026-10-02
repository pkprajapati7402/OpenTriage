"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowRight,
  Sparkles,
  Tag,
  CopyCheck,
  ShieldCheck,
  BarChart3,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu,
  Lock,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [repoInput, setRepoInput] = useState("expressjs/express");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadedRepo, setLoadedRepo] = useState<any | null>(null);
  const [appMode, setAppMode] = useState("local");

  useEffect(() => {
    const saved = localStorage.getItem("opentriage_repo");
    if (saved) {
      setRepoInput(saved);
      checkLoadedRepo(saved);
    } else {
      checkLoadedRepo("expressjs/express");
    }

    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.appMode) setAppMode(data.appMode);
      })
      .catch(() => {});
  }, []);

  const checkLoadedRepo = async (repoName: string) => {
    if (!repoName.includes("/")) return;
    const [owner, name] = repoName.split("/");
    try {
      const res = await fetch(`/api/repo/${owner}/${name}/items?limit=5`);
      if (res.ok) {
        const data = await res.json();
        setLoadedRepo(data);
      }
    } catch {
      // not loaded yet
    }
  };

  const handleLoadRepo = async (targetRepo?: string) => {
    const repoToLoad = (targetRepo || repoInput).trim();
    if (!repoToLoad || !repoToLoad.includes("/")) {
      setErrorMsg("Please enter a valid 'owner/repo' format (e.g. expressjs/express)");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/repo/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoToLoad, limit: 50 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to load repository");
      }

      localStorage.setItem("opentriage_repo", repoToLoad);
      setRepoInput(repoToLoad);
      setLoadedRepo(data);

      router.push("/queue");
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: Tag,
      title: "Label Suggestions",
      desc: "Picks strictly from your repo's existing labels with clear one-sentence reasons. Abstains when uncertain.",
      color: "text-emerald-400 bg-emerald-950/60 border-emerald-800",
    },
    {
      icon: CopyCheck,
      title: "Duplicate Detection",
      desc: "Finds the top 3 similar past issues with similarity scores using hybrid BM25 + embeddings. Works even offline.",
      color: "text-blue-400 bg-blue-950/60 border-blue-800",
    },
    {
      icon: GitPullRequest,
      title: "Low-Effort PR Signals",
      desc: "Rule-based and transparent signals (empty description, whitespace diffs, trivial README edits).",
      color: "text-purple-400 bg-purple-950/60 border-purple-800",
    },
    {
      icon: Sparkles,
      title: "Kind Draft First Replies",
      desc: "Generates polite, constructive first responses asking for missing reproduction steps that maintainers edit before sending.",
      color: "text-amber-400 bg-amber-950/60 border-amber-800",
    },
    {
      icon: BarChart3,
      title: "Reproducible Evaluation",
      desc: "One command measures suggestions against past maintainer ground truth and compares models without future data leakage.",
      color: "text-rose-400 bg-rose-950/60 border-rose-800",
    },
    {
      icon: Lock,
      title: "100% Read-Only Safety",
      desc: "Zero write permissions. Never modifies, labels, comments, or closes anything on GitHub without you.",
      color: "text-teal-400 bg-teal-950/60 border-teal-800",
    },
  ];

  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto pt-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>DEV Hacktoberfest 2026 Challenge · Build for a Friend</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          A local-first, open-model <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            triage assistant
          </span>{" "}
          for maintainers.
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
          Suggests labels, spots duplicates, flags low-effort PRs, and drafts kind first replies. Runs locally with small open-weight models (Gemma) on a modest laptop.
        </p>
      </div>

      {/* Main Action Box */}
      <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl glass-card space-y-4">
        <label htmlFor="repo-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Enter Any Public GitHub Repository (owner/repo)
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-mono text-sm">
              github.com/
            </span>
            <input
              id="repo-input"
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repo"
              className="w-full pl-28 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <button
            onClick={() => handleLoadRepo()}
            disabled={isLoading}
            className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all hover:scale-[1.02]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>Open Queue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick Sample Loaders */}
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-400 font-medium">Or try precomputed samples:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleLoadRepo("expressjs/express")}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono transition"
            >
              ⚡ expressjs/express
            </button>
            <button
              onClick={() => handleLoadRepo("colinhacks/zod")}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono transition"
            >
              ⚡ colinhacks/zod
            </button>
          </div>
        </div>
      </div>

      {/* Loaded Repo Status Card (if available) */}
      {loadedRepo && (
        <div className="max-w-2xl mx-auto p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-900/60 flex items-center justify-center text-emerald-400 border border-emerald-700/50">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {loadedRepo.owner}/{loadedRepo.repo} is loaded
              </h4>
              <p className="text-xs text-slate-400">
                {loadedRepo.totalItems || loadedRepo.total} items cached · Ready for triage inspection
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/queue")}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition"
          >
            View Triage Queue →
          </button>
        </div>
      )}

      {/* Feature Grid */}
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-white">Why OpenTriage?</h2>
          <p className="text-xs text-slate-400">Designed around human-in-the-loop judgment and open innovation</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition space-y-3"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${f.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-100">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
