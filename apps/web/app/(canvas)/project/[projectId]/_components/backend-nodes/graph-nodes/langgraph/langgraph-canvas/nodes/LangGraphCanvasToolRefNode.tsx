import React, { useState, useEffect, useMemo } from "react";
import {
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  Connection,
} from "@xyflow/react";
import { Trash, Link2, AlertCircle, Wrench } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type {
  LangGraphToolRefNode,
  LangGraphCanvasNode,
  ToolNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_TOOL,
  LANGGRAPH_CANVAS_NODE_TOOL_REF,
  HANDLE_TOOL_IN,
  HANDLE_TOOL_OUT,
} from "../constants";
import { LocalInput } from "../../../common";

export const LangGraphCanvasToolRefNode = ({
  id,
  data,
  selected,
}: NodeProps<LangGraphToolRefNode>) => {
  const { setNodes, getNodes, setEdges } = useReactFlow<LangGraphCanvasNode>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.label || "Tool Ref");

  useEffect(() => {
    setNameValue(data.label || "Tool Ref");
  }, [data.label]);

  const allNodes = getNodes();
  const availableMasterTools = useMemo(() => {
    return allNodes.filter(
      (n): n is ToolNode => n.type === LANGGRAPH_CANVAS_NODE_TOOL,
    );
  }, [allNodes]);

  const selectedMaster = useMemo(() => {
    if (!data.toolRef) return undefined;
    return availableMasterTools.find((m) => m.id === data.toolRef);
  }, [availableMasterTools, data.toolRef]);

  const updateToolRefData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id && n.type === LANGGRAPH_CANVAS_NODE_TOOL_REF
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim() || "Tool Ref";
    setNameValue(trimmed);
    if (trimmed !== data.label) {
      updateToolRefData({ label: trimmed });
    }
  };

  const handleSelectMaster = (masterId: string) => {
    const master = availableMasterTools.find((m) => m.id === masterId);
    const masterLabel = master?.data?.name || master?.data?.label || "Tool";
    updateToolRefData({
      toolRef: masterId,
      label: `${masterLabel} (Ref)`,
    });
    setNameValue(`${masterLabel} (Ref)`);
  };

  const handleDelete = () => {
    if (data.onDeleteToolRef) {
      data.onDeleteToolRef();
    } else {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    }
  };

  const activeSource = selectedMaster?.data?.source || "unconfigured";

  return (
    <div
      className={`rounded-xl bg-card border-2 min-w-[280px] max-w-[340px] p-3 flex flex-col gap-2.5 transition-all duration-200 shadow-md relative group ${
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/10"
          : "border-border hover:border-emerald-500/40 hover:shadow-emerald-500/5"
      }`}
    >
      {/* Output Handle to connect to step/agent nodes */}
      <Handle
        type="source"
        position={Position.Bottom}
        id={HANDLE_TOOL_OUT}
        style={{ left: "50%" }}
        isValidConnection={(connection: Connection) =>
          connection.targetHandle === HANDLE_TOOL_IN
        }
        className="!bg-emerald-500 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-bottom-[7px]"
        title="Connect to Agent or Step tools"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 -mx-3 -mt-3 border-b border-border/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-emerald-500 shrink-0">
            <Link2 className="w-4 h-4" />
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
                  className="h-6 text-xs bg-background p-1 font-bold flex-1 nodrag"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleNameSave();
                    if (e.key === "Escape") {
                      setNameValue(data.label || "Tool Ref");
                      setIsEditingName(false);
                    }
                  }}
                />
              </div>
            ) : (
              <span
                className="font-bold text-xs text-foreground truncate max-w-[140px] cursor-pointer hover:text-emerald-400 transition-colors nodrag"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                title="Click to rename Tool Ref"
              >
                {data.label || "Tool Ref"}
              </span>
            )}
            <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
              <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[8px] uppercase font-bold">
                REF
              </span>
              <span>{data.refId || id}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedMaster && (
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
              {activeSource.toUpperCase()}
            </span>
          )}
          <button
            type="button"
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100 nodrag"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            title="Delete Tool Ref"
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Master Tool Picker */}
      <div className="flex flex-col gap-1 nodrag">
        <label className="text-[9px] font-medium text-muted-foreground flex items-center justify-between">
          <span>Referenced Tool</span>
          {selectedMaster && (
            <span className="text-emerald-400 font-mono text-[9px]">
              {selectedMaster.id}
            </span>
          )}
        </label>

        {availableMasterTools.length > 0 ? (
          <Select
            value={data.toolRef || ""}
            onValueChange={handleSelectMaster}
          >
            <SelectTrigger className="h-7 text-[10px] bg-background border border-border/60 rounded px-2 font-medium text-foreground nodrag">
              <SelectValue placeholder="Select Master Tool..." />
            </SelectTrigger>
            <SelectContent className="nodrag">
              {availableMasterTools.map((master) => (
                <SelectItem key={master.id} value={master.id}>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-foreground">
                      {master.data?.name || master.data?.label || master.id}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      ({master.data?.source || "inline"} - {master.data?.returnType || "string"})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              No master Tool on canvas. Add a <strong>Tool</strong> node first.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
