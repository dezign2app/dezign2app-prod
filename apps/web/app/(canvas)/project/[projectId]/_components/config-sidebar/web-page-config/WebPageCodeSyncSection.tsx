import React from "react";
import {
  FileCode,
  ArrowRightLeft,
  CheckCircle2,
  Pencil,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { DiffSummary } from "../diffMergeUtils";
import { MismatchStatus } from "../useWebPageCodeMismatch";

interface WebPageCodeSyncSectionProps {
  hasCustomServerFile: boolean;
  detectedDiskPath: string;
  defaultFilePath: string;
  outputDir: string;
  mismatchStatus: MismatchStatus;
  diffSummary: DiffSummary;
  isMismatchSaving: boolean;
  onOpenMismatchDialog: () => void;
  onMergeAllToServer: () => void;
  onOverwriteLocalWithServer: () => void;
  onOpenPageStudio: () => void;
  onResetToCompilerBaseline: () => void;
}

export function WebPageCodeSyncSection({
  hasCustomServerFile,
  detectedDiskPath,
  defaultFilePath,
  outputDir,
  mismatchStatus,
  diffSummary,
  isMismatchSaving,
  onOpenMismatchDialog,
  onMergeAllToServer,
  onOverwriteLocalWithServer,
  onOpenPageStudio,
  onResetToCompilerBaseline,
}: WebPageCodeSyncSectionProps) {
  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <span>Frontend Code & Server File Sync</span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasCustomServerFile ? (
            <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25 text-[10px] font-medium font-sans">
              AI / Custom Server File
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground font-sans">
              Compiler Baseline
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Frontend page code is stored as a persistent server file in Convex. All other backend services and configs are compiled from canvas nodes.
      </p>

      {/* Local Workspace & Sync Status */}
      <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-muted/25 border border-border/50 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Target Local File:</span>
          <span className="font-mono text-[11px] text-foreground truncate max-w-[240px]">
            {detectedDiskPath || defaultFilePath}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-border/30 pt-2">
          <span className="text-muted-foreground">Local Workspace:</span>
          {outputDir ? (
            <span className="font-mono text-[11px] text-emerald-500 truncate max-w-[200px]" title={outputDir}>
              📁 {outputDir.replace(/[\\/]+$/, "").split(/[\\/]/).pop()}
            </span>
          ) : (
            <span className="text-amber-500 text-[11px]">No local folder selected</span>
          )}
        </div>

        {/* Real-time Mismatch / Sync Status Banner */}
        <div className="border-t border-border/30 pt-2">
          {mismatchStatus === "mismatch" ? (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>External Edits Detected in Local Repo</span>
                </div>
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-mono">
                  {diffSummary.hunks.length} change block{diffSummary.hunks.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground">
                The local repository file on disk was modified outside this app (e.g. in VS Code / Cursor). The compiler has protected your local code from being overwritten.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1"
                  onClick={onOpenMismatchDialog}
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  Review Changes & Merge
                </Button>

                <Button
                  size="sm"
                  className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium gap-1"
                  onClick={onMergeAllToServer}
                  disabled={isMismatchSaving}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {isMismatchSaving ? "Syncing..." : "Merge All to Server"}
                </Button>
              </div>
            </div>
          ) : mismatchStatus === "synced" ? (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Local repository & server file are in sync</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
                onClick={onOpenMismatchDialog}
              >
                View Code &rarr;
              </Button>
            </div>
          ) : mismatchStatus === "no_disk_file" ? (
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span>File not yet created on disk.</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2"
                onClick={onOverwriteLocalWithServer}
                disabled={isMismatchSaving || !outputDir}
              >
                Write to Disk
              </Button>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Select a local workspace in terminal to enable auto-detection.</span>
            </div>
          )}
        </div>
      </div>

      {/* Page Studio Direct Action */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 gap-1.5"
          onClick={onOpenPageStudio}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Open Full Visual Page Studio</span>
          <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
        </Button>

        {hasCustomServerFile && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2.5"
            onClick={onResetToCompilerBaseline}
            disabled={isMismatchSaving}
            title="Reset server file to default compiler baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
