"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { TypeCombobox } from "../TypeCombobox";
import { Plus, Trash, Text, X } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { useBufferedInput } from "@/lib/hooks/useBufferedInput";
import type { TypePropertyRowProps } from "./types";

export const TypePropertyRow = React.memo(
  ({
    field,
    otherCustomTypes,
    readOnly,
    isSelected = false,
    onSelect,
    onUpdate,
    onDelete,
  }: TypePropertyRowProps) => {
    const nameBuffer = useBufferedInput(
      field.name || "",
      useCallback((name: string) => onUpdate({ name }), [onUpdate]),
      200,
    );

    const descBuffer = useBufferedInput(
      field.description || "",
      useCallback(
        (description: string) => onUpdate({ description }),
        [onUpdate],
      ),
      200,
    );

    const [enumInput, setEnumInput] = useState("");

    const isFieldArray = Boolean(
      field.isArray || field.type?.endsWith("[]"),
    );
    const baseType = (field.type || "string").replace(/\[\]$/, "").trim();

    // Parse union parts: e.g. "Type1 | Type2 | null"
    const unionParts = useMemo(() => {
      const unparenthesized = baseType.startsWith("(") && baseType.endsWith(")")
        ? baseType.slice(1, -1)
        : baseType;
      const parts = unparenthesized.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
      return parts.length > 0 ? parts : [baseType || "string"];
    }, [baseType]);

    const toggleArray = () => {
      if (readOnly) return;
      if (isFieldArray) {
        onUpdate({ type: baseType, isArray: false });
      } else {
        const needsParens = unionParts.length > 1 && !baseType.startsWith("(");
        onUpdate({ type: needsParens ? `(${baseType})[]` : `${baseType}[]`, isArray: true });
      }
    };

    const handleSingleTypeChange = (selectedBase: string) => {
      if (readOnly) return;
      const cleanBase = selectedBase.replace(/\[\]$/, "").trim();
      const newType = isFieldArray ? `${cleanBase}[]` : cleanBase;
      onUpdate({
        type: newType,
        isArray: isFieldArray,
        ...(cleanBase === "enum" && (!field.enumValues || field.enumValues.length === 0)
          ? { enumValues: [] }
          : {}),
      });
    };

    const handleUnionPartChange = (idx: number, newPart: string) => {
      if (readOnly) return;
      const nextParts = [...unionParts];
      nextParts[idx] = newPart.trim();
      const joined = nextParts.join(" | ");
      onUpdate({
        type: isFieldArray ? `(${joined})[]` : joined,
        isArray: isFieldArray,
      });
    };

    const handleRemoveUnionPart = (idx: number) => {
      if (readOnly) return;
      const nextParts = unionParts.filter((_, i) => i !== idx);
      const joined = nextParts.join(" | ");
      const finalType = isFieldArray
        ? nextParts.length > 1
          ? `(${joined})[]`
          : `${joined}[]`
        : joined;
      onUpdate({
        type: finalType,
        isArray: isFieldArray,
      });
    };

    const handleAddUnionPart = () => {
      if (readOnly) return;
      const fallback = "string";
      const nextParts = [...unionParts, fallback];
      const joined = nextParts.join(" | ");
      onUpdate({
        type: isFieldArray ? `(${joined})[]` : joined,
        isArray: isFieldArray,
      });
    };

    const handleAddEnumValue = useCallback(
      (raw?: string) => {
        const input = typeof raw === "string" ? raw : enumInput;
        if (!input.trim()) return;
        const parts = input
          .split(",")
          .map((p) => p.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
        if (parts.length === 0) return;
        const currentValues = field.enumValues || [];
        const uniqueNew = parts.filter((p) => !currentValues.includes(p));
        if (uniqueNew.length > 0) {
          onUpdate({ enumValues: [...currentValues, ...uniqueNew] });
        }
        setEnumInput("");
      },
      [enumInput, field.enumValues, onUpdate],
    );

    const handleDeleteEnumValue = useCallback(
      (idx: number) => {
        const updated = (field.enumValues || []).filter((_, i) => i !== idx);
        onUpdate({ enumValues: updated });
      },
      [field.enumValues, onUpdate],
    );

    return (
      <div
        className={cn(
          "flex flex-col gap-2 rounded-lg border bg-background/50 p-2.5 relative group/param transition-all cursor-pointer",
          isSelected
            ? "border-primary/70 ring-2 ring-primary/25 bg-background shadow-sm"
            : "hover:border-primary/30 hover:shadow-sm",
        )}
        onClick={onSelect}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Property Name Input */}
          {readOnly ? (
            <span className="h-7 text-xs font-mono font-semibold flex items-center px-1 text-foreground min-w-[80px]">
              {field.name || "(unnamed)"}
            </span>
          ) : (
            <Input
              className="h-7 text-xs w-[130px] shrink-0 nodrag bg-background font-mono border-none shadow-none focus-visible:ring-1 placeholder:font-sans placeholder:text-muted-foreground/50"
              placeholder="property name"
              value={nameBuffer.value}
              onChange={(e) => nameBuffer.onChange(e.target.value)}
              onBlur={nameBuffer.flush}
            />
          )}

          {/* Type Selectors: Handles single type or multi-part union */}
          {readOnly ? (
            <span className="h-7 px-2.5 flex items-center text-xs font-mono bg-secondary/50 rounded text-foreground font-medium">
              {field.type}
            </span>
          ) : unionParts.length <= 1 ? (
            /* Single type combobox */
            <TypeCombobox
              value={baseType}
              onValueChange={handleSingleTypeChange}
              className="w-[140px]"
            />
          ) : (
            /* Multi-part union selectors connected by | */
            <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
              {unionParts.map((part, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-secondary/30 rounded-md p-0.5 border border-border/40">
                  {idx > 0 && (
                    <span className="font-mono text-xs font-bold text-primary px-0.5 select-none">
                      |
                    </span>
                  )}
                  <TypeCombobox
                    value={part}
                    onValueChange={(val) => handleUnionPartChange(idx, val)}
                    className="w-[120px] h-6 text-[11px]"
                  />
                  {unionParts.length > 1 && !readOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveUnionPart(idx);
                      }}
                      className="text-muted-foreground/50 hover:text-destructive p-0.5 rounded cursor-pointer transition-colors"
                      title="Remove this union type"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title="Add another type to this union"
                  className="h-6 px-1.5 font-mono text-[11px] font-bold rounded-full bg-secondary/60 text-primary hover:bg-primary/20 border border-border/40 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddUnionPart();
                  }}
                >
                  + |
                </Button>
              )}
            </div>
          )}

          {/* Inline Union | button (available when not already a multi-union) */}
          {!readOnly && unionParts.length <= 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Add union type (|) to this property"
              className="h-7 px-2 font-mono text-xs font-bold nodrag rounded-full transition-all cursor-pointer bg-secondary/60 text-muted-foreground/80 hover:bg-primary/20 hover:text-primary border border-border/40"
              onClick={(e) => {
                e.stopPropagation();
                handleAddUnionPart();
              }}
            >
              |
            </Button>
          )}

          {/* Array [] toggle button */}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={
                isFieldArray
                  ? "Array type active (click to make single)"
                  : "Single type (click to make array [])"
              }
              className={cn(
                "h-7 px-2.5 font-mono text-xs font-bold nodrag rounded-full transition-all cursor-pointer",
                isFieldArray
                  ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 ring-1 ring-primary/30"
                  : "bg-secondary/60 text-muted-foreground/80 hover:bg-secondary hover:text-foreground border border-border/40",
              )}
              onClick={(e) => {
                e.stopPropagation();
                toggleArray();
              }}
            >
              []
            </Button>
          )}

          {/* Optional ? toggle button */}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={
                field.required === false
                  ? "Optional (?) active"
                  : "Required (click to make optional ?)"
              }
              className={cn(
                "h-7 px-2 font-mono text-xs font-bold nodrag rounded-full transition-all cursor-pointer",
                field.required === false
                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/40 shadow-xs"
                  : "bg-secondary/60 text-muted-foreground/80 hover:bg-secondary hover:text-foreground border border-border/40",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ required: field.required === false ? true : false });
              }}
            >
              ?
            </Button>
          )}

          {/* Add Description toggle button */}
          {!readOnly && field.description === undefined && (
            <Button
              size="icon"
              variant="ghost"
              title="Add Description"
              className="h-7 w-7 opacity-0 group-hover/param:opacity-100 text-muted-foreground hover:bg-secondary shrink-0 transition-all rounded-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ description: "" });
              }}
            >
              <Text size={14} />
            </Button>
          )}

          {/* Delete Field button */}
          {!readOnly && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover/param:opacity-100 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all rounded-full cursor-pointer ml-auto"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash size={14} />
            </Button>
          )}
        </div>

        {/* Inline enum values editor — badge style */}
        {baseType === "enum" && (
          <div className="flex flex-col gap-1.5 px-1 py-1.5 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider pl-1">
              Values:
            </span>
            {readOnly ? (
              <div className="flex flex-wrap gap-1 px-1">
                {(field.enumValues || []).map((v, idx) => (
                  <span
                    key={`${v}-${idx}`}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-secondary/70 border border-border/50 text-[11px] font-mono text-foreground"
                  >
                    {v}
                  </span>
                ))}
                {(field.enumValues || []).length === 0 && (
                  <span className="text-xs text-muted-foreground/60 italic">empty</span>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <Input
                    className="h-6 text-xs flex-1 nodrag bg-background/90 font-mono border-purple-500/30 text-foreground placeholder:text-muted-foreground/50 placeholder:font-sans focus-visible:ring-purple-500/30"
                    placeholder="Add value, press Enter..."
                    value={enumInput}
                    onChange={(e) => setEnumInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddEnumValue();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-6 w-6 shrink-0 cursor-pointer"
                    disabled={!enumInput.trim()}
                    onClick={() => handleAddEnumValue()}
                  >
                    <Plus size={12} />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1 px-0.5 min-h-[24px]">
                  {(field.enumValues || []).map((v, idx) => (
                    <span
                      key={`${v}-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/80 hover:bg-secondary border border-border/60 text-[11px] font-mono font-medium text-foreground transition-all"
                    >
                      <span>{v}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteEnumValue(idx)}
                        className="text-muted-foreground/60 hover:text-destructive p-0.5 rounded transition-colors cursor-pointer"
                        title={`Remove "${v}"`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {(field.enumValues || []).length === 0 && (
                    <span className="text-[10px] text-muted-foreground/50 italic">
                      No values yet.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Description row */}
        {field.description !== undefined && (
          <div className="relative w-full">
            {readOnly ? (
              <span className="text-[10px] pl-2 text-muted-foreground italic">
                {field.description}
              </span>
            ) : (
              <>
                <Input
                  className="h-6 text-[10px] pl-2.5 pr-6 w-full nodrag bg-transparent border-none shadow-none text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:bg-secondary/30 rounded"
                  placeholder="Add a description..."
                  value={descBuffer.value}
                  onChange={(e) => descBuffer.onChange(e.target.value)}
                  onBlur={descBuffer.flush}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 absolute right-0.5 top-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-all rounded"
                  onClick={() => onUpdate({ description: undefined })}
                >
                  <Trash size={10} />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    );
  },
);
TypePropertyRow.displayName = "TypePropertyRow";
