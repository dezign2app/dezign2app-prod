import React, { useState, useEffect, useMemo } from "react";
import {
  NodeProps,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { Trash, Link2, RotateCcw, Crosshair, Bot, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Button } from "@workspace/ui/components/button";
import type {
  LangGraphAgentRefNode,
  LangGraphCanvasNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_AGENT_REF,
  LANGGRAPH_CANVAS_NODE_NODE_REF,
  LANGGRAPH_CANVAS_NODE_NODE,
  LANGGRAPH_CANVAS_NODE_AGENT,
  LANGGRAPH_CANVAS_NODE_STEP,
} from "../constants";
import { LocalInput } from "../../../common";

export const LangGraphCanvasAgentRefNode = ({
  id,
  data,
  selected,
}: NodeProps<LangGraphAgentRefNode>) => {
  const { setNodes, getNodes, setEdges, fitView } = useReactFlow<LangGraphCanvasNode>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.label || "Agent Ref");

  useEffect(() => {
    setNameValue(data.label || "Agent Ref");
  }, [data.label]);

  const allNodes = getNodes();
  const availableMasterAgents = useMemo(() => {
    return allNodes.filter(
      (n) =>
        n.id !== id &&
        (n.type === LANGGRAPH_CANVAS_NODE_NODE ||
          n.type === LANGGRAPH_CANVAS_NODE_AGENT ||
          n.type === LANGGRAPH_CANVAS_NODE_STEP),
    );
  }, [allNodes, id]);

  const activeRefId = data.agentRef || data.nodeRef;

  const selectedMaster = useMemo(() => {
    if (!activeRefId) return undefined;
    return availableMasterAgents.find((m) => m.id === activeRefId);
  }, [availableMasterAgents, activeRefId]);

  const updateAgentRefData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id &&
        (n.type === LANGGRAPH_CANVAS_NODE_AGENT_REF ||
          n.type === LANGGRAPH_CANVAS_NODE_NODE_REF)
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim() || "Agent Ref";
    setNameValue(trimmed);
    if (trimmed !== data.label) {
      updateAgentRefData({ label: trimmed });
    }
  };

  // Ensure reference edge from master node to this ref node (visible when selected)
  useEffect(() => {
    if (!selectedMaster?.id) {
      setEdges((eds) => {
        const hasRef = eds.some(
          (e) => e.type === "langgraph-reference" && e.target === id,
        );
        if (!hasRef) return eds;
        return eds.filter(
          (e) => !(e.type === "langgraph-reference" && e.target === id),
        );
      });
      return;
    }

    const refEdgeId = `edge-agent-ref-link-${selectedMaster.id}-${id}`;
    setEdges((eds) => {
      const existingRefEdges = eds.filter(
        (e) => e.type === "langgraph-reference" && e.target === id,
      );

      if (
        existingRefEdges.length === 1 &&
        existingRefEdges[0]?.id === refEdgeId &&
        existingRefEdges[0]?.source === selectedMaster.id
      ) {
        return eds;
      }

      const cleanEdges = eds.filter(
        (e) => !(e.type === "langgraph-reference" && e.target === id),
      );

      return [
        ...cleanEdges,
        {
          id: refEdgeId,
          source: selectedMaster.id,
          target: id,
          type: "langgraph-reference",
          hidden: true,
          data: {},
        },
      ];
    });
  }, [selectedMaster?.id, id, setEdges]);

  const handleSelectMaster = (masterId: string) => {
    const master = availableMasterAgents.find((m) => m.id === masterId);
    const masterLabel =
      (master?.data as { name?: string; label?: string })?.name ||
      (master?.data as { label?: string })?.label ||
      "Agent";

    setEdges((eds) =>
      eds.filter(
        (e) => !(e.type === "langgraph-reference" && e.target === id),
      ),
    );

    const newLabel = `↩ ${masterLabel} (Ref)`;
    updateAgentRefData({
      agentRef: masterId,
      nodeRef: masterId,
      label: newLabel,
    });
    setNameValue(newLabel);
  };

  const handleFocusMaster = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedMaster?.id) return;
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === selectedMaster.id,
      })),
    );
    fitView({
      nodes: [{ id: selectedMaster.id }],
      duration: 350,
      padding: 0.3,
      maxZoom: 1,
    });
  };

  const handleDelete = () => {
    if (data.onDeleteAgentRef) {
      data.onDeleteAgentRef();
    } else {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) =>
        eds.filter((e) => e.source !== id && e.target !== id),
      );
    }
  };

  const loopWarning = data.loopWarning;

  return (
    <div
      className={`rounded-xl bg-card border-2 min-w-[280px] max-w-[340px] p-3 flex flex-col gap-2.5 transition-all duration-200 shadow-md relative group ${
        loopWarning
          ? selected
            ? "border-amber-500 ring-2 ring-amber-500/40 shadow-amber-500/20"
            : "border-amber-500/70 hover:border-amber-500 ring-1 ring-amber-500/30 shadow-amber-500/10"
          : selected
            ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-indigo-500/10"
            : "border-border hover:border-indigo-500/40 hover:shadow-indigo-500/5"
      }`}
    >
      {/* Inbound Handle on Left to receive incoming flow loops */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        style={{ top: "50%" }}
        className={`!w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-left-[7px] z-10 ${
          loopWarning
            ? "!bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
            : "!bg-indigo-500"
        }`}
        title={
          loopWarning
            ? `Loop Target: ${loopWarning.message}`
            : "Loop Target: Incoming execution returns to referenced node"
        }
      />

      {/* Header */}
      <div
        className={`flex items-center justify-between gap-2 p-3 -mx-3 -mt-3 border-b rounded-t-xl transition-colors ${
          loopWarning
            ? "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "border-border/50 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`p-1 rounded-md border shrink-0 ${
              loopWarning
                ? "border-amber-500/40 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                : "border-indigo-500/30 bg-indigo-500/15 text-indigo-500"
            }`}
          >
            {loopWarning ? (
              <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
          </div>
          {isEditingName ? (
            <LocalInput
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave();
                if (e.key === "Escape") {
                  setIsEditingName(false);
                  setNameValue(data.label || "Agent Ref");
                }
              }}
              className="h-6 text-xs font-semibold px-1 py-0 bg-background/80"
              autoFocus
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingName(true)}
              className="font-semibold text-xs tracking-tight truncate cursor-pointer hover:underline"
              title="Double click to rename"
            >
              {nameValue}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {loopWarning ? (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-800 dark:text-amber-200 font-semibold flex items-center gap-1 border border-amber-500/40 shadow-sm"
              title={loopWarning.message}
            >
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
              <span>
                {loopWarning.type === "dead_end_cycle"
                  ? "Infinite Loop"
                  : loopWarning.type === "unconditional_cycle"
                  ? "Unconditional Loop"
                  : "Loop Warning"}
              </span>
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium">
              Loop Ref
            </span>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="p-1 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
            title="Delete Ref Node"
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Master Node Binding Selector */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
          <span className="flex items-center gap-1">
            <Link2 className={`w-3 h-3 ${loopWarning ? "text-amber-500" : "text-indigo-500"}`} />
            <span>Target Node:</span>
          </span>
          {selectedMaster && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFocusMaster}
              className={`h-5 px-1.5 text-[10px] gap-1 font-mono ${
                loopWarning
                  ? "text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:bg-amber-500/10"
                  : "text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
              }`}
              title="Jump to target master node"
            >
              <Crosshair className="w-3 h-3" />
              <span>Jump to Node</span>
            </Button>
          )}
        </div>

        <Select
          value={activeRefId || ""}
          onValueChange={handleSelectMaster}
        >
          <SelectTrigger
            className={`h-8 text-xs bg-muted/30 border-border/60 ${
              loopWarning
                ? "border-amber-500/50 hover:border-amber-500 focus:ring-amber-500/30"
                : "hover:border-indigo-500/40"
            }`}
          >
            <SelectValue placeholder="Select target node to loop back to..." />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            {availableMasterAgents.map((master) => {
              const label =
                (master.data as { name?: string; label?: string })?.name ||
                (master.data as { label?: string })?.label ||
                master.id;
              const typeLabel =
                master.type === LANGGRAPH_CANVAS_NODE_STEP
                  ? "Step"
                  : master.type === LANGGRAPH_CANVAS_NODE_AGENT ||
                    master.type === LANGGRAPH_CANVAS_NODE_NODE
                  ? "Agent"
                  : "Node";
              return (
                <SelectItem key={master.id} value={master.id} className="text-xs">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-medium truncate">{label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground opacity-70">
                      [{typeLabel}]
                    </span>
                  </div>
                </SelectItem>
              );
            })}
            {availableMasterAgents.length === 0 && (
              <div className="p-2 text-xs text-muted-foreground text-center">
                No agent or step nodes available
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Loop Warning Alert Callout */}
      {loopWarning && (
        <div className="flex flex-col gap-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] tracking-tight">
              {loopWarning.type === "dead_end_cycle"
                ? "Infinite Loop (No Path to END)"
                : loopWarning.type === "unconditional_cycle"
                ? "Unconditional Loop"
                : "Self-Loop Detected"}
            </span>
          </div>
          <p className="text-[10px] text-amber-800/90 dark:text-amber-200/90 leading-relaxed font-sans break-words">
            {loopWarning.message}
          </p>
          {selectedMaster && (
            <div className="mt-0.5 pt-1 border-t border-amber-500/20 flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-300/80">
              <span>Exit condition needed</span>
              <button
                type="button"
                onClick={handleFocusMaster}
                className="underline hover:text-amber-600 dark:hover:text-amber-200 font-medium flex items-center gap-0.5"
              >
                <span>Inspect target</span>
                <Crosshair className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Helper Footer */}
      <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground/80 border-t border-border/40 font-mono">
        <Bot className={`w-3 h-3 shrink-0 ${loopWarning ? "text-amber-500" : "text-indigo-400"}`} />
        <span className="truncate">
          {selectedMaster
            ? `Loops back to "${(selectedMaster.data as { name?: string; label?: string })?.name || (selectedMaster.data as { label?: string })?.label || selectedMaster.id}"`
            : "Connect loop return without crossing lines"}
        </span>
      </div>
    </div>
  );
};
