import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { PrivacyBanner } from "@/components/PrivacyBanner";

export const metadata: Metadata = {
  title: "OpenTriage — Local-First Open-Model Triage Assistant",
  description:
    "A local-first, open-model triage assistant for open-source maintainers. Suggests labels, spots duplicates, flags low-effort PRs, and drafts kind first replies with zero telemetry.",
  keywords: [
    "OpenTriage",
    "GitHub triage",
    "open models",
    "Gemma",
    "Ollama",
    "Hacktoberfest",
    "open-source maintainer",
    "local AI",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        <PrivacyBanner />
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
          <p>
            Built for open-source maintainers with open-weight models. 100% read-only against GitHub.
          </p>
          <p className="mt-1">
            Author: <strong>Prince Kumar Prajapati</strong> (<a href="https://github.com/pkprajapati7402" target="_blank" rel="noopener noreferrer" className="hover:underline text-emerald-400">@pkprajapati7402</a>) · MIT License
          </p>
        </footer>
      </body>
    </html>
  );
}
