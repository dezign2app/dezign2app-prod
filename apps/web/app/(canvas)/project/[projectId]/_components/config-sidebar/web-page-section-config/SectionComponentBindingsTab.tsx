"use client";

import React, { useState, useMemo } from "react";
import {
  Layers,
  Plus,
  Play,
  Settings,
  Trash2,
  MousePointerClick,
  FormInput,
  Layout,
  ToggleLeft,
  Table,
  BadgeAlert,
  ChevronDownSquare,
  ArrowRight,
  Database,
  Zap,
  Sparkles,
  Search,
  X,
  Filter,
} from "lucide-react";
import {
  PageSection,
  SectionComponentBinding,
  ComponentBindingType,
} from "@workspace/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";

export interface SectionComponentBindingsTabProps {
  nodeId?: string;
  section?: PageSection;
  onUpdateSection?: (changes: Partial<PageSection>) => void;
}

const COMPONENT_TYPES: Array<{
  id: ComponentBindingType;
  label: string;
  icon: React.ElementType;
}> = [
  { id: "button", label: "Button", icon: MousePointerClick },
  { id: "input", label: "Text Input", icon: FormInput },
  { id: "card", label: "Card", icon: Layout },
  { id: "switch", label: "Switch", icon: ToggleLeft },
  { id: "badge", label: "Badge", icon: BadgeAlert },
  { id: "table", label: "Data Table", icon: Table },
  { id: "select", label: "Select Dropdown", icon: ChevronDownSquare },
];

export const SectionComponentBindingsTab: React.FC<SectionComponentBindingsTabProps> = ({
  nodeId,
  section,
  onUpdateSection,
}) => {
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const componentBindings = useMemo(
    () => section?.componentBindings || [],
    [section?.componentBindings],
  );

  const filteredBindings = useMemo(() => {
    return componentBindings.filter((comp) => {
      if (typeFilter !== "all" && comp.componentType !== typeFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const label = (comp.label || "").toLowerCase();
      const name = (comp.name || "").toLowerCase();
      const type = (comp.componentType || "").toLowerCase();
      const stateName = (comp.valueStateName || "").toLowerCase();
      const actionName = (comp.actionName || "").toLowerCase();
      const storeName = (comp.valueStoreName || "").toLowerCase();
      return (
        label.includes(q) ||
        name.includes(q) ||
        type.includes(q) ||
        stateName.includes(q) ||
        actionName.includes(q) ||
        storeName.includes(q)
      );
    });
  }, [componentBindings, searchQuery, typeFilter]);

  const handleAddComponent = () => {
    if (!section || !onUpdateSection) return;
    const newId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const firstAction = section.actions?.[0];
    const firstState = section.stateObjects?.[0] || section.states?.[0];

    const newBinding: SectionComponentBinding = {
      id: newId,
      name: firstAction ? `${firstAction.name} Button` : "Action Button",
      componentType: "button",
      label: firstAction?.name || "Button",
      variant: "default",
      actionId: firstAction?.id,
      actionName: firstAction?.name,
      triggerEvent: "click",
      valueStateName: firstState?.name,
    };

    onUpdateSection({
      componentBindings: [...componentBindings, newBinding],
    });
  };

  const handleDeleteComponent = (id: string) => {
    if (!onUpdateSection) return;
    onUpdateSection({
      componentBindings: componentBindings.filter((c) => c.id !== id),
    });
  };

  const handleOpenConfig = (id: string) => {
    if (!nodeId || !section) return;
    setActiveConfigItem({
      type: "sectionComponent",
      id,
      nodeId,
      sectionId: section.id,
    });
  };

  const handleTestTrigger = (actionId?: string) => {
    if (!nodeId || !section || !actionId) return;
    setActiveConfigItem({
      type: "pageEvent",
      id: actionId,
      nodeId,
      sectionId: section.id,
      initialTab: "simulate",
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto font-sans text-xs">
      {/* Header Info */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/[0.05] border border-purple-500/20">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
            <Layers size={13} className="text-purple-500" />
            <span>UI Components &amp; Bindings</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Connect buttons, inputs, and cards to state variables and action flows.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleAddComponent}
          className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium cursor-pointer shadow-xs"
        >
          <Plus size={12} />
          <span>Add Component</span>
        </Button>
      </div>

      {/* Search Bar & Type Filters */}
      {componentBindings.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components by label, type, state, or action..."
              className="h-8 text-xs pl-8 pr-7 bg-secondary/20 border-border/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
            {[
              { id: "all", label: `All (${componentBindings.length})` },
              { id: "button", label: "Buttons" },
              { id: "input", label: "Inputs" },
              { id: "card", label: "Cards" },
              { id: "switch", label: "Switches" },
              { id: "badge", label: "Badges" },
              { id: "table", label: "Tables" },
              { id: "select", label: "Selects" },
            ].map((tab) => {
              const isActive = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md border font-medium transition-colors cursor-pointer shrink-0",
                    isActive
                      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                      : "bg-secondary/30 text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary/60",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Component Cards */}
      {componentBindings.length === 0 ? (
        <Card className="border-dashed border-border/60 p-8 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-foreground">No UI Components Configured</div>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Add a button, input, or card to link user interactions with section actions and Zustand store data.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddComponent}
            className="h-8 gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer"
          >
            <Plus size={12} />
            <span>Create First Component</span>
          </Button>
        </Card>
      ) : filteredBindings.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-border/70 text-center flex flex-col items-center gap-2 bg-secondary/10">
          <Search size={18} className="text-muted-foreground" />
          <div className="text-xs font-semibold text-foreground">No matching components</div>
          <p className="text-[11px] text-muted-foreground">
            No UI components match &quot;{searchQuery}&quot; {typeFilter !== "all" ? `in category "${typeFilter}"` : ""}.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchQuery("");
              setTypeFilter("all");
            }}
            className="h-7 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer"
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredBindings.map((comp) => {
            const compTypeInfo = COMPONENT_TYPES.find((c) => c.id === comp.componentType) || COMPONENT_TYPES[0]!;
            const Icon = compTypeInfo.icon;
            const boundAction = section?.actions.find((a) => a.id === comp.actionId);

            return (
              <Card
                key={comp.id}
                className="border-border/60 hover:border-purple-500/40 transition-colors shadow-xs"
              >
                <div className="p-3 flex items-center justify-between">
                  {/* Left: Icon & Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                      <Icon size={14} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-xs truncate">
                          {comp.label || comp.name}
                        </span>
                        <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0 uppercase">
                          {comp.componentType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                        {comp.actionId ? (
                          <span className="text-amber-500 flex items-center gap-0.5">
                            <Zap size={10} />
                            <span>{comp.triggerEvent || "click"} &rarr; {comp.actionName || boundAction?.name || "action"}</span>
                          </span>
                        ) : (
                          <span className="italic">No action</span>
                        )}
                        {comp.valueStateName && (
                          <span className="text-cyan-500 flex items-center gap-0.5">
                            <Database size={10} />
                            <span>state: {comp.valueStateName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Controls */}
                  <div className="flex items-center gap-1.5">
                    {comp.actionId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestTrigger(comp.actionId)}
                        className="h-7 text-[11px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                        title="Simulate action execution"
                      >
                        <Play size={10} />
                        <span>Simulate</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenConfig(comp.id)}
                      className="h-7 text-[11px] gap-1 cursor-pointer"
                    >
                      <Settings size={11} />
                      <span>Configure</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDeleteComponent(comp.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title="Delete component"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SectionComponentBindingsTab;
