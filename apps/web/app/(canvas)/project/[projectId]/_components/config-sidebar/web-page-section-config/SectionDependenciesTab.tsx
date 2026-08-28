"use client";

import React, { useState } from "react";
import {
  Package,
  Plus,
  Trash,
  Info,
  Check,
  Sparkles,
  Table,
  Box,
  BarChart3,
  LayoutGrid,
  FormInput,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { CATEGORIZED_LIBRARIES, SectionIconName } from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";

const CAT_ICON_MAP: Record<SectionIconName, LucideIcon> = {
  "sparkles": Sparkles,
  "table": Table,
  "box": Box,
  "bar-chart-3": BarChart3,
  "package": Package,
  "layout-grid": LayoutGrid,
  "form-input": FormInput,
  "message-square": MessageSquare,
};

export interface SectionDependenciesTabProps {
  libraries: string[];
  onAddLibrary: (lib: string) => void;
  onRemoveLibrary: (lib: string) => void;
}

export const SectionDependenciesTab: React.FC<SectionDependenciesTabProps> = ({
  libraries,
  onAddLibrary,
  onRemoveLibrary,
}) => {
  const [newLibInput, setNewLibInput] = useState("");

  const handleAdd = () => {
    onAddLibrary(newLibInput);
    setNewLibInput("");
  };

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto m-0 outline-none">
      <div className="space-y-1">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Package size={13} className="text-muted-foreground" /> Third-Party Dependencies
        </span>
        <p className="text-[11px] text-muted-foreground">
          Declared packages are automatically compiled into <code className="font-mono text-foreground/80">package.json</code> and imported into this component.
        </p>
      </div>

      {/* Current Added Libraries Box */}
      <div className="space-y-2 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            Configured Section Packages
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {libraries.length} added
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg bg-background/50 border border-border/40">
          {libraries.length === 0 ? (
            <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
              <Info size={11} /> No custom packages declared. Add packages below.
            </span>
          ) : (
            libraries.map((lib) => (
              <Badge
                key={lib}
                variant="outline"
                className="text-[11px] py-0.5 px-2 gap-1.5 bg-secondary/70 text-foreground border-border/60 font-mono"
              >
                <Package size={10} className="text-muted-foreground" />
                <span>{lib}</span>
                <button
                  type="button"
                  onClick={() => onRemoveLibrary(lib)}
                  className="hover:text-destructive cursor-pointer ml-0.5 text-muted-foreground"
                >
                  <Trash size={11} />
                </button>
              </Badge>
            ))
          )}
        </div>

        {/* Add Custom Package Input */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newLibInput}
            onChange={(e) => setNewLibInput(e.target.value)}
            placeholder="Type package name (e.g. framer-motion, @xyflow/react)"
            className="h-8 text-xs font-mono bg-background/50 border-border/50"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs shrink-0 font-medium"
            onClick={handleAdd}
          >
            <Plus size={12} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Categorized Package Suggestions */}
      <div className="space-y-2.5">
        <span className="text-xs font-semibold text-foreground">
          Popular Curated Libraries
        </span>

        {CATEGORIZED_LIBRARIES.map((cat) => {
          const CatIcon: LucideIcon =
            (cat.iconName && CAT_ICON_MAP[cat.iconName]) || Package;
          return (
            <div
              key={cat.category}
              className="space-y-1.5 p-2.5 rounded-lg bg-secondary/15 border border-border/40"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <CatIcon size={12} className="text-muted-foreground" />
                <span>{cat.category}</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {cat.libs.map((lib) => {
                  const isAdded = libraries.includes(lib);
                  return (
                    <button
                      key={lib}
                      type="button"
                      onClick={() => (isAdded ? onRemoveLibrary(lib) : onAddLibrary(lib))}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded-md font-mono border transition-all cursor-pointer flex items-center gap-1",
                        isAdded
                          ? "bg-secondary text-foreground border-border font-medium shadow-sm"
                          : "bg-secondary/30 hover:bg-secondary/70 text-muted-foreground hover:text-foreground border-border/40",
                      )}
                    >
                      {isAdded ? (
                        <>
                          <Check size={10} className="text-foreground" /> {lib}
                        </>
                      ) : (
                        <>+ {lib}</>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
