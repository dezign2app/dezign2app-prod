"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import { cn } from "@workspace/ui/lib/utils";
import { AvailablePath } from "./types";

export interface SmartPathInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestedPaths: AvailablePath[];
  placeholder?: string;
  sourceKindLabel?: string;
  rootVariableName?: string;
}

export const SmartPathInput: React.FC<SmartPathInputProps> = ({
  value,
  onChange,
  suggestedPaths,
  placeholder,
  sourceKindLabel,
  rootVariableName,
}) => {
  const [inputValue, setInputValue] = useState<string>(value || "");

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const displayPlaceholder =
    placeholder ||
    (rootVariableName ? `(whole ${rootVariableName})` : "path.to.field");

  const items = useMemo(() => {
    const set = new Set<string>();
    suggestedPaths.forEach((p) => {
      if (p.path) set.add(p.path);
    });
    if (rootVariableName) {
      set.add(`(whole ${rootVariableName})`);
    }
    if (value && value.trim()) {
      set.add(value.trim());
    }
    if (inputValue && inputValue.trim()) {
      set.add(inputValue.trim());
    }
    return Array.from(set);
  }, [suggestedPaths, rootVariableName, value, inputValue]);

  const filteredPaths = useMemo(() => {
    if (!inputValue.trim()) return suggestedPaths;
    const q = inputValue.toLowerCase().trim();
    return suggestedPaths.filter(
      (p) =>
        p.path.toLowerCase().includes(q) ||
        (p.type && p.type.toLowerCase().includes(q))
    );
  }, [suggestedPaths, inputValue]);

  const handleCommit = (raw: string) => {
    if (rootVariableName && raw === `(whole ${rootVariableName})`) {
      onChange("");
      setInputValue("");
      return;
    }
    onChange(raw);
    setInputValue(raw);
  };

  return (
    <div className="relative flex-1 min-w-0 nodrag" onClick={(e) => e.stopPropagation()}>
      <Combobox
        items={items}
        value={value || null}
        onValueChange={(selected) => {
          if (typeof selected === "string") {
            handleCommit(selected);
          }
        }}
        inputValue={inputValue}
        onInputValueChange={(text) => {
          setInputValue(text);
          onChange(text);
        }}
      >
        <ComboboxInput
          placeholder={displayPlaceholder}
          className="h-7 w-full bg-background/70 border-border/60 text-xs font-mono nodrag"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCommit(inputValue);
            }
          }}
          onBlur={() => {
            handleCommit(inputValue);
          }}
        />
        <ComboboxContent
          className="w-[var(--anchor-width)] min-w-[220px] max-h-56 p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-lg z-[100] overflow-hidden"
          align="start"
          sideOffset={4}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 bg-muted/20">
            <span>{sourceKindLabel ? `Fields in ${sourceKindLabel}` : "Suggested Fields"}</span>
          </div>

          {filteredPaths.length === 0 && !rootVariableName ? (
            <ComboboxEmpty className="py-2.5 px-3 text-xs text-muted-foreground text-center">
              No matching fields
            </ComboboxEmpty>
          ) : (
            <ComboboxList className="p-1 max-h-48 overflow-y-auto">
              {filteredPaths.map((p) => (
                <ComboboxItem
                  key={p.path}
                  value={p.path}
                  className="py-1 px-2 text-xs font-mono cursor-pointer rounded-md hover:bg-accent flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{p.path}</span>
                  {p.type && (
                    <span className="text-[9px] text-muted-foreground/60 px-1 py-0.2 rounded bg-muted/40 font-sans shrink-0 ml-1">
                      {p.type}
                    </span>
                  )}
                </ComboboxItem>
              ))}

              {filteredPaths.length > 0 && (
                <div className="border-t border-border/40 my-1" />
              )}

              <ComboboxItem
                value={`(whole ${rootVariableName || "object"})`}
                className="py-1 px-2 text-xs font-mono cursor-pointer rounded-md hover:bg-accent flex items-center justify-between transition-colors"
              >
                <span className="italic text-[11px] text-foreground/80">
                  (whole {rootVariableName || "object"})
                </span>
                <span className="text-[9px] text-muted-foreground/60 px-1 py-0.2 rounded bg-muted/40 font-sans shrink-0 ml-1">
                  object
                </span>
              </ComboboxItem>
            </ComboboxList>
          )}
        </ComboboxContent>
      </Combobox>
    </div>
  );
};
