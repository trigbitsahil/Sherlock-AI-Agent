"use client";

import React from "react";
import { SheetDataTable } from "./SheetDataTable";

interface ToolCallCardProps {
  toolName: string;
  args: any;
  result: any;
}

export function ToolCallCard({ toolName, args, result }: ToolCallCardProps) {
  // Extract specific visualization data based on the tool
  const renderResult = () => {
    // Robust check for result
    const actualResult = result?.output || result?.result || result;
    if (!actualResult) return <div className="text-muted-foreground italic">Executing tool...</div>;

    if (toolName === "read_range" || toolName === "filter_data") {
      return (
        <SheetDataTable
          headers={result.headers || []}
          rows={result.rows || []}
          title={`${result.sheetName || "Sheet"} Data`}
          truncated={result.truncated}
        />
      );
    }

    if (toolName === "list_sheets") {
      const sheets = result.sheets || (Array.isArray(result) ? result : []);
      return (
        <div className="flex flex-wrap gap-2 mt-2">
          {sheets.map((s: any) => (
            <span key={s.id || s.title} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-400 font-medium">
              📄 {s.title || s.name}
            </span>
          ))}
        </div>
      );
    }

    if (toolName === "list_spreadsheets") {
      const groups = actualResult.groups;
      const flatFiles = actualResult.spreadsheets || (Array.isArray(actualResult) ? actualResult : null);
      
      if (!groups && !flatFiles) {
        return <div className="text-sm text-muted-foreground italic mt-2">No spreadsheets found in this folder.</div>;
      }

      // If we have groups, render them
      if (groups && Array.isArray(groups) && groups.length > 0) {
        return (
          <div className="space-y-6 mt-4">
            {groups.map((group: any, gIdx: number) => (
              <div key={gIdx} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-4 bg-blue-500 rounded-full" />
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {group.folderName}
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {group.spreadsheets.map((s: any, idx: number) => (
                    <div key={s.id || idx} className="p-2.5 bg-white/[0.05] rounded-xl border border-white/10 flex items-center gap-3 hover:bg-white/[0.08] transition-colors group/item">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover/item:bg-green-500/20 transition-colors">
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2zm0 8H7v-2h10v2z"/>
                        </svg>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm text-foreground font-medium truncate group-hover/item:text-foreground transition-colors">{s.name}</div>
                        <div className="text-[9px] text-muted-foreground font-mono truncate opacity-60">{s.id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      }

      // Fallback: render flat list if groups are missing
      if (flatFiles && Array.isArray(flatFiles)) {
        return (
          <div className="space-y-1.5 mt-2">
            {flatFiles.map((s: any, idx: number) => (
              <div key={s.id || idx} className="p-2.5 bg-white/[0.05] rounded-xl border border-white/10 flex items-center gap-3 hover:bg-white/[0.08] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2zm0 8H7v-2h10v2z"/>
                  </svg>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm text-foreground font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{s.id}</div>
                </div>
              </div>
            ))}
          </div>
        );
      }
      
      return <div className="text-sm text-muted-foreground italic mt-2">No spreadsheets found.</div>;
    }

    return (
      <details className="mt-2 group">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          View Raw Result
        </summary>
        <pre className="mt-2 p-2 bg-black/40 rounded text-[10px] overflow-auto max-h-40 border border-white/5">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    );
  };

  return (
    <div className="my-3 p-4 rounded-xl border border-white/10 bg-white/[0.05] shadow-xl animate-in">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-mono text-muted-foreground">
          {toolName.replace(/_/g, " ")}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground/60 mb-2 font-mono truncate">
        {JSON.stringify(args)}
      </div>
      {renderResult()}
    </div>
  );
}
