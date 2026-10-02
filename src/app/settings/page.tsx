"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Cpu,
  ShieldCheck,
  Key,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders,
  Terminal,
} from "lucide-react";

export default function SettingsPage() {
  const [health, setHealth] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 py-2 max-w-4xl mx-auto">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">System & Triage Configuration</h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect model endpoints, GitHub API token status, safety limits, and deterministic heuristics.
        </p>
      </div>

      {/* Provider Connectivity Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Model Providers & Endpoints
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ollama Local Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm text-white">Ollama (Local Inference)</h3>
              </div>
              {health?.providers?.ollama?.available ? (
                <span className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Not Running</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Runs small open-weight models locally on your machine without third-party API keys or costs.
            </p>

            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>LLM Model:</span>
                <span className="text-white">{health?.providers?.ollama?.llmModel || "gemma3:1b"}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Embeddings:</span>
                <span className="text-white">{health?.providers?.ollama?.embedModel || "nomic-embed-text"}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Server URL:</span>
                <span className="text-white">{health?.providers?.ollama?.url || "http://localhost:11434"}</span>
              </div>
            </div>
          </div>

          {/* Hosted OpenAI-Compatible Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-sm text-white">Hosted Model Provider</h3>
              </div>
              {health?.providers?.hosted?.configured ? (
                <span className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Configured</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  <span>Optional</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Optional endpoint for hosted open models (e.g. Groq, Together, OpenRouter) or closed baselines.
            </p>

            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Hosted Model:</span>
                <span className="text-white">{health?.providers?.hosted?.model || "gemma-2-9b-it"}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>In-Repo Lexical:</span>
                <span className="text-emerald-400">BM25 Always Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Token Status Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-sm text-white">GitHub API Access</h3>
          </div>
          {health?.githubTokenConfigured ? (
            <span className="flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Token Active (5,000 req/hr)</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Unauthenticated (60 req/hr limit)</span>
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400">
          OpenTriage requires strictly <strong>read-only access</strong> to public repositories. To increase your GitHub API rate limit from 60 to 5,000 requests per hour, set your personal token in the <code className="text-emerald-400 font-mono">.env</code> file:
        </p>

        <pre className="p-3 rounded-xl bg-slate-950 text-xs font-mono text-slate-300 border border-slate-800">
          GITHUB_TOKEN=ghp_yourReadOnlyTokenHere
        </pre>
      </div>

      {/* Triage Heuristics & Config Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-sm text-white">Triage Rules & Signal Weights (`triage.config.json`)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-300">Deterministic PR Signals:</h4>
            <div className="space-y-1 text-slate-400 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>WHITESPACE_ONLY</span>
                <span className="text-rose-400">+50 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>ADDS_SELF_PROMO_LINK</span>
                <span className="text-rose-400">+45 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>EMPTY_BODY</span>
                <span className="text-rose-400">+40 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>TRIVIAL_DOCS_EDIT</span>
                <span className="text-rose-400">+35 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>TEMPLATE_UNFILLED</span>
                <span className="text-amber-400">+25 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>GENERIC_TITLE</span>
                <span className="text-amber-400">+20 pts</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-slate-300">Calibration Thresholds:</h4>
            <div className="space-y-1 text-slate-400 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Duplicate Match Threshold</span>
                <span className="text-emerald-400">≥ 0.68</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Label Confidence Threshold</span>
                <span className="text-emerald-400">≥ 0.50</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>PR Low-Effort Band</span>
                <span className="text-rose-400">≥ 60 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>PR Review Band</span>
                <span className="text-amber-400">≥ 30 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>History / Test Split</span>
                <span className="text-white">70% / 30%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
