"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { CsvUploader } from "@/components/CsvUploader";
import { PreviewTable } from "@/components/PreviewTable";
import { ResultsTable } from "@/components/ResultsTable";
import type { ImportResponseBody, RawCsvRow } from "@/lib/types";

type Stage = "upload" | "preview" | "loading" | "results";

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [result, setResult] = useState<ImportResponseBody | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleParsed(parsedRows: RawCsvRow[], name: string) {
    setRows(parsedRows);
    setFileName(name);
    setStage("preview");
    setError(null);
  }

  function handleReset() {
    setStage("upload");
    setRows([]);
    setFileName("");
    setResult(null);
    setError(null);
  }

  async function handleConfirm() {
    setStage("loading");
    setError(null);
    try {
      const res = await fetch("/api/import-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data: ImportResponseBody = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Import failed. Please try again.");
        setStage("preview");
        return;
      }

      setResult(data);
      setStage("results");
    } catch {
      setError("Could not reach the server. Please try again.");
      setStage("preview");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-orange-500">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-wide uppercase">
              GrowEasy
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            AI-Powered CSV Lead Importer
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Upload any CSV — Facebook, Google Ads, Excel, or your own sheet —
            and let AI map it into GrowEasy CRM format.
          </p>
        </header>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {stage === "upload" && <CsvUploader onParsed={handleParsed} />}

        {(stage === "preview" || stage === "loading") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">
                  Preview — {fileName}
                </h2>
                <p className="text-sm text-slate-400">
                  {rows.length} row{rows.length !== 1 ? "s" : ""} detected. No
                  AI processing yet — review, then confirm.
                </p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Start over
              </button>
            </div>

            <PreviewTable rows={rows} />

            <button
              onClick={handleConfirm}
              disabled={stage === "loading"}
              className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {stage === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting CRM fields with AI…
                </>
              ) : (
                "Confirm & Import"
              )}
            </button>
          </div>
        )}

        {stage === "results" && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">
                Import Results — {fileName}
              </h2>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Import another file
              </button>
            </div>
            <ResultsTable result={result} />
          </div>
        )}
      </div>
    </main>
  );
}
