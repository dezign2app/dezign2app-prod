"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Folder, FolderOpen, AlertCircle, CheckCircle2, ChevronRight, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { findProjectFolderConflict } from "./terminal/hooks/projectWorkspaceUtils";

interface ProjectFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentOutputDir: string;
  onPickDirectory: () => Promise<string | null>;
  onSaveDirectory: (dir: string) => boolean;
}

export function ProjectFolderModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  currentOutputDir,
  onPickDirectory,
  onSaveDirectory,
}: ProjectFolderModalProps) {
  const [manualPath, setManualPath] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePick = async () => {
    setErrorMessage(null);
    setIsPicking(true);
    try {
      const selected = await onPickDirectory();
      if (selected) {
        onOpenChange(false);
      }
    } catch (err) {
      console.warn("[ProjectFolderModal] Pick error:", err);
    } finally {
      setIsPicking(false);
    }
  };

  const handleManualSave = () => {
    setErrorMessage(null);
    const trimmed = manualPath.trim();
    if (!trimmed) {
      setErrorMessage("Please enter a folder path.");
      return;
    }

    const conflict = findProjectFolderConflict(projectId, trimmed);
    if (conflict) {
      setErrorMessage(
        `This folder is already assigned to "${conflict.projectName}". Each project must have a unique local folder.`
      );
      return;
    }

    const ok = onSaveDirectory(trimmed);
    if (ok) {
      toast.success(`Project folder connected: ${trimmed}`);
      setManualPath("");
      setShowManualInput(false);
      onOpenChange(false);
    } else {
      setErrorMessage("Failed to set directory for this project.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden font-sans border-border/60 bg-background/95 backdrop-blur-md shadow-2xl">
        {/* Header with gradient accent */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40 p-5">
          <DialogHeader className="gap-1.5 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-sm">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                  Select Project Folder
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Project: <span className="font-semibold text-foreground">{projectName || "Untitled Project"}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Explanation Notice */}
          <div className="p-3.5 rounded-lg bg-muted/40 border border-border/50 text-muted-foreground space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <HardDrive className="w-4 h-4 text-primary shrink-0" />
              <span>Dedicated Workspace Required</span>
            </div>
            <p>
              The project folder is <strong>unique to each project</strong>. Code compilation, live terminal sessions, and local disk synchronization run inside this dedicated directory.
            </p>
          </div>

          {/* Current Connected Folder (if already set) */}
          {currentOutputDir ? (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[11px]">Currently Connected Folder:</div>
                <div className="font-mono text-xs text-foreground truncate mt-0.5" title={currentOutputDir}>
                  {currentOutputDir}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No local folder connected for this project yet.</span>
            </div>
          )}

          {/* Conflict / Validation Error Notice */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive flex items-start gap-2 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Manual Path Entry Toggle */}
          <div className="pt-1">
            {!showManualInput ? (
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors group"
              >
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                <span>Enter folder path manually instead</span>
              </button>
            ) : (
              <div className="space-y-2 pt-1 border-t border-border/40">
                <label className="text-[11px] font-medium text-foreground">
                  Custom Directory Path:
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    placeholder="e.g. C:\workspace\my-project or /Users/name/projects/my-project"
                    className="h-8 text-xs font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleManualSave();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={handleManualSave}
                  >
                    Save Path
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/20 border-t border-border/40 flex items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Decide Later
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePick}
            disabled={isPicking}
            className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{currentOutputDir ? "Change Project Folder" : "Choose Project Folder"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
