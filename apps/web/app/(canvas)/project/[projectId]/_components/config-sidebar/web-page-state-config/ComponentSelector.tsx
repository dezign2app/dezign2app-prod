"use client";

import React, { useState, useMemo } from "react";
import { Sliders, Search, ChevronsUpDown, X, Check, Plus, Trash2, Sparkles } from "lucide-react";
import { StateRenderComponent, ComponentElementBinding } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@workspace/ui/components/popover";
import { ComponentOption, COMPONENT_OPTIONS, DEFAULT_COMPONENT_OPTION } from "./constants";

const toStateRenderComponent = (val: string): StateRenderComponent => {
  switch (val) {
    case "badge":
    case "card":
    case "button":
    case "switch":
    case "checkbox":
    case "progress":
    case "input":
    case "alert":
    case "avatar":
    case "skeleton":
    case "table":
    case "code":
    case "text":
    case "sidebar":
      return val;
    default:
      return "input";
  }
};

export interface ComponentSelectorProps {
  elements?: ComponentElementBinding[];
  activeElementId?: string;
  onSelectActiveElement?: (id: string) => void;
  onAddComponent?: (type: StateRenderComponent) => void;
  onChangeComponentType?: (elId: string, type: StateRenderComponent) => void;
  onDeleteElement?: (elId: string) => void;
  stateType?: string;
  currentComponent?: StateRenderComponent;
  selectedOption?: ComponentOption;
  onSelectComponent?: (componentId: StateRenderComponent) => void;
}

export const ComponentSelector: React.FC<ComponentSelectorProps> = React.memo(({
  elements,
  activeElementId,
  onSelectActiveElement,
  onAddComponent,
  onChangeComponentType,
  onDeleteElement,
  stateType,
  currentComponent,
  selectedOption,
  onSelectComponent,
}) => {
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [changePopoverElId, setChangePopoverElId] = useState<string | null>(null);
  const [changeSearch, setChangeSearch] = useState("");

  // Legacy single-select combobox state
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");

  const normalizedStateType = (stateType || "").toLowerCase().replace("[]", "");

  const filterOptions = (query: string) => {
    if (!query.trim()) return COMPONENT_OPTIONS;
    const q = query.toLowerCase().trim();
    return COMPONENT_OPTIONS.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchDesc = opt.description.toLowerCase().includes(q);
      const matchId = opt.id.toLowerCase().includes(q);
      return matchLabel || matchDesc || matchId;
    });
  };

  const filteredAddOptions = useMemo(() => filterOptions(addSearch), [addSearch]);
  const filteredChangeOptions = useMemo(() => filterOptions(changeSearch), [changeSearch]);
  const filteredLegacyOptions = useMemo(() => filterOptions(componentSearch), [componentSearch]);

  const hasMultiSupport = Boolean(elements && elements.length > 0 && onAddComponent);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header with Title and Add Component Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sliders size={13} className="text-primary" />
            <span>Select Component</span>
          </Label>
          {hasMultiSupport && elements && (
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-muted-foreground">
              {elements.length} {elements.length === 1 ? "component" : "components"}
            </Badge>
          )}
        </div>

        {/* Add Component Popover Trigger */}
        {hasMultiSupport && onAddComponent && (
          <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus size={12} className="text-cyan-500" />
                <span className="font-semibold">Add Component</span>
                <ChevronsUpDown size={11} className="text-muted-foreground opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[320px] p-0 shadow-2xl border-border/80 bg-popover rounded-xl z-50 overflow-hidden"
              align="end"
            >
              <div className="flex items-center border-b border-border/50 px-3 py-2 gap-2 bg-muted/20">
                <Search size={13} className="text-muted-foreground shrink-0" />
                <input
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search component to add..."
                  className="h-6 w-full text-xs bg-transparent border-none shadow-none focus:outline-none placeholder:text-muted-foreground/60 text-foreground font-sans"
                  autoFocus
                />
                {addSearch && (
                  <button
                    type="button"
                    onClick={() => setAddSearch("")}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto p-1 divide-y divide-border/20">
                {filteredAddOptions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No components found matching "{addSearch}"
                  </div>
                ) : (
                  filteredAddOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isRecommended = opt.recommendedFor?.includes(normalizedStateType);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          onAddComponent(opt.id);
                          setAddPopoverOpen(false);
                          setAddSearch("");
                        }}
                        className="flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors hover:bg-cyan-500/15 text-foreground/90 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="p-1.5 rounded-md shrink-0 bg-muted group-hover:bg-cyan-500/20 text-muted-foreground group-hover:text-cyan-500 transition-colors">
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
                        <Plus size={13} className="text-cyan-500 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Multi-Component Elements View */}
      {hasMultiSupport && elements && elements.length > 0 ? (
        <div className="flex flex-col gap-2">
          {elements.map((el, index) => {
            const opt =
              COMPONENT_OPTIONS.find((o) => o.id === toStateRenderComponent(el.elementType)) ||
              DEFAULT_COMPONENT_OPTION;
            const Icon = opt.icon;
            const isActive = el.id === activeElementId;
            const isChangeOpen = changePopoverElId === el.id;

            return (
              <div
                key={el.id}
                onClick={() => onSelectActiveElement?.(el.id)}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer shadow-2xs group",
                  isActive
                    ? "border-cyan-500/50 bg-cyan-500/[0.06] ring-1 ring-cyan-500/30"
                    : "border-border/70 bg-card hover:bg-muted/30 hover:border-border",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      "p-2 rounded-lg shrink-0 border transition-colors",
                      isActive
                        ? "bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 border-cyan-500/30"
                        : "bg-muted text-muted-foreground border-border/40",
                    )}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {el.label || el.name || `Component ${index + 1}`}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 capitalize">
                        {el.elementType}
                      </Badge>
                      {isActive && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] font-mono px-1 py-0 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-semibold border border-cyan-500/25"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate">{opt.description}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  {/* Change Component Type Popover */}
                  {onChangeComponentType && (
                    <Popover
                      open={isChangeOpen}
                      onOpenChange={(open) => {
                        setChangePopoverElId(open ? el.id : null);
                        if (!open) setChangeSearch("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Change
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[300px] p-0 shadow-2xl border-border/80 bg-popover rounded-xl z-50 overflow-hidden"
                        align="end"
                      >
                        <div className="flex items-center border-b border-border/50 px-3 py-2 gap-2 bg-muted/20">
                          <Search size={13} className="text-muted-foreground shrink-0" />
                          <input
                            value={changeSearch}
                            onChange={(e) => setChangeSearch(e.target.value)}
                            placeholder="Change component type..."
                            className="h-6 w-full text-xs bg-transparent border-none shadow-none focus:outline-none placeholder:text-muted-foreground/60 text-foreground font-sans"
                            autoFocus
                          />
                          {changeSearch && (
                            <button
                              type="button"
                              onClick={() => setChangeSearch("")}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/20">
                          {filteredChangeOptions.map((item) => {
                            const ItemIcon = item.icon;
                            const isCurrent = el.elementType === item.id;
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  onChangeComponentType(el.id, item.id);
                                  setChangePopoverElId(null);
                                  setChangeSearch("");
                                }}
                                className={cn(
                                  "flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors",
                                  isCurrent
                                    ? "bg-cyan-500/15 text-foreground font-semibold"
                                    : "hover:bg-muted/40 text-foreground/90",
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <ItemIcon size={13} className={isCurrent ? "text-cyan-500" : "text-muted-foreground"} />
                                  <span className="truncate">{item.label}</span>
                                </div>
                                {isCurrent && <Check size={12} className="text-cyan-500 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Remove Element Button */}
                  {onDeleteElement && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteElement(el.id);
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 cursor-pointer transition-colors"
                      title={elements.length > 1 ? "Remove component" : "Delete component"}
                    >
                      <Trash2 size={12} className="shrink-0" />
                      <span className="text-[11px] font-medium">Delete</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Quick-add chips */}
          {onAddComponent && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 px-0.5">
              <span className="text-[10px] text-muted-foreground font-medium mr-0.5">Quick add:</span>
              <button
                type="button"
                onClick={() => onAddComponent("input")}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/40 hover:bg-muted text-foreground border border-border/50 hover:border-cyan-500/40 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus size={10} className="text-cyan-500" />
                <span>Input</span>
              </button>
              <button
                type="button"
                onClick={() => onAddComponent("button")}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/40 hover:bg-muted text-foreground border border-border/50 hover:border-cyan-500/40 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus size={10} className="text-cyan-500" />
                <span>Button</span>
              </button>
              <button
                type="button"
                onClick={() => onAddComponent("switch")}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/40 hover:bg-muted text-foreground border border-border/50 hover:border-cyan-500/40 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus size={10} className="text-cyan-500" />
                <span>Switch</span>
              </button>
              <button
                type="button"
                onClick={() => onAddComponent("checkbox")}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/40 hover:bg-muted text-foreground border border-border/50 hover:border-cyan-500/40 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus size={10} className="text-cyan-500" />
                <span>Checkbox</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Single-element legacy fallback */
        <>
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
                    {selectedOption &&
                      React.createElement(selectedOption.icon, {
                        size: 13,
                        className: "text-cyan-500 shrink-0",
                      })}
                    <span className="font-semibold text-foreground">
                      {selectedOption?.label || currentComponent}
                    </span>
                    {selectedOption?.description && (
                      <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                        — {selectedOption.description}
                      </span>
                    )}
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
                  placeholder="Search component..."
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
                {filteredLegacyOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = currentComponent === opt.id;
                  const isRecommended = opt.recommendedFor?.includes(normalizedStateType);

                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        onSelectComponent?.(opt.id);
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
                })}
              </div>
            </PopoverContent>
          </Popover>

          {selectedOption && (
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
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">{selectedOption.description}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setComboboxOpen(true)}
                  className="h-7 text-xs border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
                >
                  Change
                </Button>
                {onDeleteElement && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteElement(activeElementId || "")}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 cursor-pointer transition-colors"
                    title="Delete component"
                  >
                    <Trash2 size={12} className="shrink-0" />
                    <span className="text-[11px] font-medium">Delete</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});
ComponentSelector.displayName = "ComponentSelector";
