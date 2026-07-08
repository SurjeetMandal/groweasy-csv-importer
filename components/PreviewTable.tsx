"use client";

import type { RawCsvRow } from "@/lib/types";

interface PreviewTableProps {
  rows: RawCsvRow[];
  maxPreviewRows?: number;
}

export function PreviewTable({ rows, maxPreviewRows = 50 }: PreviewTableProps) {
  if (rows.length === 0) return null;

  const columns = Object.keys(rows[0]);
  const previewRows = rows.slice(0, maxPreviewRows);

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
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
            {previewRows.map((row, i) => (
              <tr
                key={i}
                className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-900/50"
              >
                {columns.map((col) => (
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
      {rows.length > maxPreviewRows && (
        <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800">
          Showing first {maxPreviewRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
