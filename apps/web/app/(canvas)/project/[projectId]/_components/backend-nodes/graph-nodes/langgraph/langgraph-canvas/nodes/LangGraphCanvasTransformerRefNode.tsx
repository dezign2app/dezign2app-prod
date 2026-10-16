import React, { useState, useEffect, useMemo } from "react";
import {
  NodeProps,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { Trash, Link2, Shuffle, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type {
  TransformerRefCanvasNode,
  TransformerCanvasNode,
  LangGraphCanvasNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_TRANSFORMER,
  LANGGRAPH_CANVAS_NODE_TRANSFORMER_REF,
  HANDLE_TRANSFORMER_OUT,
} from "../constants";
import { LocalInput } from "../../../common";

export const LangGraphCanvasTransformerRefNode = ({
  id,
  data,
  selected,
}: NodeProps<TransformerRefCanvasNode>) => {
  const { setNodes, getNodes, setEdges } = useReactFlow<LangGraphCanvasNode>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.label || "Transformer Ref");

  useEffect(() => {
    setNameValue(data.label || "Transformer Ref");
  }, [data.label]);

  const allNodes = getNodes();
  const availableMasterTransformers = useMemo(() => {
    return allNodes.filter(
      (n): n is TransformerCanvasNode =>
        n.type === LANGGRAPH_CANVAS_NODE_TRANSFORMER,
    );
  }, [allNodes]);

  const selectedMaster = useMemo(() => {
    if (!data.transformerRef) return undefined;
    return availableMasterTransformers.find((m) => m.id === data.transformerRef);
  }, [availableMasterTransformers, data.transformerRef]);

  const updateTransformerRefData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id && n.type === LANGGRAPH_CANVAS_NODE_TRANSFORMER_REF
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim() || "Transformer Ref";
    setNameValue(trimmed);
    if (trimmed !== data.label) {
      updateTransformerRefData({ label: trimmed });
    }
  };

  const handleDelete = () => {
    if (data.onDeleteTransformerRef) {
      data.onDeleteTransformerRef();
    } else {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    }
  };

  return (
    <div
      className={`rounded-xl bg-card border-2 min-w-[240px] max-w-[320px] flex flex-col transition-all duration-200 shadow-md relative group ${
        selected
          ? "border-purple-500 ring-2 ring-purple-500/20 shadow-purple-500/10"
          : "border-border hover:border-purple-500/40 hover:shadow-purple-500/5"
      }`}
    >
      <Handle
        type="source"
        position={Position.Right}
        id={HANDLE_TRANSFORMER_OUT}
        className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-right-[7px] z-10"
        title="Connect to Agent Node or Step (transformer_in)"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border/50 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-1 rounded-md border border-purple-500/30 bg-purple-500/15 text-purple-400 shrink-0">
            <Shuffle className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            {isEditingName ? (
              <div
                className="nodrag"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <LocalInput
                  autoFocus
                  className="h-6 text-xs bg-background p-1 font-bold font-mono text-purple-400 flex-1 nodrag"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleNameSave();
                    if (e.key === "Escape") {
                      setNameValue(data.label || "Transformer Ref");
                      setIsEditingName(false);
                    }
                  }}
                />
              </div>
            ) : (
              <span
                className="font-bold text-sm text-foreground truncate max-w-[130px] font-mono cursor-pointer hover:text-purple-400 transition-colors nodrag flex items-center gap-1 group/title"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                title="Click to rename reference"
              >
                <span className="truncate">{data.label || "Transformer Ref"}</span>
              </span>
            )}
            <span className="text-[9px] font-mono text-muted-foreground truncate opacity-70 flex items-center gap-1">
              <Link2 className="w-2.5 h-2.5" /> Reusable Reference
            </span>
          </div>
        </div>

        <button
          type="button"
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100 nodrag cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          title="Delete Reference"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body / Selector */}
      <div className="p-3 flex flex-col gap-2 nodrag">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Master Transformer
        </label>
        <Select
          value={data.transformerRef || ""}
          onValueChange={(val) => {
            const master = availableMasterTransformers.find((m) => m.id === val);
            const masterLabel = master?.data.label || master?.data.functionName || "Transformer";
            updateTransformerRefData({
              transformerRef: val,
              label: `↩ ${masterLabel} (Ref)`,
            });
            setNameValue(`↩ ${masterLabel} (Ref)`);
          }}
        >
          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
            <SelectValue placeholder="Select a transformer..." />
          </SelectTrigger>
          <SelectContent className="z-50">
            {availableMasterTransformers.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                No master transformers on canvas
              </div>
            ) : (
              availableMasterTransformers.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-3 h-3 text-purple-400" />
                    <span>{m.data.label || m.data.functionName || m.id}</span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {selectedMaster && (
          <span className="text-[10px] font-mono text-muted-foreground/80 truncate">
            Bound to: <span className="text-purple-400 font-medium">{selectedMaster.data.label || selectedMaster.data.functionName}</span>
          </span>
        )}
      </div>
    </div>
  );
};
