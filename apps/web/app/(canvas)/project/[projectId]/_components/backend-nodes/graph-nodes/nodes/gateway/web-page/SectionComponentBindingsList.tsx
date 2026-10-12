"use client";

import React, { useState, useMemo } from "react";
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
  Search,
  X,
  Pencil,
} from "lucide-react";
import {
  PageSection,
  SectionComponentBinding,
  ComponentBindingType,
} from "@workspace/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { toPascalCase } from "@/lib/utils";
import { Badge } from "@workspace/ui/components/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";

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

const ARCHETYPE_OPTIONS: Array<{
  id: ComponentBindingType;
  label: string;
  icon: React.ElementType;
}> = [
  { id: "button", label: "Button", icon: MousePointerClick },
  { id: "input", label: "Input", icon: FormInput },
  { id: "card", label: "Card", icon: Layout },
  { id: "switch", label: "Switch", icon: ToggleLeft },
  { id: "select", label: "Select", icon: ChevronDownSquare },
  { id: "badge", label: "Badge", icon: BadgeAlert },
  { id: "table", label: "Table", icon: Table },
];

export const SectionComponentBindingsList: React.FC<SectionComponentBindingsListProps> = ({
  nodeId,
  section,
  sections,
  updateSections,
  isLastSubsection,
}) => {
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [newCompType, setNewCompType] = useState<ComponentBindingType>("button");
  const [newCompName, setNewCompName] = useState("");

  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const componentBindings = section.componentBindings || [];

  const visibleBindings = useMemo(() => {
    if (!searchQuery.trim()) return componentBindings;
    const q = searchQuery.toLowerCase().trim();
    return componentBindings.filter((c) => {
      return (
        (c.label || "").toLowerCase().includes(q) ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.componentType || "").toLowerCase().includes(q) ||
        (c.valueStateName || "").toLowerCase().includes(q) ||
        (c.actionName || "").toLowerCase().includes(q)
      );
    });
  }, [componentBindings, searchQuery]);

  const handleOpenAddPopover = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const count = componentBindings.filter((c) => c.componentType === "button").length;
    setNewCompType("button");
    setNewCompName(`Button${count + 1}`);
    setAddPopoverOpen(true);
  };

  const handleSelectArchetype = (typeId: ComponentBindingType, typeLabel: string) => {
    setNewCompType(typeId);
    const count = componentBindings.filter((c) => c.componentType === typeId).length;
    const pascal = toPascalCase(typeLabel);
    setNewCompName(`${pascal}${count + 1}`);
  };

  const handleCreateComponent = (customValues?: {
    name?: string;
    label?: string;
    componentType?: ComponentBindingType;
  }) => {
    const compType = customValues?.componentType || newCompType || "button";
    const newId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Real user actions, strictly excluding lifecycle hooks like pageLoad
    const realActions = (section.actions || []).filter(
      (a) => a.name !== "pageLoad" && a.name !== "init",
    );
    const chosenAction = realActions[0];

    const sameTypeCount = componentBindings.filter((c) => c.componentType === compType).length;
    const typeTitle = toPascalCase(compType);

    const rawName =
      customValues?.name?.trim() ||
      customValues?.label?.trim() ||
      newCompName.trim() ||
      `${typeTitle}${sameTypeCount + 1}`;

    const resolvedName = toPascalCase(rawName) || `${typeTitle}${sameTypeCount + 1}`;
    const resolvedLabel = resolvedName;

    const firstStateObj = section.stateObjects?.[0];
    const firstVar = section.states?.[0];
    const defaultStateName = firstStateObj?.name || firstVar?.name;
    const defaultStoreName = firstStateObj?.storeName;
    const isStore = typeof defaultStoreName === "string" && defaultStoreName.length > 0;

    const newBinding: SectionComponentBinding = {
      id: newId,
      name: resolvedName,
      componentType: compType,
      label: resolvedLabel,
      variant: "default",
      actionId: chosenAction?.id,
      actionName: chosenAction?.name,
      triggerEvent: compType === "input" || compType === "switch" ? "change" : "click",
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

    setAddPopoverOpen(false);
    setNewCompName("");

    // Open in sidebar immediately
    setActiveConfigItem({
      type: "sectionComponent",
      id: newId,
      nodeId,
      sectionId: section.id,
    });
  };

  const handleStartRename = (comp: SectionComponentBinding, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCompId(comp.id);
    setEditingText(comp.name || comp.label || "");
  };

  const handleSaveRename = (compId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      setEditingCompId(null);
      return;
    }
    const pascal = toPascalCase(trimmed) || trimmed;
    const updatedBindings = componentBindings.map((c) =>
      c.id === compId
        ? { ...c, label: pascal, name: pascal }
        : c,
    );
    const updatedSections = sections.map((sec) =>
      sec.id === section.id
        ? { ...sec, componentBindings: updatedBindings }
        : sec,
    );
    updateSections(updatedSections);
    setEditingCompId(null);
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
    <div className="flex flex-col border-t border-border/30 w-full overflow-hidden">
      {/* Subsection Header */}
      <div className="px-2.5 py-1 bg-purple-500/[0.04] border-b border-border/30 flex items-center justify-between text-[9px] select-none">
        <div className="flex items-center gap-1.5 font-semibold text-foreground/80">
          <Layers size={11} className="text-purple-500 shrink-0" />
          <span className="uppercase tracking-wider text-[8px] font-bold text-purple-600 dark:text-purple-400">
            UI Components &amp; Bindings
          </span>
          {Boolean(componentBindings.length) && (
            <span className="text-[8px] font-mono text-muted-foreground">
              ({visibleBindings.length !== componentBindings.length ? `${visibleBindings.length}/${componentBindings.length}` : componentBindings.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {componentBindings.length > 2 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchOpen(!searchOpen);
              }}
              className={cn(
                "p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                searchOpen && "text-purple-600 dark:text-purple-400 bg-purple-500/10",
              )}
              title="Search components"
            >
              <Search size={10} />
            </button>
          )}

          <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={handleOpenAddPopover}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-[8px] font-semibold transition-colors cursor-pointer"
                title="Add and name a UI component"
              >
                <Plus size={9} />
                <span>Add Component</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={5}
              className="w-64 p-3 bg-popover border border-border/80 shadow-xl rounded-xl z-50 text-foreground nodrag nopan"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                    <Layers size={13} className="text-purple-500" />
                    <span>Add UI Component</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddPopoverOpen(false)}
                    className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-muted-foreground">Archetype</label>
                  <div className="grid grid-cols-4 gap-1">
                    {ARCHETYPE_OPTIONS.map((item) => {
                      const ItemIcon = item.icon;
                      const isSelected = newCompType === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectArchetype(item.id, item.label)}
                          className={cn(
                            "flex flex-col items-center justify-center p-1 rounded border text-[9px] gap-0.5 transition-colors cursor-pointer",
                            isSelected
                              ? "bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-400 font-semibold"
                              : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                          )}
                        >
                          <ItemIcon size={12} />
                          <span className="text-[8px] truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-medium text-muted-foreground">Component Name</label>
                    <span className="text-[8px] font-mono text-purple-600 dark:text-purple-400">PascalCase</span>
                  </div>
                  <input
                    type="text"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                    placeholder="e.g. SubmitButton, ActionCard"
                    className="h-7 px-2 text-[11px] rounded bg-secondary/40 border border-border/60 outline-none focus:border-purple-500 text-foreground font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateComponent();
                      }
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleCreateComponent()}
                  className="mt-1 w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus size={12} />
                  <span>Create Component</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Inline Search Bar on Canvas Node Card */}
      {searchOpen && (
        <div className="px-2 py-1 bg-purple-500/[0.03] border-b border-border/20 flex items-center gap-1">
          <Search size={9} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter components..."
            className="w-full bg-transparent text-[9px] font-mono outline-none text-foreground placeholder:text-muted-foreground/50"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
            >
              <X size={9} />
            </button>
          )}
        </div>
      )}

      {/* Component List */}
      {componentBindings.length === 0 ? (
        <div className="py-2 px-2.5 flex items-center justify-between rounded bg-muted/10 border border-dashed border-border/40 text-[9px] text-muted-foreground/70 mx-2.5 my-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-purple-400 shrink-0" />
            <span>Map components (e.g. Button, Input) to state &amp; actions.</span>
          </div>
          <button
            type="button"
            onClick={handleOpenAddPopover}
            className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer font-medium"
          >
            + Add component
          </button>
        </div>
      ) : visibleBindings.length === 0 ? (
        <div className="py-2 px-2.5 text-center text-[9px] text-muted-foreground bg-muted/10 mx-2.5 my-1 rounded border border-border/20">
          <span>No components match &quot;{searchQuery}&quot;. </span>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/20">
          {visibleBindings.map((comp) => {
            const Icon = COMPONENT_ICON_MAP[comp.componentType] || Layout;
            const boundAction = section.actions.find((a) => a.id === comp.actionId);

            return (
              <div
                key={comp.id}
                onClick={(e) => handleOpenConfig(comp.id, e)}
                className="group flex flex-col gap-1 px-2.5 py-1.5 hover:bg-muted/30 transition-colors cursor-pointer text-[10px] w-full overflow-hidden"
              >
                {/* Top Row: Component Identity (left) & Actions (right) */}
                <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    <div className="p-1 rounded bg-purple-500/10 text-purple-500 shrink-0">
                      <Icon size={10} />
                    </div>
                    {editingCompId === comp.id ? (
                      <div
                        className="flex items-center gap-1 flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveRename(comp.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveRename(comp.id);
                            } else if (e.key === "Escape") {
                              setEditingCompId(null);
                            }
                          }}
                          autoFocus
                          className="h-4 px-1 text-[10px] font-semibold bg-background border border-purple-500 rounded outline-none w-28 text-foreground"
                        />
                      </div>
                    ) : (
                      <span
                        onDoubleClick={(e) => handleStartRename(comp, e)}
                        title="Double-click to rename"
                        className="font-semibold text-foreground truncate text-[10px] cursor-text hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        {comp.label || comp.name}
                      </span>
                    )}
                    <Badge
                      variant="secondary"
                      className="text-[8px] px-1 py-0 h-3.5 uppercase font-mono font-normal text-muted-foreground shrink-0"
                    >
                      {comp.componentType}
                    </Badge>
                  </div>

                  {/* Right: Quick Actions - pinned cleanly inside the card */}
                  <div
                    className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleStartRename(comp, e)}
                      title="Rename component"
                      className="p-1 rounded text-muted-foreground hover:text-purple-600 hover:bg-purple-500/10 transition-colors cursor-pointer"
                    >
                      <Pencil size={10} />
                    </button>
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

                {/* Bottom Row: State & Action Mapping Badges (wrapping cleanly without overflowing) */}
                {(comp.actionId || comp.valueStateName || comp.disabledStateName) && (
                  <div className="flex items-center gap-1 text-[8.5px] font-mono flex-wrap pl-4 w-full">
                    {/* Bound Action */}
                    {comp.actionId ? (
                      <span
                        onClick={(e) => handleTestTrigger(comp.actionId, e)}
                        title={`Triggers action: ${comp.actionName || boundAction?.name || "action"} (Click to test)`}
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors cursor-pointer max-w-[150px] truncate"
                      >
                        <span className="text-[7.5px] text-muted-foreground">{comp.triggerEvent || "click"}</span>
                        <ArrowRight size={7} />
                        <span className="font-semibold truncate">{comp.actionName || boundAction?.name || "action"}</span>
                      </span>
                    ) : null}

                    {/* Bound State Variable */}
                    {comp.valueStateName ? (
                      <span
                        title={`Bound to state: ${comp.valueStateName}`}
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 max-w-[130px] truncate"
                      >
                        <span className="text-[7.5px] text-muted-foreground">val:</span>
                        <span className="font-semibold truncate">{comp.valueStateName}</span>
                      </span>
                    ) : null}

                    {/* Bound Disabled State */}
                    {comp.disabledStateName ? (
                      <span
                        title={`Disabled when: ${comp.disabledStateName}`}
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 max-w-[130px] truncate"
                      >
                        <span className="text-[7.5px] text-muted-foreground">dis:</span>
                        <span className="font-semibold truncate">{comp.disabledStateName}</span>
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SectionComponentBindingsList;
