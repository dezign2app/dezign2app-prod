"use client";

import React, { useMemo } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import { cn } from "@workspace/ui/lib/utils";

export interface StepComboboxOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  description?: string;
  group?: string;
}

export interface StepComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: StepComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  contentClassName?: string;
  emptyText?: string;
  footerAction?: {
    label: string;
    icon?: React.ReactNode;
    onSelect: () => void;
  };
}

export const StepCombobox: React.FC<StepComboboxProps> = ({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className,
  wrapperClassName,
  contentClassName,
  emptyText = "No matching options found",
  footerAction,
}) => {
  const selectedOption = useMemo(() => {
    if (!value || value === "__none__") return null;
    return options.find((opt) => opt.value === value) || { value, label: value };
  }, [options, value]);

  return (
    <div
      className={cn("relative nodrag", wrapperClassName || "w-full min-w-0")}
      onClick={(e) => e.stopPropagation()}
    >
      <Combobox<StepComboboxOption>
        items={options}
        value={selectedOption}
        onValueChange={(selected: StepComboboxOption | null) => {
          if (selected && typeof selected === "object" && "value" in selected) {
            onValueChange(selected.value);
          }
        }}
        itemToStringLabel={(opt: StepComboboxOption) => (opt ? opt.label : "")}
        itemToStringValue={(opt: StepComboboxOption) => (opt ? opt.value : "")}
        isItemEqualToValue={(opt: StepComboboxOption, val: StepComboboxOption | null) =>
          Boolean(opt && val && opt.value === val.value)
        }
      >
        <ComboboxInput
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "h-7 w-full bg-background/60 border-border/60 text-xs font-mono nodrag",
            className
          )}
        />
        <ComboboxContent
          className={cn(
            "w-[var(--anchor-width)] min-w-[240px] max-w-[380px] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-lg z-50 overflow-hidden",
            contentClassName
          )}
          align="start"
          sideOffset={4}
        >
          <ComboboxEmpty className="py-2.5 px-3 text-xs text-muted-foreground text-center">
            {emptyText}
          </ComboboxEmpty>
          <ComboboxList className="p-1 max-h-56 overflow-y-auto">
            {(opt: StepComboboxOption) => (
              <ComboboxItem
                key={opt.value}
                value={opt}
                className="py-1.5 px-2 text-xs font-mono cursor-pointer rounded-md hover:bg-accent flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                  {opt.icon && (
                    <span className="shrink-0 text-muted-foreground">
                      {opt.icon}
                    </span>
                  )}
                  <span className="font-semibold text-foreground truncate">
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="text-[10px] text-muted-foreground truncate font-sans">
                      {opt.description}
                    </span>
                  )}
                </div>
                {opt.badge && <span className="shrink-0">{opt.badge}</span>}
              </ComboboxItem>
            )}
          </ComboboxList>

          {footerAction && (
            <div className="border-t border-border/40 p-1 bg-muted/20">
              <button
                type="button"
                onClick={() => {
                  footerAction.onSelect();
                }}
                className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-foreground font-sans rounded hover:bg-accent flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {footerAction.icon}
                <span>{footerAction.label}</span>
              </button>
            </div>
          )}
        </ComboboxContent>
      </Combobox>
    </div>
  );
};
