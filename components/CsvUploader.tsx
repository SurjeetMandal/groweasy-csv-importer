"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { UploadCloud, FileWarning } from "lucide-react";
import type { RawCsvRow } from "@/lib/types";

interface CsvUploaderProps {
  onParsed: (rows: RawCsvRow[], fileName: string) => void;
}

export function CsvUploader({ onParsed }: CsvUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      setIsParsing(true);

      Papa.parse<RawCsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          setIsParsing(false);
          if (results.errors.length > 0) {
            // PapaParse still often produces usable data alongside minor
            // warnings (e.g. inconsistent column counts), so we only bail
            // out on errors severe enough to prevent header detection.
            const fatal = results.errors.find((e) => e.type === "Delimiter");
            if (fatal) {
              setError("Could not detect a valid CSV structure in this file.");
              return;
            }
          }
          const rows = (results.data as RawCsvRow[]).filter(
            (row) => Object.values(row).some((v) => v && v.trim() !== "")
          );
          if (rows.length === 0) {
            setError("This CSV file doesn't contain any data rows.");
            return;
          }
          onParsed(rows, file.name);
        },
        error: (err) => {
          setIsParsing(false);
          setError(err.message || "Failed to parse this CSV file.");
        },
      });
    },
    [onParsed]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: { file: File }[]) => {
      if (rejectedFiles.length > 0) {
        setError("Please upload a valid .csv file.");
        return;
      }
      if (acceptedFiles[0]) handleFile(acceptedFiles[0]);
    },
    [handleFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer
          ${
            isDragActive
              ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
              : "border-slate-300 dark:border-slate-700 hover:border-orange-300 hover:bg-slate-50 dark:hover:bg-slate-900"
          }`}
      >
        <input {...getInputProps()} />
        <div className="rounded-full bg-orange-100 dark:bg-orange-950/40 p-4">
          <UploadCloud className="h-7 w-7 text-orange-500" />
        </div>
        <p className="text-base font-medium text-slate-700 dark:text-slate-200">
          {isParsing
            ? "Parsing your file…"
            : isDragActive
            ? "Drop your CSV here"
            : "Drag & drop your CSV file here"}
        </p>
        <p className="text-sm text-slate-400">
          or click to browse — any CSV layout works
        </p>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <FileWarning className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
