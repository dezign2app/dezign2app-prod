"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  DiffHunk,
  DiffSummary,
  applySelectedHunks,
} from "./diffMergeUtils";
import { DiffEditor, Editor } from "@monaco-editor/react";
import {
  Columns2,
  Rows2,
  GitMerge,
  ArrowRightLeft,
  CheckCheck,
  RotateCcw,
  Sparkles,
  Eye,
  FileCode,
  Layers,
  ArrowDownToLine,
  ArrowUpToLine,
} from "lucide-react";

export interface PageCodeMismatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageName: string;
  pageRoute: string;
  filePath: string;
  serverCode: string;
  localDiskCode: string;
  diffSummary: DiffSummary;
  isSaving?: boolean;
  onMergeAll: () => Promise<void> | void;
  onMergeSelected: (selectedHunkIds: string[]) => Promise<void> | void;
  onOverwriteLocal: () => Promise<void> | void;
}

export function PageCodeMismatchDialog({
  open,
  onOpenChange,
  pageName,
  pageRoute,
  filePath,
  serverCode,
  localDiskCode,
  diffSummary,
  isSaving = false,
  onMergeAll,
  onMergeSelected,
  onOverwriteLocal,
}: PageCodeMismatchDialogProps) {
  // Set of selected hunk IDs (defaults to all hunks selected)
  const [selectedHunkIds, setSelectedHunkIds] = useState<Set<string>>(() => {
    return new Set(diffSummary.hunks.map((h) => h.id));
  });

  // Keep selectedHunkIds in sync when hunks change
  useEffect(() => {
    setSelectedHunkIds(new Set(diffSummary.hunks.map((h) => h.id)));
  }, [diffSummary.hunks]);

  // View settings
  const [activeTab, setActiveTab] = useState<"diff" | "preview">("diff");
  const [renderSideBySide, setRenderSideBySide] = useState<boolean>(true);

  const toggleHunk = (hunkId: string) => {
    setSelectedHunkIds((prev) => {
      const next = new Set(prev);
      if (next.has(hunkId)) {
        next.delete(hunkId);
      } else {
        next.add(hunkId);
      }
      return next;
    });
  };

  const selectAllHunks = () => {
    setSelectedHunkIds(new Set(diffSummary.hunks.map((h) => h.id)));
  };

  const deselectAllHunks = () => {
    setSelectedHunkIds(new Set());
  };

  // Preview code computation
  const mergedPreviewCode = useMemo(() => {
    return applySelectedHunks(serverCode, diffSummary.hunks, selectedHunkIds);
  }, [serverCode, diffSummary.hunks, selectedHunkIds]);

  const allSelected = selectedHunkIds.size === diffSummary.hunks.length && diffSummary.hunks.length > 0;
  const noneSelected = selectedHunkIds.size === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[88vh] p-0 flex flex-col overflow-hidden bg-background border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/60 bg-muted/20 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/20">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  <span>External Code Edits Detected</span>
                  <Badge variant="outline" className="font-mono text-[10px] bg-sidebar-accent">
                    {pageRoute || pageName}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  The local repository file on disk has been modified outside this app (e.g. in VS Code/Cursor). Review individual change hunks below.
                </DialogDescription>
              </div>
            </div>

            {/* View Mode Switchers */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/60 border border-border/60 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("diff")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "diff"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Diff Inspector</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "preview"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Merged Preview</span>
                </button>
              </div>

              {activeTab === "diff" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRenderSideBySide((prev) => !prev)}
                  className="h-7 px-2.5 text-xs gap-1.5"
                  title={renderSideBySide ? "Switch to inline diff" : "Switch to side-by-side diff"}
                >
                  {renderSideBySide ? (
                    <>
                      <Columns2 className="w-3.5 h-3.5" />
                      <span>Side-by-Side</span>
                    </>
                  ) : (
                    <>
                      <Rows2 className="w-3.5 h-3.5" />
                      <span>Inline</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground pt-1 border-t border-border/30">
            <span className="flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5 text-primary" />
              <span className="text-foreground">{filePath}</span>
            </span>
            <span>•</span>
            <span className="text-amber-500 font-semibold">
              {diffSummary.hunks.length} change block{diffSummary.hunks.length === 1 ? "" : "s"} found
            </span>
            {diffSummary.addedLines > 0 && (
              <span className="text-emerald-500">+{diffSummary.addedLines} lines added</span>
            )}
            {diffSummary.deletedLines > 0 && (
              <span className="text-rose-500">-{diffSummary.deletedLines} lines deleted</span>
            )}
          </div>
        </DialogHeader>

        {/* Main Work Area: Left Hunks List + Right Monaco Diff/Preview */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Panel: Individual Change Hunks List */}
          <div className="w-[340px] border-r border-border/60 bg-muted/10 flex flex-col shrink-0">
            <div className="p-3 border-b border-border/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Select Changes to Merge</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                  {selectedHunkIds.size}/{diffSummary.hunks.length}
                </Badge>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={selectAllHunks}
                >
                  All
                </Button>
                <span className="text-muted-foreground/40">/</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={deselectAllHunks}
                >
                  None
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {diffSummary.hunks.map((hunk, idx) => {
                const isSelected = selectedHunkIds.has(hunk.id);
                return (
                  <div
                    key={hunk.id}
                    onClick={() => toggleHunk(hunk.id)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "bg-card border-indigo-500/50 shadow-sm"
                        : "bg-muted/20 border-border/40 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleHunk(hunk.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="font-semibold text-foreground truncate">
                            Change #{idx + 1}
                          </span>
                          {hunk.type === "add" && (
                            <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 text-[9px] px-1.5 py-0 font-mono">
                              + Added
                            </Badge>
                          )}
                          {hunk.type === "delete" && (
                            <Badge className="bg-rose-500/15 text-rose-500 border border-rose-500/20 text-[9px] px-1.5 py-0 font-mono">
                              - Deleted
                            </Badge>
                          )}
                          {hunk.type === "modify" && (
                            <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/20 text-[9px] px-1.5 py-0 font-mono">
                              ~ Modified
                            </Badge>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground mb-2">
                          {hunk.summary}
                        </p>

                        {/* Snippet preview */}
                        <div className="rounded-md bg-[#0d1117] p-2 font-mono text-[10px] leading-tight overflow-x-hidden text-slate-300 max-h-24 overflow-y-auto">
                          {hunk.originalLines.slice(0, 3).map((l, i) => (
                            <div key={`orig-${i}`} className="text-rose-400 truncate">
                              - {l}
                            </div>
                          ))}
                          {hunk.modifiedLines.slice(0, 3).map((l, i) => (
                            <div key={`mod-${i}`} className="text-emerald-400 truncate">
                              + {l}
                            </div>
                          ))}
                          {hunk.originalLines.length + hunk.modifiedLines.length > 6 && (
                            <div className="text-muted-foreground text-[9px] mt-1">
                              ...and more lines
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Monaco Diff / Preview Editor */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
            {activeTab === "diff" ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border/40 text-[11px] font-mono text-slate-300 shrink-0">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Original (Server / Compiler Baseline)
                    </span>
                    <span>&rarr;</span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Modified (Local Disk Repo)
                    </span>
                  </div>
                </div>

                <div className="flex-1 relative overflow-hidden">
                  <DiffEditor
                    original={serverCode}
                    modified={localDiskCode}
                    language="typescript"
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      renderSideBySide,
                      automaticLayout: true,
                      minimap: { enabled: false },
                      fontSize: 12,
                      fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
                      scrollBeyondLastLine: false,
                      lineNumbers: "on",
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border/40 text-[11px] font-mono text-slate-300 shrink-0">
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Merged Result Preview ({selectedHunkIds.size} change block{selectedHunkIds.size === 1 ? "" : "s"} applied)
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    This is what will be saved to the Convex server file and synced to disk
                  </span>
                </div>

                <div className="flex-1 relative overflow-hidden">
                  <Editor
                    value={mergedPreviewCode}
                    language="typescript"
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      automaticLayout: true,
                      minimap: { enabled: false },
                      fontSize: 12,
                      fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
                      scrollBeyondLastLine: false,
                      lineNumbers: "on",
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="px-6 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOverwriteLocal}
              disabled={isSaving}
              className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Overwrite Local with Server</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="text-xs text-muted-foreground"
            >
              Keep Separate
            </Button>

            {!allSelected && selectedHunkIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMergeSelected(Array.from(selectedHunkIds))}
                disabled={isSaving || noneSelected}
                className="text-xs gap-1.5 border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Merge Selected ({selectedHunkIds.size})</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={onMergeAll}
              disabled={isSaving}
              className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{isSaving ? "Syncing..." : "Merge All to Server"}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
