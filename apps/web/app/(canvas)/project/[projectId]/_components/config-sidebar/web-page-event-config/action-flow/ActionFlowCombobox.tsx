"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@workspace/ui/components/popover";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

export interface ComboboxOption {
  value: string;
  label?: string;
  type?: string;
  description?: string;
}

export interface ActionFlowComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | ComboboxOption)[];
  placeholder?: string;
  headerLabel?: string;
  disabled?: boolean;
  className?: string;
  rootOptionLabel?: string;
}

export const ActionFlowCombobox: React.FC<ActionFlowComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder,
  headerLabel,
  disabled = false,
  className,
  rootOptionLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value || "");
    }
  }, [value]);

  const normalizedOptions: ComboboxOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt,
    );
  }, [options]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    onChange(val);
  };

  const handleSelect = (val: string) => {
    setLocalValue(val);
    onChange(val);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center w-full min-w-0">
      <Popover open={open} onOpenChange={(val) => !disabled && setOpen(val)}>
        <PopoverTrigger asChild>
          <div className="relative flex items-center w-full">
            <input
              type="text"
              value={localValue}
              onChange={handleInputChange}
              onFocus={() => {
                isFocusedRef.current = true;
                if (!disabled) setOpen(true);
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "h-7 text-xs font-mono bg-background/80 border border-border/60 rounded-md px-2.5 pr-6 w-full focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors",
                disabled && "opacity-50 cursor-not-allowed",
                className,
              )}
            />
            <button
              type="button"
              disabled={disabled}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-0.5 rounded transition-colors disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) setOpen((prev) => !prev);
              }}
              title="Choose from suggestions"
            >
              <ChevronDown
                size={12}
                className={cn(
                  "transition-transform duration-150",
                  open && "rotate-180",
                )}
              />
            </button>
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="p-1 w-[var(--radix-popover-trigger-width)] min-w-[220px] max-h-56 overflow-y-auto z-[100] bg-popover border border-border rounded-md shadow-lg hide-scrollbar"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {headerLabel && (
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 mb-1">
              <span>{headerLabel}</span>
            </div>
          )}

          {normalizedOptions.length === 0 ? (
            <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
              No suggestions available
            </div>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = localValue === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "w-full text-left px-2 py-1 text-xs font-mono rounded hover:bg-accent text-foreground flex items-center justify-between transition-colors",
                    isSelected && "bg-accent/60 font-medium text-primary",
                  )}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="truncate flex items-center gap-1.5">
                    {isSelected && (
                      <Check size={11} className="text-primary shrink-0" />
                    )}
                    <span>{opt.label || opt.value}</span>
                  </span>
                  {opt.type && (
                    <span className="text-[9px] text-muted-foreground/60 px-1 py-0.2 rounded bg-muted/40 font-sans shrink-0 ml-1">
                      {opt.type}
                    </span>
                  )}
                </button>
              );
            })
          )}

          {rootOptionLabel && (
            <>
              <div className="border-t border-border/40 my-1" />
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-xs font-mono rounded hover:bg-accent text-foreground flex items-center justify-between transition-colors"
                onClick={() => handleSelect("")}
              >
                <span className="italic text-[11px] text-foreground/80">
                  {rootOptionLabel}
                </span>
                <span className="text-[9px] text-muted-foreground/60 px-1 py-0.2 rounded bg-muted/40 font-sans shrink-0 ml-1">
                  root
                </span>
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
