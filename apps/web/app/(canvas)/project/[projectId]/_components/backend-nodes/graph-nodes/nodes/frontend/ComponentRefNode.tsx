"use client";

import React from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import { Layout, Settings2, Trash2 } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";

export const ComponentRefNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const edges = useBackendCanvasStore((s) => s.edges);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  // Collect available component nodes on canvas (global components or local components for this webApp)
  const availableComponents = useBackendCanvasStore(
    useShallow((s) =>
      s.nodes.filter(
        (n) =>
          n?.type === "component" &&
          (n.data?.scope !== "local" || !data.targetWebAppId || n.data?.targetWebAppId === data.targetWebAppId),
      ),
    ),
  );

  const selectedMaster = React.useMemo(() => {
    if (!data.componentRef) return undefined;
    return availableComponents.find(
      (c) =>
        c.id === data.componentRef ||
        c.data?.componentName === data.componentRef ||
        c.data?.label === data.componentRef,
    );
  }, [availableComponents, data.componentRef]);

  // Ensure reference edge exists between master component and this ref node
  React.useEffect(() => {
    if (!selectedMaster?.id) return;
    const exists = edges.some(
      (e) =>
        (e.type === "reference" || e.type === "connection") &&
        e.source === selectedMaster.id &&
        e.target === id,
    );
    if (!exists) {
      addEdge({
        id: `edge-comp-ref-${selectedMaster.id}-${id}`,
        source: selectedMaster.id,
        target: id,
        sourceHandle: "component-out",
        targetHandle: "component-in",
        type: "reference",
      });
    }
  }, [selectedMaster?.id, id, edges, addEdge]);

  const handleMasterChange = (masterId: string) => {
    const master = availableComponents.find((c) => c.id === masterId);
    const compName =
      master?.data?.componentName || master?.data?.label || "ComponentRef";

    // Clean up old reference edges
    edges
      .filter(
        (e) =>
          (e.type === "reference" || e.type === "connection") &&
          e.target === id &&
          e.source !== masterId,
      )
      .forEach((e) => deleteEdge(e.id));

    updateNode(id, {
      data: {
        ...data,
        componentRef: masterId,
        label: `${compName} (Ref)`,
      },
    });

    if (masterId) {
      const exists = edges.some(
        (e) =>
          (e.type === "reference" || e.type === "connection") &&
          e.source === masterId &&
          e.target === id,
      );
      if (!exists) {
        addEdge({
          id: `edge-comp-ref-${masterId}-${id}`,
          source: masterId,
          target: id,
          sourceHandle: "component-out",
          targetHandle: "component-in",
          type: "reference",
        });
      }
    }
  };

  const handleOpenConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedMaster) {
      setActiveConfigItem({
        id: selectedMaster.id,
        nodeId: selectedMaster.id,
        type: "component",
      });
    } else {
      setActiveConfigItem({
        id,
        nodeId: id,
        type: "component_ref",
      });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode(id);
  };

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-card/95 backdrop-blur border-2 min-w-[220px] max-w-[280px] shadow-md transition-all duration-150 cursor-pointer select-none",
        selected
          ? "border-indigo-500 shadow-indigo-500/15 ring-1 ring-indigo-500/20"
          : "border-border/80 hover:border-indigo-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Target handle on left */}
      <Handle
        type="target"
        position={Position.Left}
        id="component-in"
        className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background"
      />

      {/* Icon + Dropdown */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
          <Layout size={14} />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[8px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
              Component Ref
            </span>
            <span className="text-[7px] font-mono px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-500 font-medium">
              REF
            </span>
          </div>

          <Select
            value={selectedMaster?.id || data.componentRef || ""}
            onValueChange={handleMasterChange}
          >
            <SelectTrigger className="h-6 text-xs px-2 py-0 bg-background/80 border-border/80 truncate">
              <SelectValue placeholder="Select component..." />
            </SelectTrigger>
            <SelectContent>
              {availableComponents.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.data?.componentName || c.data?.label || "Component"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
          onClick={handleOpenConfig}
          title="Configure Component"
        >
          <Settings2 size={13} />
        </button>
        <button
          className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={handleDelete}
          title="Delete Node"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Outgoing handle on right */}
      <Handle
        type="source"
        position={Position.Right}
        id="component-out"
        className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background"
      />
    </div>
  );
};
