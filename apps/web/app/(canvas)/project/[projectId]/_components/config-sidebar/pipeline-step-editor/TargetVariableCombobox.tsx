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
import { PriorVariableInfo } from "./source-paths/variableSources";
import { toVarName } from "@/lib/compiler/utils";
import { cn } from "@workspace/ui/lib/utils";
import { Variable, Brackets, Layers } from "lucide-react";

export interface TargetVariableComboboxProps {
  value: string;
  onSelect: (varName: string, varInfo?: PriorVariableInfo) => void;
  priorVariables: PriorVariableInfo[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const TargetVariableCombobox: React.FC<TargetVariableComboboxProps> = ({
  value,
  onSelect,
  priorVariables,
  placeholder = "Select variable from prior steps...",
  disabled = false,
  className,
}) => {
  const [inputValue, setInputValue] = useState<string>(value || "");

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const items = useMemo(() => {
    return priorVariables.map((v) => v.name);
  }, [priorVariables]);

  const filteredVariables = useMemo(() => {
    if (!inputValue.trim()) return priorVariables;
    const query = inputValue.toLowerCase().trim();
    return priorVariables.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        (v.stepName && v.stepName.toLowerCase().includes(query)) ||
        (v.dataType && v.dataType.toLowerCase().includes(query)),
    );
  }, [priorVariables, inputValue]);

  const handleCommit = (rawName: string) => {
    const clean = toVarName(rawName.trim());
    if (!clean) return;
    const matched = priorVariables.find((v) => v.name === clean);
    onSelect(clean, matched);
    setInputValue(clean);
  };

  return (
    <div className="relative w-full nodrag" onClick={(e) => e.stopPropagation()}>
      <Combobox
        items={items}
        value={value || null}
        onValueChange={(selected) => {
          if (typeof selected === "string" && selected.trim()) {
            handleCommit(selected);
          }
        }}
        inputValue={inputValue}
        onInputValueChange={(text) => {
          setInputValue(text);
        }}
      >
        <ComboboxInput
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "h-7 w-full bg-background/60 border-border/60 text-xs font-mono nodrag",
            className,
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputValue.trim()) {
              e.preventDefault();
              handleCommit(inputValue);
            }
          }}
          onBlur={() => {
            if (inputValue.trim()) {
              handleCommit(inputValue);
            }
          }}
        />
        <ComboboxContent
          className="w-[320px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-lg z-50 overflow-hidden"
          align="start"
          sideOffset={4}
        >
          {priorVariables.length === 0 ? (
            <ComboboxEmpty className="py-3 px-3 text-xs text-muted-foreground text-center">
              No variables declared in prior steps. Declare a variable or add an operation step above.
            </ComboboxEmpty>
          ) : (
            <>
              <ComboboxEmpty className="py-2.5 px-3 text-xs text-muted-foreground text-center">
                No matching variable found
              </ComboboxEmpty>
              <ComboboxList className="p-1 max-h-56 overflow-y-auto">
                {filteredVariables.map((v) => (
                  <ComboboxItem
                    key={v.name}
                    value={v.name}
                    className="py-1.5 px-2 text-xs font-mono cursor-pointer rounded-md hover:bg-accent flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {v.isArray ? (
                        <Brackets size={12} className="text-purple-400 shrink-0" />
                      ) : v.isObject ? (
                        <Layers size={12} className="text-emerald-400 shrink-0" />
                      ) : (
                        <Variable size={12} className="text-blue-400 shrink-0" />
                      )}
                      <span className="font-semibold text-foreground truncate">
                        {v.name}
                      </span>
                      <span
                        className={cn(
                          "px-1 py-0.2 rounded text-[9px] font-mono shrink-0",
                          v.isMutable
                            ? "bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium"
                            : "bg-muted text-muted-foreground/80 border border-border/60",
                        )}
                      >
                        {v.declarationKind}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        ({v.dataType})
                      </span>
                    </div>
                    {v.stepName && (
                      <span className="text-[9px] text-muted-foreground/60 shrink-0 truncate max-w-[90px]">
                        {v.stepName}
                      </span>
                    )}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </>
          )}
        </ComboboxContent>
      </Combobox>
    </div>
  );
};
