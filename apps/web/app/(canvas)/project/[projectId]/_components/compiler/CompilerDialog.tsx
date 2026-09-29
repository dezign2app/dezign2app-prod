import React from "react";
import {
  Dialog,
  DialogContent,
} from "@workspace/ui/components/dialog";
import { CompiledFile } from "@/lib/compiler";
import { CompiledCodeViewer } from "./CompiledCodeViewer";
import { Package, AppWindow } from "lucide-react";

export interface CompilerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  projectId?: string;
  overrideFiles?: CompiledFile[];
  overrideTitle?: string;
  /** Current output mode — "app" (standalone) or "package" (workspace package) */
  outputMode?: "app" | "package";
  /** Called when the user toggles the output mode */
  onOutputModeChange?: (mode: "app" | "package") => void;
}

export function CompilerDialog({
  open,
  onOpenChange,
  projectName,
  projectId,
  overrideFiles,
  overrideTitle,
  outputMode,
  onOutputModeChange,
}: CompilerDialogProps) {
  const showModeToggle = Boolean(onOutputModeChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
        {showModeToggle && (
          <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border/40">
            <span className="text-xs text-muted-foreground mr-2 font-medium">Output mode</span>
            <button
              id="compiler-mode-app"
              onClick={() => onOutputModeChange?.("app")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                outputMode === "app" || !outputMode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              <AppWindow className="w-3.5 h-3.5" />
              Standalone App
            </button>
            <button
              id="compiler-mode-package"
              onClick={() => onOutputModeChange?.("package")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                outputMode === "package"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              <Package className="w-3.5 h-3.5" />
              Workspace Package
            </button>
          </div>
        )}
        <CompiledCodeViewer
          projectName={projectName}
          projectId={projectId}
          overrideFiles={overrideFiles}
          overrideTitle={overrideTitle}
          showTopBar={true}
        />
      </DialogContent>
    </Dialog>
  );
}

// Alias export for backward compatibility
export const CompilerModal = CompilerDialog;
