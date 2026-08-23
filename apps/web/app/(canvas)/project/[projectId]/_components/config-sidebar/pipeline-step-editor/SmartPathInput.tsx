"use client";

import React, { useState } from "react";
import { Input } from "@workspace/ui/components/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@workspace/ui/components/popover";
import { ChevronDown } from "lucide-react";
import { AvailablePath } from "./types";

export interface SmartPathInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestedPaths: AvailablePath[];
  placeholder?: string;
  sourceKindLabel?: string;
  rootVariableName?: string;
}

export const SmartPathInput = ({
  value,
  onChange,
  suggestedPaths,
  placeholder,
  sourceKindLabel,
  rootVariableName,
}: SmartPathInputProps) => {
  const [open, setOpen] = useState(false);

  const displayPlaceholder =
    placeholder ||
    (rootVariableName ? `(whole ${rootVariableName})` : "path.to.field");

  return (
    <div className="flex-1 min-w-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex items-center w-full">
            <Input
              className="h-7 text-xs font-mono bg-background/70 border-border/60 pr-6 w-full"
              placeholder={displayPlaceholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setOpen(true)}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1.5 text-muted-foreground/60 hover:text-foreground p-0.5 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              title="Choose from suggested paths or whole object"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="p-1 w-[var(--radix-popover-trigger-width)] min-w-[220px] max-h-56 overflow-y-auto z-[100] bg-popover border border-border rounded-md shadow-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 mb-1">
            <span>{sourceKindLabel ? `Fields in ${sourceKindLabel}` : "Suggested Fields"}</span>
          </div>

          {suggestedPaths.map((p) => (
            <button
              key={p.path}
              type="button"
              className="w-full text-left px-2 py-1 text-xs font-mono rounded hover:bg-accent text-foreground flex items-center justify-between transition-colors"
              onClick={() => {
                onChange(p.path);
                setOpen(false);
              }}
            >
              <span className="truncate">{p.path}</span>
              {p.type && (
                <span className="text-[9px] text-muted-foreground/60 px-1 py-0.2 rounded bg-muted/40 font-sans shrink-0 ml-1">
                  {p.type}
                </span>
              )}
            </button>
          ))}

          {suggestedPaths.length > 0 && (
            <div className="border-t border-border/40 my-1" />
          )}

          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-xs font-mono rounded hover:bg-accent text-foreground flex items-center justify-between transition-colors"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <span className="italic text-[11px] text-foreground/80">
              (whole {rootVariableName || "object"})
            </span>
            <span className="text-[9px] text-primary/90 font-mono bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              {rootVariableName || "body"}
            </span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
};
