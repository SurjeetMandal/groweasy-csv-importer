"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { CRM_FIELD_ORDER, type ImportResponseBody } from "@/lib/types";

interface ResultsTableProps {
  result: ImportResponseBody;
}

export function ResultsTable({ result }: ResultsTableProps) {
  const [tab, setTab] = useState<"imported" | "skipped">("imported");

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Received" value={result.totalReceived} />
        <StatCard
          label="Imported"
          value={result.totalImported}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Skipped"
          value={result.totalSkipped}
          className="text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="flex gap-2">
        <TabButton active={tab === "imported"} onClick={() => setTab("imported")}>
          <CheckCircle2 className="h-4 w-4" /> Imported ({result.totalImported})
        </TabButton>
        <TabButton active={tab === "skipped"} onClick={() => setTab("skipped")}>
          <XCircle className="h-4 w-4" /> Skipped ({result.totalSkipped})
        </TabButton>
      </div>

      {tab === "imported" ? (
        <ImportedTable rows={result.imported} />
      ) : (
        <SkippedTable rows={result.skipped} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className={`text-2xl font-bold ${className}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-orange-500 text-white"
          : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function ImportedTable({ rows }: { rows: ImportResponseBody["imported"] }) {
  if (rows.length === 0) {
    return <EmptyState message="No records were successfully imported." />;
  }
  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {CRM_FIELD_ORDER.map((col) => (
                <th
                  key={col}
                  className="bg-slate-100 dark:bg-slate-800 text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-slate-200 dark:border-slate-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-900/50"
              >
                {CRM_FIELD_ORDER.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800"
                  >
                    {row[col] || (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkippedTable({ rows }: { rows: ImportResponseBody["skipped"] }) {
  if (rows.length === 0) {
    return <EmptyState message="No records were skipped. 🎉" />;
  }
  const columns =
    rows.length > 0 ? Object.keys(rows[0].originalRow) : [];

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-slate-100 dark:bg-slate-800 text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                Reason
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="bg-slate-100 dark:bg-slate-800 text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-slate-200 dark:border-slate-700"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-900/50"
              >
                <td className="px-4 py-2.5 whitespace-nowrap text-amber-600 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800">
                  {row.reason}
                </td>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800"
                  >
                    {row.originalRow[col] || (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
