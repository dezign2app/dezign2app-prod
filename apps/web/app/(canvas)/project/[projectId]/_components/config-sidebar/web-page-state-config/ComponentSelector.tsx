"use client";

import React, { useState, useMemo } from "react";
import { Sliders, Search, ChevronsUpDown, X, Check } from "lucide-react";
import { StateRenderComponent } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@workspace/ui/components/popover";
import { ComponentOption, COMPONENT_OPTIONS } from "./constants";

export interface ComponentSelectorProps {
  currentComponent: StateRenderComponent;
  selectedOption: ComponentOption;
  stateType?: string;
  onSelectComponent: (componentId: StateRenderComponent) => void;
}

export const ComponentSelector: React.FC<ComponentSelectorProps> = ({
  currentComponent,
  selectedOption,
  stateType,
  onSelectComponent,
}) => {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");

  const filteredComponentOptions = useMemo(() => {
    if (!componentSearch.trim()) return COMPONENT_OPTIONS;
    const q = componentSearch.toLowerCase().trim();
    return COMPONENT_OPTIONS.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchDesc = opt.description.toLowerCase().includes(q);
      const matchId = opt.id.toLowerCase().includes(q);
      return matchLabel || matchDesc || matchId;
    });
  }, [componentSearch]);

  const normalizedStateType = (stateType || "").toLowerCase().replace("[]", "");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Sliders size={13} className="text-primary" />
          <span>Select Shadcn Component</span>
        </Label>
        <span className="text-[10px] text-muted-foreground">Choose UI component to render</span>
      </div>

      {/* Searchable Combobox */}
      <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={comboboxOpen}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/70 bg-background/90 hover:bg-muted/30 transition-all cursor-pointer w-full text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50 shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 truncate">
                {React.createElement(selectedOption.icon, {
                  size: 13,
                  className: "text-cyan-500 shrink-0",
                })}
                <span className="font-semibold text-foreground">{selectedOption.label}</span>
                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                  — {selectedOption.description}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 capitalize">
                {currentComponent}
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
              value={componentSearch}
              onChange={(e) => setComponentSearch(e.target.value)}
              placeholder="Search component (e.g. badge, switch, card, progress)..."
              className="h-6 w-full text-xs bg-transparent border-none shadow-none focus:outline-none placeholder:text-muted-foreground/60 text-foreground font-sans"
              autoFocus
            />
            {componentSearch && (
              <button
                type="button"
                onClick={() => setComponentSearch("")}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto p-1 divide-y divide-border/20">
            {filteredComponentOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No components found matching "{componentSearch}"
              </div>
            ) : (
              filteredComponentOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = currentComponent === opt.id;
                const isRecommended = opt.recommendedFor?.includes(normalizedStateType);

                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onSelectComponent(opt.id);
                      setComboboxOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors",
                      isSelected
                        ? "bg-cyan-500/15 text-foreground font-semibold"
                        : "hover:bg-muted/40 text-foreground/90",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          "p-1.5 rounded-md shrink-0",
                          isSelected ? "bg-cyan-500/20 text-cyan-500" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon size={13} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs">{opt.label}</span>
                          {isRecommended && (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-semibold">
                              Suggested
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate">{opt.description}</span>
                      </div>
                    </div>
                    {isSelected && <Check size={13} className="text-cyan-500 shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Component Details */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04] shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 shrink-0">
            {React.createElement(selectedOption.icon, { size: 16 })}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground">{selectedOption.label}</span>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 capitalize">
                {selectedOption.id}
              </Badge>
              {selectedOption.recommendedFor?.includes(normalizedStateType) && (
                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-semibold">
                  Suggested
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground truncate">{selectedOption.description}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setComboboxOpen(true)}
          className="h-7 text-xs border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer shrink-0"
        >
          Change
        </Button>
      </div>
    </div>
  );
};
