import React, { useState } from "react";
import { ChevronDown, ChevronRight, Settings2, X, Plus } from "lucide-react";
import { BackendNode, Endpoint, UIEventItem, PageSection } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { generateId } from "../../../common";
import { Input } from "@workspace/ui/components/input";
import { SectionActionRow } from "./SectionActionRow";

export interface SectionBlockProps {
  nodeId: string;
  section: PageSection;
  sections: PageSection[];
  updateSections: (sections: PageSection[]) => void;
  getLinkedEndpoint: (actionId: string) => { targetNode: BackendNode; endpoint: Endpoint } | null;
  onTriggerEvent: (triggerInfo: { event: UIEventItem; targetNode: BackendNode; endpoint: Endpoint }) => void;
}

export const SectionBlock = ({
  nodeId,
  section,
  sections,
  updateSections,
  getLinkedEndpoint,
  onTriggerEvent,
}: SectionBlockProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [sectionName, setSectionName] = useState(section.name);

  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const handleSaveName = () => {
    const trimmed = sectionName.trim() || "Section";
    const updated = sections.map((s) =>
      s.id === section.id ? { ...s, name: trimmed } : s,
    );
    updateSections(updated);
    setIsEditingName(false);
  };

  const handleToggleRenderMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentMode = section.renderMode || "server";
    const nextMode = currentMode === "server" ? "client" : "server";
    const updated = sections.map((s) =>
      s.id === section.id ? { ...s, renderMode: nextMode as "server" | "client" } : s,
    );
    updateSections(updated);
  };

  const handleCycleLoadStrategy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = section.loadStrategy || "eager";
    const cycleMap: Record<string, "eager" | "dynamic" | "dynamic-no-ssr"> = {
      eager: "dynamic",
      dynamic: "dynamic-no-ssr",
      "dynamic-no-ssr": "eager",
    };
    const nextStrategy = cycleMap[current] || "eager";
    const updated = sections.map((s) =>
      s.id === section.id ? { ...s, loadStrategy: nextStrategy } : s,
    );
    updateSections(updated);
  };

  const handleDeleteSection = (e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useBackendCanvasStore.getState();
    section.actions.forEach((act) => {
      const edge = store.edges.find(
        (ed) => ed.source === nodeId && ed.sourceHandle === `events-${act.id}`,
      );
      if (edge) {
        store.deleteEdge(edge.id);
        const targetNode = store.nodes.find((n) => n.id === edge.target);
        if (targetNode && targetNode.type === "page_ref") {
          const remaining = store.edges.filter(
            (ed) => ed.target === targetNode.id && ed.id !== edge.id,
          );
          if (remaining.length === 0) store.deleteNode(targetNode.id);
        }
      }
    });

    const updated = sections.filter((s) => s.id !== section.id);
    updateSections(updated);
  };

  const handleAddAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newAction: UIEventItem = {
      id: generateId(),
      name: "New Action",
      event: "click",
    };
    const updated = sections.map((s) =>
      s.id === section.id ? { ...s, actions: [...s.actions, newAction] } : s,
    );
    updateSections(updated);
    setIsOpen(true);
  };

  const renderMode = section.renderMode || "server";
  const loadStrategy = section.loadStrategy || "eager";

  return (
    <div className="flex flex-col border-b last:border-b-0 bg-card/60">
      {/* Section Header */}
      <div
        className="px-2.5 py-1.5 bg-secondary/30 hover:bg-secondary/50 flex items-center justify-between gap-1.5 cursor-pointer nodrag select-none transition-colors group/sec"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <button
            type="button"
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          >
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {isEditingName ? (
            <Input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="h-5 text-xs px-1 py-0 bg-background"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              onBlur={handleSaveName}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-[11px] font-semibold text-foreground truncate hover:text-indigo-400 cursor-pointer"
              title="Click to expand/collapse, double-click to rename"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
            >
              {section.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Render Mode Badge: Server / Client */}
          <button
            type="button"
            onClick={handleToggleRenderMode}
            className={cn(
              "text-[8px] font-mono px-1 py-0.2 rounded border transition-colors cursor-pointer",
              renderMode === "server"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
            )}
            title={`Render Mode: ${renderMode} (Click to toggle)`}
          >
            {renderMode}
          </button>

          {/* Load Strategy Badge: eager / dynamic / no-ssr */}
          <button
            type="button"
            onClick={handleCycleLoadStrategy}
            className={cn(
              "text-[8px] font-mono px-1 py-0.2 rounded border transition-colors cursor-pointer",
              loadStrategy === "eager"
                ? "bg-secondary text-muted-foreground border-border/50"
                : loadStrategy === "dynamic"
                  ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                  : "bg-amber-500/10 text-amber-500 border-amber-500/30",
            )}
            title={`Load Strategy: ${loadStrategy} (Click to cycle eager/dynamic/no-ssr)`}
          >
            {loadStrategy === "dynamic-no-ssr" ? "no-ssr" : loadStrategy}
          </button>

          {/* Add Action to section */}
          <button
            type="button"
            onClick={handleAddAction}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group/sec:opacity-100 transition-all cursor-pointer"
            title="Add action"
          >
            <Plus size={11} />
          </button>

          {/* Section Settings Gear */}
          <button
            type="button"
            onClick={() =>
              setActiveConfigItem({
                type: "pageSection",
                id: section.id,
                nodeId,
              })
            }
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Configure section & AI prompt"
          >
            <Settings2 size={11} />
          </button>

          {/* Delete Section */}
          <button
            type="button"
            onClick={handleDeleteSection}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group/sec:opacity-100 transition-all cursor-pointer"
            title="Delete section"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Section Actions Body */}
      {isOpen && (
        <div className="flex flex-col bg-background/40">
          {section.actions.map((act) => (
            <SectionActionRow
              key={act.id}
              nodeId={nodeId}
              sectionId={section.id}
              action={act}
              sections={sections}
              updateSections={updateSections}
              getLinkedEndpoint={getLinkedEndpoint}
              onTriggerEvent={onTriggerEvent}
            />
          ))}

          {/* Add Action inside section */}
          <button
            type="button"
            onClick={handleAddAction}
            className="flex items-center justify-center gap-1 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors border-t border-dashed border-border/40 cursor-pointer nodrag"
          >
            <Plus size={10} /> Add action
          </button>
        </div>
      )}
    </div>
  );
};
