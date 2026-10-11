"use client";

import React from "react";
import {
  Layers,
  Plus,
  Settings,
  Trash2,
  Play,
  ArrowRight,
  MousePointerClick,
  FormInput,
  Layout,
  ToggleLeft,
  Table,
  BadgeAlert,
  ChevronDownSquare,
  Sparkles,
} from "lucide-react";
import {
  PageSection,
  SectionComponentBinding,
  ComponentBindingType,
} from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Badge } from "@workspace/ui/components/badge";

export interface SectionComponentBindingsListProps {
  nodeId: string;
  section: PageSection;
  sections: PageSection[];
  updateSections: (sections: PageSection[]) => void;
  isLastSubsection?: boolean;
}

const COMPONENT_ICON_MAP: Record<string, React.ElementType> = {
  button: MousePointerClick,
  input: FormInput,
  card: Layout,
  switch: ToggleLeft,
  table: Table,
  badge: BadgeAlert,
  select: ChevronDownSquare,
};

export const SectionComponentBindingsList: React.FC<SectionComponentBindingsListProps> = ({
  nodeId,
  section,
  sections,
  updateSections,
  isLastSubsection,
}) => {
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const componentBindings = section.componentBindings || [];

  const handleAddComponent = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const firstAction = section.actions?.[0];
    const firstStateObj = section.stateObjects?.[0];
    const firstVar = section.states?.[0];
    const defaultStateName = firstStateObj?.name || firstVar?.name;
    const defaultStoreName = firstStateObj?.storeName;
    const isStore = typeof defaultStoreName === "string" && defaultStoreName.length > 0;

    const newBinding: SectionComponentBinding = {
      id: newId,
      name: firstAction ? `${firstAction.name} Button` : "Action Button",
      componentType: "button",
      label: firstAction?.name || "Click Me",
      variant: "default",
      actionId: firstAction?.id,
      actionName: firstAction?.name,
      triggerEvent: "click",
      valueStateName: defaultStateName,
      valueSourceType: isStore ? "store" : "local",
      valueStoreName: defaultStoreName,
    };

    const nextBindings = [...componentBindings, newBinding];
    const updatedSections = sections.map((sec) =>
      sec.id === section.id
        ? { ...sec, componentBindings: nextBindings }
        : sec,
    );
    updateSections(updatedSections);

    // Open in sidebar immediately
    setActiveConfigItem({
      type: "sectionComponent",
      id: newId,
      nodeId,
      sectionId: section.id,
    });
  };

  const handleDeleteComponent = (compId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextBindings = componentBindings.filter((c) => c.id !== compId);
    const updatedSections = sections.map((sec) =>
      sec.id === section.id
        ? { ...sec, componentBindings: nextBindings }
        : sec,
    );
    updateSections(updatedSections);
  };

  const handleOpenConfig = (compId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConfigItem({
      type: "sectionComponent",
      id: compId,
      nodeId,
      sectionId: section.id,
    });
  };

  const handleTestTrigger = (actionId?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!actionId) return;
    setActiveConfigItem({
      type: "pageEvent",
      id: actionId,
      nodeId,
      sectionId: section.id,
      initialTab: "simulate",
    });
  };

  return (
    <div className="flex flex-col border-t border-border/30">
      {/* Subsection Header */}
      <div className="px-2.5 py-1 bg-purple-500/[0.04] border-b border-border/30 flex items-center justify-between text-[9px] select-none">
        <div className="flex items-center gap-1.5 font-semibold text-foreground/80">
          <Layers size={11} className="text-purple-500 shrink-0" />
          <span className="uppercase tracking-wider text-[8px] font-bold text-purple-600 dark:text-purple-400">
            UI Components &amp; Bindings
          </span>
          {Boolean(componentBindings.length) && (
            <span className="text-[8px] font-mono text-muted-foreground">
              ({componentBindings.length})
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddComponent}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-[8px] font-semibold transition-colors cursor-pointer"
          title="Add a UI component with state & action bindings"
        >
          <Plus size={9} />
          <span>Add Component</span>
        </button>
      </div>

      {/* Component List */}
      {componentBindings.length === 0 ? (
        <div className="py-2 px-2.5 flex items-center justify-between rounded bg-muted/10 border border-dashed border-border/40 text-[9px] text-muted-foreground/70 mx-2.5 my-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-purple-400 shrink-0" />
            <span>Map components (e.g. Button, Input) to state &amp; actions.</span>
          </div>
          <button
            type="button"
            onClick={handleAddComponent}
            className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer font-medium"
          >
            + Add component
          </button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/20">
          {componentBindings.map((comp) => {
            const Icon = COMPONENT_ICON_MAP[comp.componentType] || Layout;
            const boundAction = section.actions.find((a) => a.id === comp.actionId);

            return (
              <div
                key={comp.id}
                onClick={(e) => handleOpenConfig(comp.id, e)}
                className="group flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/30 transition-colors cursor-pointer text-[10px]"
              >
                {/* Left: Component Type & Label */}
                <div className="flex items-center gap-1.5 min-w-0 max-w-[45%]">
                  <div className="p-1 rounded bg-purple-500/10 text-purple-500 shrink-0">
                    <Icon size={10} />
                  </div>
                  <div className="flex flex-col min-w-0 truncate">
                    <div className="flex items-center gap-1 truncate">
                      <span className="font-semibold text-foreground truncate">
                        {comp.label || comp.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[8px] px-1 py-0 h-3.5 uppercase font-mono font-normal text-muted-foreground shrink-0"
                      >
                        {comp.componentType}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Center: State & Action Mappings */}
                <div className="flex items-center gap-1.5 text-[9px] font-mono shrink-0">
                  {/* Bound Action */}
                  {comp.actionId ? (
                    <span
                      onClick={(e) => handleTestTrigger(comp.actionId, e)}
                      title={`Triggers action: ${comp.actionName || boundAction?.name || "action"} (Click to test)`}
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
                    >
                      <span className="text-[8px] text-muted-foreground">{comp.triggerEvent || "click"}</span>
                      <ArrowRight size={8} />
                      <span className="font-semibold">{comp.actionName || boundAction?.name || "action"}</span>
                    </span>
                  ) : null}

                  {/* Bound State Variable */}
                  {comp.valueStateName ? (
                    <span
                      title={`Bound to state: ${comp.valueStateName}`}
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30"
                    >
                      <span>val:</span>
                      <span className="font-semibold">{comp.valueStateName}</span>
                    </span>
                  ) : null}

                  {/* Bound Disabled State */}
                  {comp.disabledStateName ? (
                    <span
                      title={`Disabled when: ${comp.disabledStateName}`}
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                    >
                      <span>dis:</span>
                      <span className="font-semibold">{comp.disabledStateName}</span>
                    </span>
                  ) : null}
                </div>

                {/* Right: Quick Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {comp.actionId && (
                    <button
                      type="button"
                      onClick={(e) => handleTestTrigger(comp.actionId, e)}
                      title="Simulate action flow"
                      className="p-1 rounded text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    >
                      <Play size={10} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleOpenConfig(comp.id, e)}
                    title="Configure component properties"
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <Settings size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteComponent(comp.id, e)}
                    title="Delete component mapping"
                    className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SectionComponentBindingsList;
