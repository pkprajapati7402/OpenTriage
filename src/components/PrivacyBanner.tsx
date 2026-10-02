"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Info, X } from "lucide-react";

export function PrivacyBanner() {
  const [appMode, setAppMode] = useState<string>("local");
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.appMode) setAppMode(data.appMode);
      })
      .catch(() => {});
  }, []);

  if (dismissed) return null;

  const isHosted = appMode === "hosted";

  return (
    <div
      className={`w-full py-2.5 px-4 text-xs font-medium border-b flex items-center justify-between ${
        isHosted
          ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center space-x-2">
        {isHosted ? (
          <>
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>
              <strong>Hosted Demo Notice:</strong> This demo runs on a hosted API for public repositories only. For sensitive code and 100% offline privacy, switch to <strong>Local Mode</strong> with Ollama Gemma.
            </span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>
              <strong>Local & Read-Only Invariant:</strong> OpenTriage executes 100% locally with open models. Your repo text never leaves your machine, and no write actions are ever issued to GitHub.
            </span>
          </>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
        aria-label="Dismiss banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
