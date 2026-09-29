import React, { useState, useEffect, useMemo } from "react";
import {
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  Connection,
} from "@xyflow/react";
import { Trash, Link2, AlertCircle, Database } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type {
  LangGraphMemoryRefNode,
  LangGraphCanvasNode,
  MemoryNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_MEMORY,
  LANGGRAPH_CANVAS_NODE_MEMORY_REF,
  HANDLE_MEMORY_IN,
  HANDLE_MEMORY_OUT,
} from "../constants";
import { LocalInput } from "../../../common";

export const LangGraphCanvasMemoryRefNode = ({
  id,
  data,
  selected,
}: NodeProps<LangGraphMemoryRefNode>) => {
  const { setNodes, getNodes } = useReactFlow<LangGraphCanvasNode>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.label || "Memory Ref");

  useEffect(() => {
    setNameValue(data.label || "Memory Ref");
  }, [data.label]);

  const allNodes = getNodes();
  const availableMasterMemories = useMemo(() => {
    return allNodes.filter(
      (n): n is MemoryNode => n.type === LANGGRAPH_CANVAS_NODE_MEMORY,
    );
  }, [allNodes]);

  const selectedMaster = useMemo(() => {
    if (!data.memoryRef) return undefined;
    return availableMasterMemories.find((m) => m.id === data.memoryRef);
  }, [availableMasterMemories, data.memoryRef]);

  const updateMemoryRefData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id && n.type === LANGGRAPH_CANVAS_NODE_MEMORY_REF
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim() || "Memory Ref";
    setNameValue(trimmed);
    if (trimmed !== data.label) {
      updateMemoryRefData({ label: trimmed });
    }
  };

  const handleSelectMaster = (masterId: string) => {
    const master = availableMasterMemories.find((m) => m.id === masterId);
    const masterLabel = master?.data?.name || master?.data?.label || "Memory";
    updateMemoryRefData({
      memoryRef: masterId,
      label: `${masterLabel} (Ref)`,
    });
    setNameValue(`${masterLabel} (Ref)`);
  };

  const activeCheckpointer = selectedMaster?.data?.checkpointer || "unconfigured";

  return (
    <div
      className={`rounded-xl bg-card border-2 min-w-[280px] max-w-[340px] p-3 flex flex-col gap-2.5 transition-all duration-200 shadow-md relative group ${
        selected
          ? "border-amber-500 ring-2 ring-amber-500/20 shadow-amber-500/10"
          : "border-border hover:border-amber-500/40 hover:shadow-amber-500/5"
      }`}
    >
      {/* Output Handle to connect to agent nodes */}
      <Handle
        type="source"
        position={Position.Bottom}
        id={HANDLE_MEMORY_OUT}
        style={{ left: "50%" }}
        isValidConnection={(connection: Connection) =>
          connection.targetHandle === HANDLE_MEMORY_IN
        }
        className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-bottom-[7px]"
        title="Connect to Agent Memory"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 -mx-3 -mt-3 border-b border-border/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-1 rounded-md border border-amber-500/30 bg-amber-500/15 text-amber-500 shrink-0">
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
                      setNameValue(data.label || "Memory Ref");
                      setIsEditingName(false);
                    }
                  }}
                />
              </div>
            ) : (
              <span
                className="font-bold text-xs text-foreground truncate max-w-[140px] cursor-pointer hover:text-amber-400 transition-colors nodrag"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                title="Click to rename Memory Ref"
              >
                {data.label || "Memory Ref"}
              </span>
            )}
            <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[8px] uppercase font-bold">
                REF
              </span>
              <span>{data.refId || id}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedMaster && (
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
              {activeCheckpointer.toUpperCase()}
            </span>
          )}
          {data.onDeleteMemoryRef && (
            <button
              type="button"
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100 nodrag"
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteMemoryRef?.();
              }}
              title="Delete Memory Ref"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Master Memory Picker */}
      <div className="flex flex-col gap-1 nodrag">
        <label className="text-[9px] font-medium text-muted-foreground flex items-center justify-between">
          <span>Referenced Memory / DB</span>
          {selectedMaster && (
            <span className="text-amber-400 font-mono text-[9px]">
              {selectedMaster.id}
            </span>
          )}
        </label>

        {availableMasterMemories.length > 0 ? (
          <Select
            value={data.memoryRef || ""}
            onValueChange={handleSelectMaster}
          >
            <SelectTrigger className="h-7 text-[10px] bg-background border border-border/60 rounded px-2 font-medium text-foreground nodrag">
              <SelectValue placeholder="Select Master Memory..." />
            </SelectTrigger>
            <SelectContent className="nodrag">
              {availableMasterMemories.map((master) => (
                <SelectItem key={master.id} value={master.id}>
                  <div className="flex items-center gap-2">
                    <Database className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="font-semibold text-foreground">
                      {master.data?.name || master.data?.label || master.id}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      ({master.data?.checkpointer || "memory"} - {master.data?.threadIdKey || "thread_id"})
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
              No master Memory on canvas. Add a <strong>Memory config</strong> node first.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
