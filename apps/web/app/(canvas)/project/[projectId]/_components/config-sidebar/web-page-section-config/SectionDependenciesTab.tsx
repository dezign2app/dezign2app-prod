"use client";

import React, { useState } from "react";
import {
  Package,
  Plus,
  Trash,
  Check,
  Sparkles,
} from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";

export interface SectionDependenciesTabProps {
  libraries: string[];
  availablePackages?: { name: string; version?: string; isDev?: boolean }[];
  onAddLibrary: (lib: string) => void;
  onRemoveLibrary: (lib: string) => void;
}

export const SectionDependenciesTab: React.FC<SectionDependenciesTabProps> = ({
  libraries,
  availablePackages = [],
  onAddLibrary,
  onRemoveLibrary,
}) => {
  const [newLibInput, setNewLibInput] = useState("");

  const handleAdd = () => {
    if (!newLibInput.trim()) return;
    onAddLibrary(newLibInput.trim());
    setNewLibInput("");
  };

  return (
    <div className="flex-1 p-4 space-y-5 overflow-y-auto m-0 outline-none">
      <div className="space-y-1">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Package size={13} className="text-muted-foreground" /> Section Dependencies
        </span>
        <p className="text-[11px] text-muted-foreground">
          Select packages for this section. They are automatically added to <code className="font-mono text-foreground/80">package.json</code> for the application.
        </p>
      </div>

      {/* 1. Available Packages from Parent Web App (NodePackageManager) */}
      {availablePackages.length > 0 && (
        <div className="space-y-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Sparkles size={12} /> Installed in Web App
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {availablePackages.length} package(s)
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {availablePackages.map((pkg) => {
              const isAttached = libraries.includes(pkg.name);
              return (
                <button
                  key={pkg.name}
                  type="button"
                  onClick={() => (isAttached ? onRemoveLibrary(pkg.name) : onAddLibrary(pkg.name))}
                  className={cn(
                    "text-[10.5px] px-2.5 py-1 rounded-md font-mono border transition-all cursor-pointer flex items-center gap-1.5",
                    isAttached
                      ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                      : "bg-background/80 hover:bg-primary/10 text-muted-foreground hover:text-foreground border-border/60"
                  )}
                  title={isAttached ? "Click to detach from section" : "Click to attach to section"}
                >
                  {isAttached ? <Check size={11} /> : <Plus size={11} className="opacity-60" />}
                  <span>{pkg.name}</span>
                  {pkg.version && (
                    <span className={cn("text-[9px] opacity-70", isAttached ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {pkg.version}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Configured Section Libraries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Package size={12} className="text-muted-foreground" /> Attached to Section ({libraries.length})
          </span>
        </div>

        {libraries.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-border/70 text-center text-xs text-muted-foreground italic bg-secondary/10">
            No packages declared for this section yet. Select an installed package above or enter a package name below.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {libraries.map((lib) => (
              <Badge
                key={lib}
                variant="secondary"
                className="font-mono text-xs px-2.5 py-1 flex items-center gap-1.5 bg-secondary/70 border border-border/60"
              >
                <span>{lib}</span>
                <button
                  type="button"
                  onClick={() => onRemoveLibrary(lib)}
                  className="hover:text-destructive cursor-pointer text-muted-foreground hover:opacity-100"
                  title={`Remove ${lib}`}
                >
                  <Trash size={11} />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add Custom Package Input */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newLibInput}
            onChange={(e) => setNewLibInput(e.target.value)}
            placeholder="Type package name..."
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
    </div>
  );
};
