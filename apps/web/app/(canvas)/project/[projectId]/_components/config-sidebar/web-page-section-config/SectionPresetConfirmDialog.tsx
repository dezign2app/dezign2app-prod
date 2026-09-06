"use client";

import React, { useState, useEffect } from "react";
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
import { Label } from "@workspace/ui/components/label";
import {
  Package,
  Zap,
  Sparkles,
  Shield,
  Layers,
  Check,
  Plus,
  Trash2,
  Cpu,
  LayoutGrid,
  Table,
  FormInput,
  MessageSquare,
  BarChart3,
  Box,
  type LucideIcon,
} from "lucide-react";
import { SectionPreset, SectionIconName } from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";

const PRESET_ICON_MAP: Record<SectionIconName, LucideIcon> = {
  "layout-grid": LayoutGrid,
  "table": Table,
  "form-input": FormInput,
  "message-square": MessageSquare,
  "bar-chart-3": BarChart3,
  "box": Box,
  "sparkles": Sparkles,
  "package": Package,
};

export interface SectionPresetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: SectionPreset | null;
  currentSectionName?: string;
  currentLibraries?: string[];
  existingActionsCount?: number;
  onConfirm: (
    preset: SectionPreset,
    options: {
      deletePreviousActions: boolean;
      updateName: boolean;
    }
  ) => void;
}

export const SectionPresetConfirmDialog: React.FC<SectionPresetConfirmDialogProps> = ({
  open,
  onOpenChange,
  preset,
  currentSectionName = "",
  currentLibraries = [],
  existingActionsCount = 0,
  onConfirm,
}) => {
  const [deletePreviousActions, setDeletePreviousActions] = useState(false);
  const [updateName, setUpdateName] = useState(true);

  // Reset checkboxes when preset opens
  useEffect(() => {
    if (open && preset) {
      setDeletePreviousActions(false);
      setUpdateName(true);
    }
  }, [open, preset]);

  if (!preset) return null;

  const Icon: LucideIcon =
    (preset.iconName && PRESET_ICON_MAP[preset.iconName]) || Sparkles;

  const targetName = preset.label.replace(/[^a-zA-Z0-9]/g, "");

  const handleApply = () => {
    onConfirm(preset, {
      deletePreviousActions,
      updateName,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] sm:max-w-lg bg-background/95 backdrop-blur-xl border border-border/70 shadow-2xl p-0 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/50 bg-secondary/15">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2 truncate">
                Apply Preset: {preset.label}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {preset.desc}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Architecture & Render Mode Summary */}
          <div className="p-3 rounded-xl bg-secondary/25 border border-border/50 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Cpu size={12} /> Section Architecture
            </span>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2.5 py-1 font-mono font-medium flex items-center gap-1.5",
                  preset.renderMode === "client"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
                )}
              >
                <Shield size={12} />
                <span>{preset.renderMode === "client" ? "Client Component ('use client')" : "Server Component (RSC)"}</span>
              </Badge>

              <Badge variant="secondary" className="text-xs px-2.5 py-1 font-mono capitalize">
                Strategy: {preset.loadStrategy}
              </Badge>
            </div>
          </div>

          {/* 1. Packages to be Added */}
          <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Package size={13} className="text-primary" /> Packages to be Configured
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {preset.libraries.length} package{preset.libraries.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              These dependencies will be attached to the section and added to <code className="font-mono text-foreground/80">package.json</code>:
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {preset.libraries.map((lib) => {
                const isAlreadyPresent = currentLibraries.includes(lib);
                return (
                  <div
                    key={lib}
                    className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md bg-background/80 border border-border/60 shadow-2xs"
                  >
                    <span className="text-foreground font-medium">{lib}</span>
                    {isAlreadyPresent ? (
                      <span className="text-[9px] text-emerald-500 font-sans flex items-center gap-0.5">
                        <Check size={10} /> already attached
                      </span>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/30 font-sans font-normal"
                      >
                        <Plus size={8} className="mr-0.5" /> new
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Actions to be Generated */}
          <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Zap size={13} className="text-amber-400" /> Actions to be Generated
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {preset.defaultActions.length} action{preset.defaultActions.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Interactive triggers that connect UI events to handlers or backend endpoints:
            </p>

            <div className="space-y-1.5 pt-1">
              {preset.defaultActions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-background/70 border border-border/50 text-xs"
                >
                  <span className="font-mono font-medium text-foreground">
                    {action.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0.5 capitalize">
                    {action.event}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Checkbox Options */}
          <div className="space-y-2.5 pt-1">
            {/* Delete Previous Actions Checkbox */}
            <div
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer",
                deletePreviousActions
                  ? "bg-destructive/10 border-destructive/30"
                  : "bg-secondary/25 border-border/50 hover:bg-secondary/40"
              )}
              onClick={() => {
                if (existingActionsCount > 0) {
                  setDeletePreviousActions(!deletePreviousActions);
                }
              }}
            >
              <Checkbox
                id="delete-previous-actions"
                checked={deletePreviousActions}
                disabled={existingActionsCount === 0}
                onCheckedChange={(checked) => setDeletePreviousActions(!!checked)}
                className="mt-0.5"
              />
              <div className="space-y-1 select-none flex-1 min-w-0">
                <Label
                  htmlFor="delete-previous-actions"
                  className={cn(
                    "text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer",
                    existingActionsCount === 0 && "text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <Trash2 size={12} className={deletePreviousActions ? "text-destructive" : "text-muted-foreground"} />
                    Delete previous actions
                  </span>
                  {existingActionsCount > 0 && (
                    <Badge
                      variant={deletePreviousActions ? "destructive" : "secondary"}
                      className="text-[10px] font-mono"
                    >
                      {existingActionsCount} existing
                    </Badge>
                  )}
                </Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {existingActionsCount === 0 ? (
                    "No existing actions in this section. Preset actions will be created fresh."
                  ) : deletePreviousActions ? (
                    <span className="text-destructive">
                      All {existingActionsCount} existing action(s) and their canvas connections will be deleted and replaced with preset actions.
                    </span>
                  ) : (
                    `Keep ${existingActionsCount} existing action(s) and merge them with the ${preset.defaultActions.length} preset action(s).`
                  )}
                </p>
              </div>
            </div>

            {/* Update Section Name Checkbox */}
            <div
              className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-secondary/25 hover:bg-secondary/40 transition-colors cursor-pointer"
              onClick={() => setUpdateName(!updateName)}
            >
              <Checkbox
                id="update-section-name"
                checked={updateName}
                onCheckedChange={(checked) => setUpdateName(!!checked)}
                className="mt-0.5"
              />
              <div className="space-y-1 select-none flex-1 min-w-0">
                <Label
                  htmlFor="update-section-name"
                  className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  Update section name to "{targetName}"
                </Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {updateName ? (
                    <span>
                      Renames section from <span className="font-mono text-foreground">{currentSectionName || "Section"}</span> to <span className="font-mono text-primary font-medium">{targetName}</span>.
                    </span>
                  ) : (
                    <span>Keep current name (<span className="font-mono text-foreground">{currentSectionName || "Section"}</span>).</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/50 bg-secondary/15 flex items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="text-xs font-medium cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles size={13} />
            <span>Apply Preset</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
