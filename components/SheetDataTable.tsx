"use client";

import React from "react";

interface SheetDataTableProps {
  headers: string[];
  rows: Record<string, any>[];
  title?: string;
  truncated?: boolean;
}

export function SheetDataTable({ headers, rows, title, truncated }: SheetDataTableProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-black/40 overflow-hidden animate-in">
      {title && (
        <div className="px-4 py-2 bg-white/5 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title} {truncated && <span className="text-yellow-500/80 ml-2">(Truncated)</span>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-white/5">
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-2 font-medium text-white border-b border-white/5 whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                {headers.map((header, j) => (
                  <td key={j} className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {row[header]?.toString() || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length >= 5 && (
        <div className="px-4 py-2 bg-black/20 text-[10px] text-center text-muted-foreground italic border-t border-white/5">
          Showing {rows.length} records
        </div>
      )}
    </div>
  );
}
