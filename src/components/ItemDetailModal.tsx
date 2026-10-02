"use client";

import { useState } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  GitPullRequest,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Item, ItemTriageSuggestion } from "@/lib/schemas";

interface ItemDetailModalProps {
  item: Item;
  suggestion?: ItemTriageSuggestion;
  owner: string;
  repo: string;
  onClose: () => void;
  onFeedbackSaved?: () => void;
}

export function ItemDetailModal({
  item,
  suggestion,
  owner,
  repo,
  onClose,
  onFeedbackSaved,
}: ItemDetailModalProps) {
  const [copiedLabels, setCopiedLabels] = useState(false);
  const [copiedReply, setCopiedReply] = useState(false);
  const [draftText, setDraftText] = useState(suggestion?.draftReply?.text || "");
  const [feedbackState, setFeedbackState] = useState<{ useful?: boolean; sent: boolean }>({
    sent: false,
  });
  const [feedbackNote, setFeedbackNote] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const isPr = item.kind === "pr";

  const handleCopyLabels = () => {
    const names = suggestion?.labels?.labels?.map((l) => l.name).join(", ");
    if (names) {
      navigator.clipboard.writeText(names);
      setCopiedLabels(true);
      setTimeout(() => setCopiedLabels(false), 2000);
    }
  };

  const handleCopyReply = () => {
    if (draftText) {
      navigator.clipboard.writeText(draftText);
      setCopiedReply(true);
      setTimeout(() => setCopiedReply(false), 2000);
    }
  };

  const handleSendFeedback = async (useful: boolean) => {
    setSubmittingFeedback(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          itemNumber: item.number,
          target: isPr ? "pr" : "labels",
          useful,
          note: feedbackNote || undefined,
        }),
      });
      setFeedbackState({ useful, sent: true });
      if (onFeedbackSaved) onFeedbackSaved();
    } catch (err) {
      console.error("Failed to save feedback:", err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const prBand = suggestion?.prAssessment?.band || "OK";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div className="space-y-1.5 pr-6">
            <div className="flex items-center space-x-2.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isPr
                    ? "bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                    : "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                }`}
              >
                {isPr ? <GitPullRequest className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                {isPr ? "Pull Request" : "Issue"} #{item.number}
              </span>

              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  item.state === "open"
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                {item.state}
              </span>

              <span className="text-xs text-slate-500">
                by <strong className="text-slate-700 dark:text-slate-300">@{item.author}</strong> ({item.authorAssociation || "CONTRIBUTOR"})
              </span>
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
              {item.title}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Open read-only view on GitHub"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section: Low-Effort PR Signals (if PR) */}
          {isPr && (
            <div
              className={`p-4 rounded-xl border ${
                prBand === "LIKELY_LOW_EFFORT"
                  ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                  : prBand === "REVIEW"
                  ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
                  : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <ShieldAlert
                    className={`w-5 h-5 ${
                      prBand === "LIKELY_LOW_EFFORT"
                        ? "text-rose-600 dark:text-rose-400"
                        : prBand === "REVIEW"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  />
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    PR Signal Assessment:
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      prBand === "LIKELY_LOW_EFFORT"
                        ? "bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-200"
                        : prBand === "REVIEW"
                        ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200"
                        : "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200"
                    }`}
                  >
                    {prBand.replace(/_/g, " ")} (Score: {suggestion?.prAssessment?.score ?? 0})
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                {suggestion?.prAssessment?.explanation || "Calculated deterministically via rule-based heuristics."}
              </p>

              {suggestion?.prAssessment?.signals && suggestion.prAssessment.signals.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {suggestion.prAssessment.signals.map((sig) => (
                    <div
                      key={sig.id}
                      className="text-xs flex items-start space-x-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800"
                    >
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-[11px] px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950 rounded">
                        +{sig.weight}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{sig.id}:</span>
                      <span className="text-slate-600 dark:text-slate-400">{sig.evidence}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section: Label Suggestions */}
          <div className="bg-slate-50 dark:bg-slate-850/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                  Suggested Labels ({suggestion?.labels?.method || "llm-fewshot"})
                </h3>
                {suggestion?.labels?.model && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {suggestion.labels.model}
                  </span>
                )}
              </div>

              {suggestion?.labels?.labels && suggestion.labels.labels.length > 0 && (
                <button
                  onClick={handleCopyLabels}
                  className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {copiedLabels ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLabels ? "Copied!" : "Copy Labels"}</span>
                </button>
              )}
            </div>

            {suggestion?.labels?.abstain ? (
              <p className="text-xs text-slate-500 italic">
                Abstained from suggesting labels (no candidate label matched with &gt; 50% confidence).
              </p>
            ) : suggestion?.labels?.labels && suggestion.labels.labels.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {suggestion.labels.labels.map((lbl) => (
                  <div
                    key={lbl.name}
                    className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {lbl.name}
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-500">
                        {Math.round(lbl.confidence * 100)}% conf
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{lbl.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No suggestions generated yet.</p>
            )}

            {item.labels.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-2 text-xs text-slate-500">
                <span>Existing GitHub labels:</span>
                <div className="flex flex-wrap gap-1">
                  {item.labels.map((l) => (
                    <span key={l} className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: Duplicate Detection */}
          <div className="bg-slate-50 dark:bg-slate-850/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2 mb-3">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Duplicate Detection (Hybrid BM25 + Embeddings)
              </h3>
            </div>

            {suggestion?.duplicates?.candidates && suggestion.duplicates.candidates.length > 0 ? (
              <div className="space-y-2">
                {suggestion.duplicates.candidates.map((cand) => (
                  <div
                    key={cand.number}
                    className={`p-3 rounded-lg border flex items-start justify-between ${
                      cand.score >= 0.68
                        ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          #{cand.number}
                        </span>
                        <a
                          href={cand.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {cand.title}
                        </a>
                      </div>
                      {cand.reason && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">{cand.reason}</p>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                          cand.score >= 0.68
                            ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {Math.round(cand.score * 100)}% match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                <span>No likely duplicate issues found in repository history.</span>
              </div>
            )}
          </div>

          {/* Section: Draft First Reply */}
          {suggestion?.draftReply && (
            <div className="bg-slate-50 dark:bg-slate-850/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Draft First Reply ({suggestion.draftReply.type.replace(/_/g, " ")})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    AI-Assisted Draft
                  </span>
                </div>

                <button
                  onClick={handleCopyReply}
                  className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {copiedReply ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReply ? "Copied!" : "Copy Reply"}</span>
                </button>
              </div>

              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={4}
                className="w-full text-xs font-sans p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <p className="text-[11px] text-slate-500 mt-1.5 italic">
                Maintainer controls what gets sent. You can edit this text directly above before copying.
              </p>
            </div>
          )}

          {/* Section: Original Item Body */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Original Text Description
            </h4>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-64">
              {item.body ? item.body : <span className="text-slate-500 italic">No description provided.</span>}
            </div>
          </div>

          {/* Section: Feedback capture (F11) */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-850/30 p-3 rounded-xl">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Did you find these triage suggestions helpful?
            </span>

            {feedbackState.sent ? (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>Thank you! Feedback recorded locally.</span>
              </span>
            ) : (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Optional comment..."
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 w-44"
                />
                <button
                  onClick={() => handleSendFeedback(true)}
                  disabled={submittingFeedback}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 text-slate-600 dark:text-slate-300 transition"
                  title="Useful suggestion"
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSendFeedback(false)}
                  disabled={submittingFeedback}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600 text-slate-600 dark:text-slate-300 transition"
                  title="Not useful"
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
