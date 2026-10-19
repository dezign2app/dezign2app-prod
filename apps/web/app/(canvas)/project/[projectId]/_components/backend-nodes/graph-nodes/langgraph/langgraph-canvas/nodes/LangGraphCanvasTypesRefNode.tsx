import React, { useState, useEffect, useMemo } from "react";
import {
  NodeProps,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { Trash, Link2, AlertCircle, Braces } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Button } from "@workspace/ui/components/button";
import type {
  LangGraphTypesRefNode,
  LangGraphCanvasNode,
  LangGraphTypesNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_TYPES,
  LANGGRAPH_CANVAS_NODE_TYPES_REF,
  HANDLE_TYPES_IN,
  HANDLE_TYPES_OUT,
} from "../constants";
import { LocalInput } from "../../../common";

export const LangGraphCanvasTypesRefNode = ({
  id,
  data,
  selected,
}: NodeProps<LangGraphTypesRefNode>) => {
  const { setNodes, getNodes, setEdges } = useReactFlow<LangGraphCanvasNode>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.label || "Types Ref");

  useEffect(() => {
    setNameValue(data.label || "Types Ref");
  }, [data.label]);

  const allNodes = getNodes();
  const availableMasterTypes = useMemo(() => {
    return allNodes.filter(
      (n): n is LangGraphTypesNode => n.type === LANGGRAPH_CANVAS_NODE_TYPES,
    );
  }, [allNodes]);

  const selectedMaster = useMemo(() => {
    if (!data.typesRef) return undefined;
    return availableMasterTypes.find((m) => m.id === data.typesRef);
  }, [availableMasterTypes, data.typesRef]);

  const updateTypesRefData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id && n.type === LANGGRAPH_CANVAS_NODE_TYPES_REF
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim() || "Types Ref";
    setNameValue(trimmed);
    if (trimmed !== data.label) {
      updateTypesRefData({ label: trimmed });
    }
  };

  // Ensure reference edge from master Types node to this ref node
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

    const refEdgeId = `edge-types-ref-link-${selectedMaster.id}-${id}`;
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
          style: {
            stroke: "#06b6d4",
            strokeWidth: 1.5,
            strokeDasharray: "4, 4",
            opacity: 0.6,
          },
          animated: false,
        },
      ];
    });
  }, [selectedMaster?.id, id, setEdges]);

  const handleDelete = () => {
    if (data.onDeleteTypesRef) {
      data.onDeleteTypesRef();
    } else {
      setNodes((nodes) => nodes.filter((node) => node.id !== id));
      setEdges((edges) =>
        edges.filter((edge) => edge.source !== id && edge.target !== id),
      );
    }
  };

  const masterTypesCount = selectedMaster?.data?.types?.length ?? 0;

  return (
    <div
      className={`rounded-xl bg-card border-2 min-w-[240px] max-w-[300px] flex flex-col transition-all duration-200 shadow-md relative group ${
        selected
          ? "border-cyan-500 ring-2 ring-cyan-500/20 shadow-cyan-500/10"
          : "border-border hover:border-cyan-500/40 hover:shadow-cyan-500/5"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={HANDLE_TYPES_IN}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-background hover:!scale-125 transition-transform !-left-[6px] z-10"
        title="Connect from master Types node"
      />
      <Handle
        type="source"
        position={Position.Right}
        id={HANDLE_TYPES_OUT}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-background hover:!scale-125 transition-transform !-right-[6px] z-10"
        title="Connect to Agent or State node"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/40 gap-2 bg-muted/20">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Link2 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            {isEditingName ? (
              <LocalInput
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                className="h-6 text-xs px-1.5 py-0 font-medium"
                autoFocus
              />
            ) : (
              <span
                className="text-xs font-semibold truncate cursor-pointer hover:underline text-foreground"
                onDoubleClick={() => setIsEditingName(true)}
                title="Double click to rename"
              >
                {data.label || "Types Ref"}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
              <Braces className="w-2.5 h-2.5 text-cyan-400" />
              Types Reference
            </span>
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleDelete();
          }}
          title="Delete Types Ref"
        >
          <Trash className="w-3 h-3" />
        </Button>
      </div>

      {/* Master Node Selector */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            Target Types Definition
          </span>
          <Select
            value={data.typesRef || ""}
            onValueChange={(val) => {
              const targetMaster = availableMasterTypes.find((m) => m.id === val);
              updateTypesRefData({
                typesRef: val,
                label: targetMaster?.data?.label
                  ? `${targetMaster.data.label} (Ref)`
                  : "Types Ref",
              });
            }}
          >
            <SelectTrigger className="h-7 text-xs bg-secondary/30">
              <SelectValue placeholder="Select Types Node..." />
            </SelectTrigger>
            <SelectContent>
              {availableMasterTypes.length === 0 ? (
                <div className="p-2 text-[11px] text-muted-foreground text-center">
                  No master Types nodes found. Add a Types / Schemas node first.
                </div>
              ) : (
                availableMasterTypes.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                    {m.data.label || m.id} ({m.data.types?.length || 0} types)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Status display */}
        {selectedMaster ? (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-cyan-500/5 border border-cyan-500/20 text-[10px] text-muted-foreground font-mono">
            <span className="truncate max-w-[170px] text-foreground">
              {selectedMaster.data.label || selectedMaster.id}
            </span>
            <span className="text-cyan-400 font-bold">
              {masterTypesCount} {masterTypesCount === 1 ? "type" : "types"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>Unlinked reference. Select a master Types node above.</span>
          </div>
        )}
      </div>
    </div>
  );
};
