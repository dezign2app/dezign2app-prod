"use client";

import React, { useState, useCallback } from "react";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Plus, Lock, X } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import type { EnumTypeEditorProps } from "./types";

export const EnumTypeEditor: React.FC<EnumTypeEditorProps> = ({
  currentType,
  inheritedEnumValues,
  onUpdateCurrentType,
}) => {
  const [newConstantInput, setNewConstantInput] = useState("");

  const handleAddConstant = useCallback(
    (valToAdd?: string) => {
      const raw = typeof valToAdd === "string" ? valToAdd : newConstantInput;
      if (!raw.trim()) return;

      const parts = raw
        .split(",")
        .map((p) => p.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);

      if (parts.length === 0) return;

      const currentValues = currentType.enumValues || [];
      const uniqueNew = parts.filter((p) => !currentValues.includes(p));
      if (uniqueNew.length > 0) {
        onUpdateCurrentType({ enumValues: [...currentValues, ...uniqueNew] });
      }
      setNewConstantInput("");
    },
    [newConstantInput, currentType.enumValues, onUpdateCurrentType],
  );

  const handleDeleteEnumValue = useCallback(
    (index: number) => {
      const currentValues = (currentType.enumValues || []).filter(
        (_, idx) => idx !== index,
      );
      onUpdateCurrentType({ enumValues: currentValues });
    },
    [currentType.enumValues, onUpdateCurrentType],
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Enum Constants ({(currentType.enumValues || []).length})
        </span>
        {currentType.isReadOnly && (
          <span className="text-[10px] font-mono font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            READ-ONLY PACKAGE ENUM
          </span>
        )}
        {Boolean(currentType.extendedFrom) && (
          <span className="text-[10px] font-mono font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            INHERITED · READ-ONLY
          </span>
        )}
      </div>

      {/* Allow adding new constants when extended too — inherited ones just can't be deleted */}
      {!currentType.isReadOnly && (
        <div className="flex items-center gap-2">
          <Input
            className="h-8 text-xs flex-1 nodrag bg-background font-mono border-border/70 focus-visible:ring-1 placeholder:font-sans placeholder:text-muted-foreground/60"
            placeholder="Type constant and press Enter (or comma-separated)..."
            value={newConstantInput}
            onChange={(e) => setNewConstantInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddConstant();
              }
            }}
          />
          <Button
            size="sm"
            className="h-8 text-xs font-semibold gap-1 px-3 cursor-pointer shrink-0"
            onClick={() => handleAddConstant()}
            disabled={!newConstantInput.trim()}
          >
            <Plus size={13} />
            <span>Add</span>
          </Button>
        </div>
      )}

      {/* Badges container below the input field */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 min-h-[36px]">
        {(currentType.enumValues || []).map((val, idx) => {
          const isInherited = inheritedEnumValues.includes(val);
          return (
            <span
              key={`${val}-${idx}`}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium transition-all shadow-2xs",
                isInherited
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-300 cursor-default"
                  : "bg-secondary/80 hover:bg-secondary border-border/60 text-foreground group/badge",
              )}
              title={isInherited ? `Inherited from ${currentType.extendedFrom}` : undefined}
            >
              {isInherited && <Lock size={9} className="shrink-0 text-purple-400" />}
              <span>{val}</span>
              {!currentType.isReadOnly && !isInherited && (
                <button
                  type="button"
                  onClick={() => handleDeleteEnumValue(idx)}
                  className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 p-0.5 rounded transition-colors cursor-pointer"
                  title={`Delete constant ${val}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          );
        })}

        {(currentType.enumValues || []).length === 0 && (
          <span className="text-xs text-muted-foreground/60 italic py-1">
            No constants added yet. Type a constant name above and press Enter.
          </span>
        )}
      </div>
    </div>
  );
};
