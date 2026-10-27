"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  ChevronsUpDown,
  X,
  Check,
  MousePointerClick,
  FormInput,
  CreditCard,
  ToggleLeft,
  SquareCheck,
  Tag,
  BarChart3,
  Table,
  ChevronDownSquare,
  AlertTriangle,
  User,
  Loader2,
  PanelLeft,
} from "lucide-react";
import { ComponentBindingType } from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@workspace/ui/components/popover";

export interface ComponentTypeOption {
  id: ComponentBindingType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  recommendedFor?: string[];
}

export const COMPONENT_BINDING_OPTIONS: ComponentTypeOption[] = [
  {
    id: "button",
    label: "Button",
    description: "Clickable action button with variants & guards",
    icon: MousePointerClick,
    recommendedFor: ["action", "event"],
  },
  {
    id: "input",
    label: "Text Input",
    description: "Interactive input field with 2-way binding & debouncing",
    icon: FormInput,
    recommendedFor: ["string", "number"],
  },
  {
    id: "card",
    label: "Card",
    description: "Structured card with title and stat metric preview",
    icon: CreditCard,
    recommendedFor: ["number", "object"],
  },
  {
    id: "switch",
    label: "Switch",
    description: "Toggle switch component for boolean flags",
    icon: ToggleLeft,
    recommendedFor: ["boolean"],
  },
  {
    id: "checkbox",
    label: "Checkbox",
    description: "Checkable box toggle indicator",
    icon: SquareCheck,
    recommendedFor: ["boolean"],
  },
  {
    id: "badge",
    label: "Badge",
    description: "Compact tag or pill with status variant styles",
    icon: Tag,
    recommendedFor: ["string", "number", "boolean"],
  },
  {
    id: "progress",
    label: "Progress",
    description: "Progress bar for numeric values (0-100)",
    icon: BarChart3,
    recommendedFor: ["number"],
  },
  {
    id: "table",
    label: "Data Table",
    description: "Structured table displaying collection & array items",
    icon: Table,
    recommendedFor: ["array", "object[]"],
  },
  {
    id: "select",
    label: "Select Dropdown",
    description: "Dropdown selector for picking one option",
    icon: ChevronDownSquare,
    recommendedFor: ["string", "enum"],
  },
  {
    id: "alert",
    label: "Alert Callout",
    description: "Notification banner for status or warning values",
    icon: AlertTriangle,
    recommendedFor: ["string"],
  },
  {
    id: "avatar",
    label: "Avatar",
    description: "User avatar with initials or image profile link",
    icon: User,
    recommendedFor: ["string"],
  },
  {
    id: "skeleton",
    label: "Skeleton",
    description: "Shimmer placeholder for asynchronous loading states",
    icon: Loader2,
    recommendedFor: ["boolean"],
  },
  {
    id: "sidebar",
    label: "Sidebar",
    description: "Collapsible vertical navigation panel with static or dynamic links",
    icon: PanelLeft,
    recommendedFor: ["array", "object[]"],
  },
];

export interface ComponentTypeComboboxProps {
  value: ComponentBindingType;
  onChange: (value: ComponentBindingType) => void;
  stateType?: string;
  hasActionBound?: boolean;
}

export const ComponentTypeCombobox: React.FC<ComponentTypeComboboxProps> = ({
  value,
  onChange,
  stateType,
  hasActionBound,
}) => {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption: ComponentTypeOption = useMemo(() => {
    const found = COMPONENT_BINDING_OPTIONS.find((opt) => opt.id === value);
    if (found) return found;
    return {
      id: value,
      label: value.charAt(0).toUpperCase() + value.slice(1),
      description: "Custom UI component archetype",
      icon: MousePointerClick,
    };
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return COMPONENT_BINDING_OPTIONS;
    const q = searchQuery.toLowerCase().trim();
    return COMPONENT_BINDING_OPTIONS.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchDesc = opt.description.toLowerCase().includes(q);
      const matchId = opt.id.toLowerCase().includes(q);
      return matchLabel || matchDesc || matchId;
    });
  }, [searchQuery]);

  const normalizedStateType = (stateType || "").toLowerCase().replace("[]", "");

  const checkIsRecommended = (opt: ComponentTypeOption): boolean => {
    if (hasActionBound && opt.id === "button") return true;
    if (!normalizedStateType) return false;
    if (
      (stateType?.includes("[]") || stateType?.toLowerCase() === "array") &&
      opt.id === "table"
    ) {
      return true;
    }
    return Boolean(opt.recommendedFor?.includes(normalizedStateType));
  };

  const isCurrentRecommended = checkIsRecommended(selectedOption);

  return (
    <div className="flex flex-col gap-2">
      {/* Searchable Combobox Trigger & Popover */}
      <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={comboboxOpen}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/70 bg-background/90 hover:bg-muted/30 transition-all cursor-pointer w-full text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500/50 shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 truncate">
                {React.createElement(selectedOption.icon, {
                  size: 13,
                  className: "text-purple-500 shrink-0",
                })}
                <span className="font-semibold text-foreground">{selectedOption.label}</span>
                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                  — {selectedOption.description}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 capitalize">
                {value}
              </Badge>
              <ChevronsUpDown size={13} className="text-muted-foreground shrink-0" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 shadow-2xl border-border/80 bg-popover rounded-xl z-50 overflow-hidden"
          align="start"
        >
          <div className="flex items-center border-b border-border/50 px-3 py-2 gap-2 bg-muted/20">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search component (e.g. input, button, card, switch)..."
              className="h-6 w-full text-xs bg-transparent border-none shadow-none focus:outline-none placeholder:text-muted-foreground/60 text-foreground font-sans"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto p-1 divide-y divide-border/20">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No components found matching "{searchQuery}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = value === opt.id;
                const recommended = checkIsRecommended(opt);

                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onChange(opt.id);
                      setComboboxOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors",
                      isSelected
                        ? "bg-purple-500/15 text-foreground font-semibold"
                        : "hover:bg-muted/40 text-foreground/90",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          "p-1.5 rounded-md shrink-0",
                          isSelected
                            ? "bg-purple-500/20 text-purple-500"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon size={13} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs">{opt.label}</span>
                          {recommended && (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold">
                              Suggested
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check size={13} className="text-purple-500 shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Component Details Banner */}
      <div className="flex items-center justify-between p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/[0.04] shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 shrink-0">
            {React.createElement(selectedOption.icon, { size: 15 })}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-foreground">{selectedOption.label}</span>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 capitalize">
                {selectedOption.id}
              </Badge>
              {isCurrentRecommended && (
                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold">
                  Suggested
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground truncate">
              {selectedOption.description}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setComboboxOpen(true)}
          className="h-6 text-[11px] px-2 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer shrink-0"
        >
          Change
        </Button>
      </div>
    </div>
  );
};
