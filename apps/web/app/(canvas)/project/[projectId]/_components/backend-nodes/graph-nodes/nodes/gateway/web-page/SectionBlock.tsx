import React, { useState, useEffect } from "react";
import { Position, Handle, useUpdateNodeInternals } from "@xyflow/react";
import { ChevronDown, ChevronRight, Settings, Trash, Plus, Zap } from "lucide-react";
import { BackendNode, Endpoint, UIEventItem, PageSection } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { generateId } from "../../../common";
import { Input } from "@workspace/ui/components/input";
import { SectionActionRow } from "./SectionActionRow";
import { SectionStateObjectsList } from "./SectionStateObjectsList";

import { useSectionCollapseStore } from "@/lib/stores/sectionCollapseStore";
import { NodeDeletionDialog } from "../../../../../node-deletion-dialog";

export interface SectionBlockProps {
  nodeId: string;
  section: PageSection;
  sections: PageSection[];
  isLastSection?: boolean;
  updateSections: (sections: PageSection[]) => void;
  getLinkedEndpoint: (actionId: string) => { targetNode: BackendNode; endpoint: Endpoint } | null;
  onTriggerEvent: (triggerInfo: { event: UIEventItem; targetNode: BackendNode; endpoint: Endpoint }) => void;
  isEditingName?: boolean;
  onStartEditName?: () => void;
  onFinishEditName?: () => void;
}

export const SectionBlock = ({
  nodeId,
  section,
  sections,
  isLastSection,
  updateSections,
  getLinkedEndpoint,
  onTriggerEvent,
  isEditingName: isEditingNameProp,
  onStartEditName,
  onFinishEditName,
}: SectionBlockProps) => {
  const isCollapsed = useSectionCollapseStore((s) =>
    s.isSectionCollapsed(nodeId, section.id),
  );
  const setSectionCollapsed = useSectionCollapseStore((s) => s.setSectionCollapsed);
  const toggleSectionCollapsed = useSectionCollapseStore(
    (s) => s.toggleSectionCollapsed,
  );
  const deleteSectionCollapseState = useSectionCollapseStore(
    (s) => s.deleteSectionCollapseState,
  );

  const isOpen = !isCollapsed;
  const [internalIsEditingName, setInternalIsEditingName] = useState(
    !section.name || section.name.trim() === "" || Boolean(isEditingNameProp),
  );
  const isEditingName = isEditingNameProp !== undefined ? isEditingNameProp : internalIsEditingName;

  const setIsEditingName = (val: boolean) => {
    setInternalIsEditingName(val);
    if (val) {
      onStartEditName?.();
    } else {
      onFinishEditName?.();
    }
  };

  const [sectionName, setSectionName] = useState(section.name || "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const isFinishedRef = React.useRef(false);

  useEffect(() => {
    if (isEditingName) {
      isFinishedRef.current = false;
      setSectionName(section.name || "");
      const focus = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      };
      focus();
      const raf = requestAnimationFrame(focus);
      const timer = setTimeout(focus, 50);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [isEditingName]);

  useEffect(() => {
    if (!isEditingName) {
      setSectionName(section.name || "");
    }
  }, [section.name, isEditingName]);

  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    if (typeof updateNodeInternals === "function") {
      updateNodeInternals(nodeId);
    }
  }, [isOpen, section.actions, section.stateObjects, nodeId, updateNodeInternals]);

  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const handleDeleteSection = () => {
    deleteSectionCollapseState(nodeId, section.id);
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

  const handleDiscardSection = () => {
    setIsEditingName(false);
    handleDeleteSection();
  };

  const handleCancel = () => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    if (!section.name || section.name.trim() === "") {
      handleDiscardSection();
    } else {
      setSectionName(section.name);
      setIsEditingName(false);
    }
  };

  const handleSaveOrDiscard = () => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    const trimmed = sectionName.trim();
    if (!trimmed) {
      if (!section.name || section.name.trim() === "") {
        handleDiscardSection();
      } else {
        setSectionName(section.name);
        setIsEditingName(false);
      }
      return;
    }

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

  const handleAddAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = generateId();
    const newAction: UIEventItem = {
      id: newId,
      name: "",
      event: "click",
    };
    const updated = sections.map((s) =>
      s.id === section.id ? { ...s, actions: [...s.actions, newAction] } : s,
    );
    updateSections(updated);
    setSectionCollapsed(nodeId, section.id, false);
    setEditingActionId(newId);
  };

  const renderMode = section.renderMode || "server";
  const loadStrategy = section.loadStrategy || "eager";

  return (
    <div
      className={cn(
        "flex flex-col border-b last:border-b-0 bg-card/60",
        isLastSection && "rounded-b-[10px]",
      )}
    >
      {/* Section Header */}
      <div
        className={cn(
          "px-2.5 py-1.5 bg-secondary/30 hover:bg-secondary/50 flex items-center justify-between gap-1.5 cursor-pointer nodrag select-none transition-colors group/sec relative",
          isLastSection && !isOpen && "rounded-b-[10px]",
        )}
        onClick={() => toggleSectionCollapsed(nodeId, section.id)}
      >
        {/* Collapsed Handles: keep edges anchored to the section header when collapsed */}
        {!isOpen && (
          <>
            {section.actions.map((act) => {
              const evtStr = act.event || "";
              const evtLower = evtStr.toLowerCase();
              const isPageLoad = evtStr === "pageLoad";
              const isSse =
                evtStr === "sse" || evtStr === "sseMessage" || evtLower === "sse";
              const isWebsocket =
                evtStr === "websocket" ||
                evtStr === "ws" ||
                evtStr === "websocketMessage" ||
                evtLower === "websocket" ||
                evtLower === "ws";
              const isWebrtc = evtStr === "webrtc" || evtLower === "webrtc";

              return (
                <React.Fragment key={act.id}>
                  {/* Right outgoing event handle */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`events-${act.id}`}
                    className="w-2 h-2 -right-1"
                    style={{ top: "50%" }}
                  />

                  {/* Protocol / Inbound Left handles */}
                  {isPageLoad && (
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`pageload-in-${act.id}`}
                      className="w-2 h-2 -left-1 !bg-emerald-500"
                      style={{ top: "50%" }}
                    />
                  )}
                  {isSse && (
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`sse-in-${act.id}`}
                      className="w-2 h-2 -left-1 !bg-amber-500"
                      style={{ top: "50%" }}
                    />
                  )}
                  {isWebsocket && (
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`websocket-in-${act.id}`}
                      className="w-2 h-2 -left-1 !bg-cyan-500"
                      style={{ top: "50%" }}
                    />
                  )}
                  {isWebrtc && (
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`webrtc-in-${act.id}`}
                      className="w-2 h-2 -left-1 !bg-purple-500"
                      style={{ top: "50%" }}
                    />
                  )}
                  {!isPageLoad && !isSse && !isWebsocket && !isWebrtc && (
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`event-in-${act.id}`}
                      className="w-2 h-2 -left-1 !bg-indigo-500"
                      style={{ top: "50%" }}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Collapsed State Handles: keep store state edges anchored when collapsed */}
            {section.stateObjects?.map((st) => (
              <Handle
                key={`collapsed-state-${st.id}`}
                type="target"
                position={Position.Left}
                id={`section-state-in-${section.id}-${st.id}`}
                className="w-2 h-2 -left-1 !bg-purple-500"
                style={{ top: "50%" }}
                title={`State subscription: ${st.name} from store ${st.storeName || ""}`}
              />
            ))}
          </>
        )}

        <div className="flex items-center gap-1 min-w-0 flex-1">
          <button
            type="button"
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              toggleSectionCollapsed(nodeId, section.id);
            }}
          >
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {isEditingName ? (
            <Input
              ref={inputRef}
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="Section name"
              className="h-5 text-xs px-1 py-0 bg-background"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveOrDiscard();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancel();
                }
              }}
              onBlur={handleSaveOrDiscard}
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

          {/* Store States Count Badge */}
          {Boolean(section.stateObjects?.length) && (
            <span
              className="text-[8px] font-mono px-1 py-0.2 rounded border bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 font-medium cursor-default"
              title={`${section.stateObjects!.length} Zustand store field${section.stateObjects!.length === 1 ? "" : "s"} rendered (${section.stateObjects!.map((s) => s.name).join(", ")})`}
            >
              {section.stateObjects!.length} {section.stateObjects!.length === 1 ? "state" : "states"}
            </span>
          )}

          {/* Local useState Count Badge */}
          {Boolean(section.states?.length) && (
            <span
              className="text-[8px] font-mono px-1 py-0.2 rounded border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-medium cursor-default"
              title={`${section.states!.length} state variable${section.states!.length === 1 ? "" : "s"} defined (${section.states!.map((s) => s.name).join(", ")})`}
            >
              {section.states!.length} {section.states!.length === 1 ? "local state" : "local states"}
            </span>
          )}

          {/* Add Action to section */}
          <button
            type="button"
            onClick={handleAddAction}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
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
            title="Configure section"
          >
            <Settings size={11} />
          </button>

          {/* Delete Section */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialogOpen(true);
            }}
            className="p-1 rounded text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            title="Delete section"
          >
            <Trash size={11} />
          </button>
        </div>
      </div>

      {/* Section Body: Subsections for Rendered State & Actions */}
      {isOpen && (
        <div
          className={cn(
            "flex flex-col bg-background/40",
            isLastSection && "rounded-b-[10px]",
          )}
        >
          {/* Subsection 1: Rendered Store State (Zustand) */}
          <SectionStateObjectsList
            nodeId={nodeId}
            section={section}
            sections={sections}
            updateSections={updateSections}
          />

          {/* Subsection 2: Actions & Triggers */}
          <div className="flex flex-col">
            <div className="px-2.5 py-1 bg-amber-500/[0.04] border-b border-border/30 flex items-center justify-between text-[9px] select-none">
              <div className="flex items-center gap-1.5 font-semibold text-foreground/80">
                <Zap size={11} className="text-amber-500 shrink-0" />
                <span className="uppercase tracking-wider text-[8px] font-bold">
                  Actions & Triggers
                </span>
                {Boolean(section.actions.length) && (
                  <span className="text-[8px] font-mono text-muted-foreground">
                    ({section.actions.length})
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddAction}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[8px] font-semibold transition-colors cursor-pointer"
                title="Add action to this section"
              >
                <Plus size={9} />
                <span>Add Action</span>
              </button>
            </div>

            {/* Action Rows */}
            {section.actions.length === 0 ? (
              <div className="py-1.5 px-2 flex items-center justify-between rounded bg-muted/10 border border-dashed border-border/50 text-[9px] text-muted-foreground/70 mx-2.5 my-1.5">
                <span>No actions defined for this section.</span>
                <button
                  type="button"
                  onClick={handleAddAction}
                  className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-medium"
                >
                  + Add action
                </button>
              </div>
            ) : (
              section.actions.map((act) => (
                <SectionActionRow
                  key={act.id}
                  nodeId={nodeId}
                  sectionId={section.id}
                  action={act}
                  sections={sections}
                  updateSections={updateSections}
                  getLinkedEndpoint={getLinkedEndpoint}
                  onTriggerEvent={onTriggerEvent}
                  isEditing={editingActionId === act.id}
                  onStartEdit={() => setEditingActionId(act.id)}
                  onFinishEdit={() => {
                    if (editingActionId === act.id) {
                      setEditingActionId(null);
                    }
                  }}
                />
              ))
            )}

            {/* Add Action button at bottom */}
            {section.actions.length > 0 && (
              <button
                type="button"
                onClick={handleAddAction}
                className={cn(
                  "flex items-center justify-center gap-1 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors cursor-pointer nodrag",
                  isLastSection && "rounded-b-[10px]",
                )}
              >
                <Plus size={10} /> Add action
              </button>
            )}
          </div>
        </div>
      )}

      {/* Detailed Section Deletion Dialog */}
      <NodeDeletionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deletionTarget={{
          type: "section",
          nodeId,
          section,
          onConfirm: handleDeleteSection,
        }}
      />
    </div>
  );
};
