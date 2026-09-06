"use client";

import React, { useState } from "react";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Sparkles,
  Shield,
  Activity,
  Check,
  LayoutGrid,
  Table,
  FormInput,
  MessageSquare,
  BarChart3,
  Box,
  Package,
  Trash,
  type LucideIcon,
} from "lucide-react";
import { SECTION_PRESETS, SectionPreset, SectionIconName } from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { SectionPresetConfirmDialog } from "./SectionPresetConfirmDialog";

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

export interface SectionGeneralTabProps {
  name: string;
  renderMode: "server" | "client";
  loadStrategy: "eager" | "dynamic" | "dynamic-no-ssr";
  currentLibraries?: string[];
  existingActionsCount?: number;
  onUpdateName: (name: string) => void;
  onUpdateRenderMode: (renderMode: "server" | "client") => void;
  onUpdateLoadStrategy: (strategy: "eager" | "dynamic" | "dynamic-no-ssr") => void;
  onApplyPreset: (
    preset: SectionPreset,
    options?: {
      deletePreviousActions?: boolean;
      updateName?: boolean;
    }
  ) => void;
  onDelete?: () => void;
}

export const SectionGeneralTab: React.FC<SectionGeneralTabProps> = ({
  name,
  renderMode,
  loadStrategy,
  currentLibraries = [],
  existingActionsCount = 0,
  onUpdateName,
  onUpdateRenderMode,
  onUpdateLoadStrategy,
  onApplyPreset,
  onDelete,
}) => {
  const [confirmPreset, setConfirmPreset] = useState<SectionPreset | null>(null);

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto m-0 outline-none">
      {/* Section Name */}
      <div className="space-y-1.5 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Section Component Name</span>
          <span className="text-[10px] text-muted-foreground font-normal">
            PascalCase recommended
          </span>
        </Label>
        <Input
          value={name}
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder="e.g. HeroSection, MetricsGrid, InteractiveCanvas"
          className="h-8 text-xs font-mono bg-background/50 border-border/50"
        />
      </div>

      {/* Quick Preset Templates */}
      <div className="space-y-2 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles size={13} className="text-muted-foreground" /> Presets
          </span>
          <span className="text-[10px] text-muted-foreground">1-click template</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Quickly bootstrap section architecture, render mode, packages, and actions.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {SECTION_PRESETS.map((preset) => {
            const Icon: LucideIcon =
              (preset.iconName && PRESET_ICON_MAP[preset.iconName]) || LayoutGrid;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setConfirmPreset(preset)}
                className="p-2.5 rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary/70 hover:border-border text-left transition-all cursor-pointer flex flex-col gap-1 group"
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground group-hover:text-foreground transition-colors">
                  <Icon size={13} className="text-muted-foreground shrink-0" />
                  <span className="truncate">{preset.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                  {preset.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Mode Card Selector */}
      <div className="space-y-2 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <Label className="text-xs font-semibold text-foreground">Next.js Render Mode</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Server Component RSC */}
          <div
            onClick={() => onUpdateRenderMode("server")}
            className={cn(
              "p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5",
              renderMode === "server"
                ? "bg-secondary/70 border-border ring-1 ring-border/60 shadow-sm"
                : "bg-secondary/20 border-border/40 hover:bg-secondary/40",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Shield size={13} className="text-muted-foreground" /> Server (RSC)
              </span>
              {renderMode === "server" && <Check size={13} className="text-foreground" />}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Default React Server Component. Fast SSR rendering, zero client JS bundle, direct data access.
            </p>
          </div>

          {/* Client Component */}
          <div
            onClick={() => onUpdateRenderMode("client")}
            className={cn(
              "p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5",
              renderMode === "client"
                ? "bg-secondary/70 border-border ring-1 ring-border/60 shadow-sm"
                : "bg-secondary/20 border-border/40 hover:bg-secondary/40",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Activity size={13} className="text-muted-foreground" /> Client Component
              </span>
              {renderMode === "client" && <Check size={13} className="text-foreground" />}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Appends <code className="font-mono text-foreground/80">&apos;use client&apos;</code>. Required for React state and interactive DOM handlers.
            </p>
          </div>
        </div>
      </div>

      {/* Component Load Strategy */}
      <div className="space-y-2 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <Label className="text-xs font-semibold text-foreground">Component Load Strategy</Label>
        <div className="space-y-2">
          {[
            {
              id: "eager" as const,
              title: "Eager (Static Import)",
              badge: "Default",
              desc: "Standard top-level import statement compiled into the main page module.",
            },
            {
              id: "dynamic" as const,
              title: "Dynamic Import (Code Split)",
              badge: "next/dynamic",
              desc: "Asynchronously splits this component into a separate bundle loaded on demand.",
            },
            {
              id: "dynamic-no-ssr" as const,
              title: "Dynamic (No SSR - ssr: false)",
              badge: "Client Only",
              desc: "Client-only dynamic execution. Mandatory for browser DOM/Canvas libraries (xyflow, tldraw, three.js).",
            },
          ].map((strat) => {
            const isSelected = loadStrategy === strat.id;
            return (
              <div
                key={strat.id}
                onClick={() => onUpdateLoadStrategy(strat.id)}
                className={cn(
                  "p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-3",
                  isSelected
                    ? "bg-secondary/70 border-border ring-1 ring-border/60 shadow-sm"
                    : "bg-secondary/20 border-border/40 hover:bg-secondary/40",
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {strat.title}
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono py-0 border-border/60">
                      {strat.badge}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{strat.desc}</span>
                </div>

                {isSelected && <Check size={14} className="text-foreground shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Danger Zone: Delete Section */}
      {onDelete && (
        <div className="space-y-2 p-3.5 rounded-xl border border-destructive/30 bg-destructive/5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-destructive">Danger Zone</span>
              <span className="text-[10px] text-muted-foreground">
                Permanently delete this section and all associated actions.
              </span>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="h-7 text-xs font-medium gap-1.5"
            >
              <Trash size={12} />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      )}

      {/* Preset Confirmation Dialog */}
      <SectionPresetConfirmDialog
        open={confirmPreset !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmPreset(null);
        }}
        preset={confirmPreset}
        currentSectionName={name}
        currentLibraries={currentLibraries}
        existingActionsCount={existingActionsCount}
        onConfirm={(preset, options) => {
          onApplyPreset(preset, options);
          setConfirmPreset(null);
        }}
      />
    </div>
  );
};
