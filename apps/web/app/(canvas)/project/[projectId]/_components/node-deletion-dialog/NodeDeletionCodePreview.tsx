"use client";

import React from "react";
import { FileCode, Copy, Check } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { ActiveFileDetails } from "./types";

interface NodeDeletionCodePreviewProps {
  activeFileDetails: ActiveFileDetails | null;
  previewVersion: "before" | "after";
  onPreviewVersionChange: (version: "before" | "after") => void;
  onCopyCode: () => void;
  copiedCode: boolean;
}

export function NodeDeletionCodePreview({
  activeFileDetails,
  previewVersion,
  onPreviewVersionChange,
  onCopyCode,
  copiedCode,
}: NodeDeletionCodePreviewProps): React.JSX.Element {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 overflow-hidden">
      {/* Code Preview Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span
            className="text-xs font-mono font-medium text-zinc-200 truncate"
            title={activeFileDetails?.path}
          >
            {activeFileDetails?.path?.split("/").pop() || "No file selected"}
          </span>
          {activeFileDetails && (
            <span className="text-[10px] text-zinc-500 font-mono">
              ({activeFileDetails.lines.length} lines)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Before / After Toggle for modified files */}
          {activeFileDetails?.isModified && activeFileDetails.hasAfterVersion && (
            <div className="flex items-center rounded bg-zinc-900 p-0.5 border border-zinc-800 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => onPreviewVersionChange("before")}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  previewVersion === "before"
                    ? "bg-zinc-800 text-zinc-100 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                Before
              </button>
              <button
                type="button"
                onClick={() => onPreviewVersionChange("after")}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  previewVersion === "after"
                    ? "bg-zinc-800 text-zinc-100 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                After
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onCopyCode}
            disabled={!activeFileDetails?.content}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 p-1 px-2 rounded transition-colors flex items-center gap-1 border border-zinc-800 font-mono"
            title="Copy code content"
          >
            {copiedCode ? (
              <Check className="w-3 h-3 text-zinc-300" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copiedCode ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-3 font-mono text-[11px] leading-relaxed custom-scrollbar bg-zinc-950">
        {!activeFileDetails || !activeFileDetails.content ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-xs py-12">
            Select a file from the list to preview its code
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {activeFileDetails.lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-zinc-900/40">
                  <td className="pr-3 text-right select-none text-zinc-600 w-8 align-top text-[10px]">
                    {idx + 1}
                  </td>
                  <td className="text-zinc-300 whitespace-pre font-mono select-text">
                    {line || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
