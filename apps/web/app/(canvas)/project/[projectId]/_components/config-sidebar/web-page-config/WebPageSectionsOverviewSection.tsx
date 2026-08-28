"use client";

import React, { useState } from "react";
import {
  Layers,
  Plus,
  Zap,
  Settings,
  Trash,
  ChevronDown,
  ChevronRight,
  Shield,
  Activity,
  MousePointerClick,
  Send,
  Sliders,
  Radio,
  Wifi,
  Video,
  RefreshCw,
  Compass,
  FileCode,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { NodeDeletionDialog } from "../../node-deletion-dialog/NodeDeletionDialog";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import type { PageSection, UIEventItem } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";

import { useSectionCollapseStore } from "@/lib/stores/sectionCollapseStore";

interface WebPageSectionsOverviewSectionProps {
  nodeId: string;
  sections?: PageSection[];
  onAddSection: (name?: string) => void;
  onUpdateSections?: (sections: PageSection[]) => void;
}

export function WebPageSectionsOverviewSection({
  nodeId,
  sections = [],
  onAddSection,
  onUpdateSections,
}: WebPageSectionsOverviewSectionProps) {
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);
  const isSectionCollapsed = useSectionCollapseStore((s) => s.isSectionCollapsed);
  const toggleSectionCollapsed = useSectionCollapseStore((s) => s.toggleSectionCollapsed);
  const setSectionCollapsed = useSectionCollapseStore((s) => s.setSectionCollapsed);
  const deleteSectionCollapseState = useSectionCollapseStore((s) => s.deleteSectionCollapseState);

  const [sectionToDelete, setSectionToDelete] = useState<{ id: string; name: string } | null>(null);
  const [actionToDelete, setActionToDelete] = useState<{ secId: string; actId: string; name: string } | null>(null);

  const toggleExpand = (secId: string) => {
    toggleSectionCollapsed(nodeId, secId);
  };

  const handleToggleRenderMode = (secId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateSections) return;
    const updated = sections.map((s) => {
      if (s.id !== secId) return s;
      const nextMode = (s.renderMode || "server") === "server" ? "client" : "server";
      return { ...s, renderMode: nextMode as "server" | "client" };
    });
    onUpdateSections(updated);
  };

  const handleCycleLoadStrategy = (secId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateSections) return;
    const cycleMap: Record<string, "eager" | "dynamic" | "dynamic-no-ssr"> = {
      eager: "dynamic",
      dynamic: "dynamic-no-ssr",
      "dynamic-no-ssr": "eager",
    };
    const updated = sections.map((s) => {
      if (s.id !== secId) return s;
      const current = s.loadStrategy || "eager";
      return { ...s, loadStrategy: cycleMap[current] || "eager" };
    });
    onUpdateSections(updated);
  };

  const handleAddActionToSection = (secId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateSections) return;
    const newAction: UIEventItem = {
      id: crypto.randomUUID(),
      name: "newAction",
      event: "click",
    };
    const updated = sections.map((s) =>
      s.id === secId ? { ...s, actions: [...(s.actions || []), newAction] } : s,
    );
    onUpdateSections(updated);
    setSectionCollapsed(nodeId, secId, false);
  };

  const handleDeleteSection = (secId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSectionCollapseState(nodeId, secId);
    const store = useBackendCanvasStore.getState();
    const sec = sections.find((s) => s.id === secId);

    if (sec && sec.actions) {
      for (const act of sec.actions) {
        const existingEdge = store.edges.find(
          (edge) =>
            edge.source === nodeId && edge.sourceHandle === `events-${act.id}`,
        );
        if (existingEdge) {
          const targetNode = store.nodes.find((n) => n.id === existingEdge.target);
          store.deleteEdge(existingEdge.id);
          if (targetNode && targetNode.type === "page_ref") {
            const remaining = store.edges.filter(
              (edge) => edge.target === targetNode.id && edge.id !== existingEdge.id,
            );
            if (remaining.length === 0) store.deleteNode(targetNode.id);
          }
        }
      }
    }

    if (onUpdateSections) {
      onUpdateSections(sections.filter((s) => s.id !== secId));
    }
  };

  const handleDeleteActionFromSection = (secId: string, actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useBackendCanvasStore.getState();
    const existingEdge = store.edges.find(
      (edge) =>
        edge.source === nodeId && edge.sourceHandle === `events-${actionId}`,
    );
    if (existingEdge) {
      const targetNode = store.nodes.find((n) => n.id === existingEdge.target);
      store.deleteEdge(existingEdge.id);
      if (targetNode && targetNode.type === "page_ref") {
        const remaining = store.edges.filter(
          (edge) => edge.target === targetNode.id && edge.id !== existingEdge.id,
        );
        if (remaining.length === 0) store.deleteNode(targetNode.id);
      }
    }

    if (!onUpdateSections) return;
    const updated = sections.map((s) => {
      if (s.id !== secId) return s;
      return { ...s, actions: (s.actions || []).filter((a) => a.id !== actionId) };
    });
    onUpdateSections(updated);
  };

  const getEventIcon = (evtStr?: string) => {
    const evt = (evtStr || "click").toLowerCase();
    if (evt === "sse") return <Radio size={10} className="text-muted-foreground" />;
    if (evt === "websocket" || evt === "ws") return <Wifi size={10} className="text-muted-foreground" />;
    if (evt === "webrtc") return <Video size={10} className="text-muted-foreground" />;
    if (evt === "polling") return <RefreshCw size={10} className="text-muted-foreground" />;
    if (evt === "pageload") return <Zap size={10} className="text-muted-foreground" />;
    if (evt === "navigatetopage") return <Compass size={10} className="text-muted-foreground" />;
    if (evt === "submit") return <Send size={10} className="text-muted-foreground" />;
    if (evt === "change" || evt === "input") return <Sliders size={10} className="text-muted-foreground" />;
    return <MousePointerClick size={10} className="text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl bg-secondary/15 border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-secondary text-foreground border border-border/50">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">Page Sections & Components</span>
            <span className="text-[11px] text-muted-foreground">
              Modular components compiled into <code className="font-mono text-foreground/80">_components/</code>
            </span>
          </div>
        </div>

        <Button
          size="sm"
          className="h-7 text-xs font-medium gap-1"
          onClick={() => onAddSection()}
        >
          <Plus size={12} /> Add Section
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        {sections.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-border/70 text-center flex flex-col items-center gap-2.5 bg-secondary/10">
            <div className="p-2.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
              <Layers size={18} />
            </div>
            <span className="text-xs font-medium text-foreground">
              No sections defined for this page yet
            </span>
            <span className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
              Create modular page sections to separate UI components, manage render modes, and declare interactive actions.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1 mt-1 border-border/60"
              onClick={() => onAddSection("MainSection")}
            >
              <Plus size={12} /> Add Main Section
            </Button>
          </div>
        ) : (
          sections.map((sec) => {
            const isExpanded = !isSectionCollapsed(nodeId, sec.id);
            const actionsList = sec.actions || [];

            return (
              <div
                key={sec.id}
                className="flex flex-col rounded-xl border border-border/50 bg-secondary/20 overflow-hidden transition-all"
              >
                {/* Section Header Row */}
                <div
                  className="p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-secondary/40 transition-colors"
                  onClick={() => toggleExpand(sec.id)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-foreground font-mono truncate">
                          {sec.name || "Section"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({actionsList.length} action{actionsList.length === 1 ? "" : "s"})
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <FileCode size={10} className="text-muted-foreground" />
                        _components/{sec.name || "Section"}.tsx
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Render Mode Badge */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleRenderMode(sec.id, e)}
                      className={cn(
                        "text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1",
                        sec.renderMode === "client"
                          ? "bg-secondary text-sky-400 border-border/60"
                          : "bg-secondary text-emerald-400 border-border/60",
                      )}
                      title="Click to toggle Server / Client mode"
                    >
                      {sec.renderMode === "client" ? (
                        <>
                          <Activity size={10} /> client
                        </>
                      ) : (
                        <>
                          <Shield size={10} /> server (RSC)
                        </>
                      )}
                    </button>

                    {/* Load Strategy Badge */}
                    <button
                      type="button"
                      onClick={(e) => handleCycleLoadStrategy(sec.id, e)}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border/50 bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Click to cycle load strategy: eager -> dynamic -> dynamic-no-ssr"
                    >
                      {sec.loadStrategy || "eager"}
                    </button>

                    {/* Add Action shortcut */}
                    <button
                      type="button"
                      onClick={(e) => handleAddActionToSection(sec.id, e)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Add Action to this section"
                    >
                      <Plus size={13} />
                    </button>

                    {/* Configure Section Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveConfigItem({
                          type: "pageSection",
                          id: sec.id,
                          nodeId,
                        })
                      }
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Open Section Configuration Drawer"
                    >
                      <Settings size={13} />
                    </button>

                    {/* Delete Section */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSectionToDelete({ id: sec.id, name: sec.name || "Untitled" });
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="Delete Section"
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                </div>

                {/* Section Expanded Actions List */}
                {isExpanded && (
                  <div className="p-3 border-t border-border/40 bg-secondary/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Actions ({actionsList.length})
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleAddActionToSection(sec.id, e)}
                        className="text-[10px] text-muted-foreground hover:text-foreground font-mono flex items-center gap-1"
                      >
                        <Plus size={10} /> Add Action
                      </button>
                    </div>

                    {actionsList.length === 0 ? (
                      <div className="p-3 text-center text-[11px] text-muted-foreground/70 italic bg-secondary/20 rounded-lg">
                        No actions yet. Click &quot;+ Add Action&quot; or open section configuration.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {actionsList.map((act) => (
                          <div
                            key={act.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40 text-xs hover:border-border/70 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {getEventIcon(act.event)}
                              <span className="font-mono text-[11px] font-medium text-foreground truncate">
                                {act.name || "action"}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[9px] font-mono py-0 bg-secondary/40 text-muted-foreground border-border/40"
                              >
                                {act.event || "click"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setActiveConfigItem({
                                    type: "pageEvent",
                                    id: act.id,
                                    nodeId,
                                    sectionId: sec.id,
                                  })
                                }
                              >
                                Edit
                              </Button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionToDelete({ secId: sec.id, actId: act.id, name: act.name || "action" });
                                }}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                title="Delete Action"
                              >
                                <Trash size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete Section Dialog */}
      {sectionToDelete && (
        <NodeDeletionDialog
          open={!!sectionToDelete}
          onOpenChange={(open) => !open && setSectionToDelete(null)}
          deletionTarget={{
            type: "section",
            nodeId,
            section: sections.find((s) => s.id === sectionToDelete.id) || {
              id: sectionToDelete.id,
              name: sectionToDelete.name,
            },
            onConfirm: () => {
              const fakeEvent = { stopPropagation: () => {} } as unknown as React.MouseEvent;
              handleDeleteSection(sectionToDelete.id, fakeEvent);
              setSectionToDelete(null);
            },
          }}
        />
      )}

      {/* Delete Action Dialog */}
      {actionToDelete && (
        <NodeDeletionDialog
          open={!!actionToDelete}
          onOpenChange={(open) => !open && setActionToDelete(null)}
          deletionTarget={{
            type: "action",
            nodeId,
            sectionId: actionToDelete.secId,
            action: {
              id: actionToDelete.actId,
              name: actionToDelete.name,
            },
            onConfirm: () => {
              const fakeEvent = { stopPropagation: () => {} } as unknown as React.MouseEvent;
              handleDeleteActionFromSection(actionToDelete.secId, actionToDelete.actId, fakeEvent);
              setActionToDelete(null);
            },
          }}
        />
      )}
    </div>
  );
}
