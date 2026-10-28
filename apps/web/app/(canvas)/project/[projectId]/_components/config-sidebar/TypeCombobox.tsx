"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import { Button } from "@workspace/ui/components/button";
import {
  useAvailableCanvasTypes,
  AvailableTypeItem,
} from "@/lib/hooks/useAvailableCanvasTypes";
import type { BackendNode } from "@/types/canvas";
import { Braces, Package, Code2, Database, Plus } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

export interface TypeComboboxProps {
  value: string;
  onValueChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
  allNodes?: BackendNode[];
  includeDatabaseTables?: boolean;
  excludeTypeName?: string;
  extraTypes?: AvailableTypeItem[];
  placeholder?: string;
}

/**
 * Searchable Combobox using the official @workspace/ui Combobox (Base UI) pattern
 * Supports predefined types as well as arbitrary custom & union expressions (e.g. Type1 | Type2).
 */
export const TypeCombobox: React.FC<TypeComboboxProps> = ({
  value,
  onValueChange,
  className,
  disabled = false,
  allNodes,
  includeDatabaseTables = false,
  excludeTypeName,
  extraTypes,
  placeholder = "Select type...",
}) => {
  const { allTypes } = useAvailableCanvasTypes(allNodes, {
    includeDatabaseTables,
    excludeTypeName,
    extraTypes,
  });

  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [value]);

  // Map for fast metadata lookup (category, kind, packageSource, sourceLabel)
  const typeMetaMap = useMemo(() => {
    return new Map(allTypes.map((t) => [t.name, t]));
  }, [allTypes]);

  // Ensure current value and any active custom query are included in items list
  const allTypeNames = useMemo(() => {
    const names = allTypes.map((t) => t.name);
    const result: string[] = [];

    const trimmedQuery = query.trim();
    if (trimmedQuery && !names.includes(trimmedQuery) && trimmedQuery !== value) {
      result.push(trimmedQuery);
    }

    if (value && !names.includes(value)) {
      result.push(value);
    }

    result.push(...names);
    return Array.from(new Set(result));
  }, [allTypes, value, query]);

  const handleSelect = (nextVal: string | null) => {
    if (typeof nextVal === "string" && nextVal.trim()) {
      onValueChange(nextVal.trim());
      setQuery("");
    }
  };

  return (
    <div className="relative nodrag" onClick={(e) => e.stopPropagation()}>
      <Combobox
        items={allTypeNames}
        value={value || "string"}
        onValueChange={handleSelect}
        inputValue={query}
        onInputValueChange={setQuery}
      >
        <ComboboxInput
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              handleSelect(query.trim());
            }
          }}
          className={cn(
            "h-7 w-[140px] text-xs font-mono nodrag bg-secondary/50 border-none shadow-none focus-visible:ring-1",
            className,
          )}
        />
        <ComboboxContent
          className="w-[280px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
          align="start"
          sideOffset={4}
        >
          <ComboboxEmpty className="py-3 px-2 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
            <span>No matching preset types.</span>
            {query.trim() && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-6 text-[10px] font-mono gap-1 rounded-full px-2.5 cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                onClick={() => handleSelect(query.trim())}
              >
                <Plus size={11} /> Use custom &quot;{query.trim()}&quot;
              </Button>
            )}
          </ComboboxEmpty>
          <ComboboxList className="max-h-72 overflow-y-auto no-scrollbar p-1 bg-popover text-popover-foreground hide-scrollbar">
            {(typeName: string) => {
              const meta = typeMetaMap.get(typeName);
              const isCustom = meta?.category === "custom";
              const isPackage = meta?.category === "package";
              const isDatabase = meta?.category === "database";
              const isPrimitive = meta?.category === "primitive";
              const isCustomUserTyped = !meta && typeName !== "enum";
              const displayLabel = isDatabase ? (meta?.sourceLabel || typeName) : typeName;

              return (
                <ComboboxItem
                  key={typeName}
                  value={typeName}
                  className="flex items-center justify-between py-1.5 px-2 text-xs font-mono cursor-pointer rounded-md"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isDatabase && (
                      <Database className="size-3 text-amber-500 dark:text-amber-400 shrink-0" />
                    )}
                    {isCustom && (
                      <Braces className="size-3 text-indigo-400 shrink-0" />
                    )}
                    {isPackage && (
                      <Package className="size-3 text-emerald-400 shrink-0" />
                    )}
                    {isPrimitive && (
                      <Code2 className="size-3 text-muted-foreground/70 shrink-0" />
                    )}
                    {isCustomUserTyped && (
                      <Plus className="size-3 text-primary shrink-0" />
                    )}
                    <span className="truncate font-medium">{displayLabel}</span>

                    {/* Metadata tags */}
                    {isDatabase && (
                      <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                        entity
                      </span>
                    )}
                    {isCustom && meta?.kind && (
                      <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-400 shrink-0">
                        {meta.kind}
                      </span>
                    )}
                    {isPackage && meta?.packageSource && (
                      <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 max-w-[90px] truncate">
                        {meta.packageSource}
                      </span>
                    )}
                    {typeName === "enum" && (
                      <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 shrink-0">
                        fixed values
                      </span>
                    )}
                    {isCustomUserTyped && (
                      <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-primary/10 text-primary font-bold shrink-0">
                        custom
                      </span>
                    )}
                  </div>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
};
