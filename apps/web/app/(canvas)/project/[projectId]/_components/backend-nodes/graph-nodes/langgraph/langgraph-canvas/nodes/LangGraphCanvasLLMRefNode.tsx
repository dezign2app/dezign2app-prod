import React, { useState, useEffect, useMemo } from "react";
import {
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  Connection,
} from "@xyflow/react";
import {
  Brain,
  Trash,
  Link2,
  ExternalLink,
  Shield,
  AlertCircle,
  Cpu,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { LangGraphLLMRefNode, LangGraphCanvasNode, LangGraphLLMNode } from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_LLM,
  LANGGRAPH_CANVAS_NODE_LLM_REF,
  HANDLE_LLM_IN,
  HANDLE_LLM_OUT,
} from "../constants";
import { LocalInput } from "../../../common";

export const LangGraphCanvasLLMRefNode = ({
  id,
  data,
  selected,
}: NodeProps<LangGraphLLMRefNode>) => {
  const { setNodes, getNodes } = useReactFlow<LangGraphCanvasNode>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.label || "LLM Ref");

  useEffect(() => {
    setNameValue(data.label || "LLM Ref");
  }, [data.label]);

  const allNodes = getNodes();
  const availableMasterLLMs = useMemo(() => {
    return allNodes.filter(
      (n): n is LangGraphLLMNode => n.type === LANGGRAPH_CANVAS_NODE_LLM,
    );
  }, [allNodes]);

  const selectedMaster = useMemo(() => {
    if (!data.llmRef) return undefined;
    return availableMasterLLMs.find((m) => m.id === data.llmRef);
  }, [availableMasterLLMs, data.llmRef]);

  const updateLLMRefData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id && n.type === LANGGRAPH_CANVAS_NODE_LLM_REF
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim() || "LLM Ref";
    setNameValue(trimmed);
    if (trimmed !== data.label) {
      updateLLMRefData({ label: trimmed });
    }
  };

  const handleSelectMaster = (masterId: string) => {
    const master = availableMasterLLMs.find((m) => m.id === masterId);
    const masterLabel = master?.data?.label || "LLM";
    updateLLMRefData({
      llmRef: masterId,
      label: `${masterLabel} (Ref)`,
    });
    setNameValue(`${masterLabel} (Ref)`);
  };

  const activeProvider = selectedMaster?.data?.provider || "unconfigured";
  const activeModel = selectedMaster?.data?.model || "default";

  return (
    <div
      className={`rounded-xl bg-card border-2 min-w-[280px] max-w-[340px] p-3 flex flex-col gap-2.5 transition-all duration-200 shadow-md relative group ${
        selected
          ? "border-sky-500 ring-2 ring-sky-500/20 shadow-sky-500/10"
          : "border-border hover:border-sky-500/40 hover:shadow-sky-500/5"
      }`}
    >
      {/* Output Handle to connect to step/agent nodes */}
      <Handle
        type="source"
        position={Position.Bottom}
        id={HANDLE_LLM_OUT}
        style={{ left: "50%" }}
        isValidConnection={(connection: Connection) =>
          connection.targetHandle === HANDLE_LLM_IN
        }
        className="!bg-sky-400 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-bottom-[7px]"
        title="Connect to LangGraph Node LLM Config"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 -mx-3 -mt-3 border-b border-border/50 bg-sky-500/10 text-sky-700 dark:text-sky-300 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-1 rounded-md border border-sky-500/30 bg-sky-500/15 text-sky-500 shrink-0">
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
                      setNameValue(data.label || "LLM Ref");
                      setIsEditingName(false);
                    }
                  }}
                />
              </div>
            ) : (
              <span
                className="font-bold text-xs text-foreground truncate max-w-[140px] cursor-pointer hover:text-sky-400 transition-colors nodrag"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                title="Click to rename LLM Ref"
              >
                {data.label || "LLM Ref"}
              </span>
            )}
            <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
              <span className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-400 text-[8px] uppercase font-bold">
                REF
              </span>
              <span>{data.refId || id}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedMaster && (
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono border border-sky-500/20">
              {activeProvider.toUpperCase()}
            </span>
          )}
          {data.onDeleteLLMRef && (
            <button
              type="button"
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100 nodrag"
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteLLMRef?.();
              }}
              title="Delete LLM Ref"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Master LLM Picker */}
      <div className="flex flex-col gap-1 nodrag">
        <label className="text-[9px] font-medium text-muted-foreground flex items-center justify-between">
          <span>Referenced LLM Config</span>
          {selectedMaster && (
            <span className="text-sky-400 font-mono text-[9px]">
              {selectedMaster.id}
            </span>
          )}
        </label>

        {availableMasterLLMs.length > 0 ? (
          <Select
            value={data.llmRef || ""}
            onValueChange={handleSelectMaster}
          >
            <SelectTrigger className="h-7 text-[10px] bg-background border border-border/60 rounded px-2 font-medium text-foreground nodrag">
              <SelectValue placeholder="Select Master LLM..." />
            </SelectTrigger>
            <SelectContent className="nodrag">
              {availableMasterLLMs.map((master) => (
                <SelectItem key={master.id} value={master.id}>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3 h-3 text-sky-400 shrink-0" />
                    <span className="font-semibold text-foreground">
                      {master.data?.label || master.id}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      ({master.data?.provider || "custom"} - {master.data?.model || "default"})
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
              No master LLM on canvas. Add an <strong>LLM config</strong> node first.
            </span>
          </div>
        )}
      </div>

      {/* Referenced LLM Summary (Read-Only Preview) */}
      {selectedMaster ? (
        <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-secondary/30 border border-border/50 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Model:</span>
            <span className="font-mono font-semibold text-foreground truncate max-w-[170px]">
              {activeModel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Provider:</span>
            <span className="font-mono text-sky-400">
              {selectedMaster.data?.provider || "custom"}
            </span>
          </div>
          {selectedMaster.data?.apiKeyHeader && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" /> Token:
              </span>
              <span className="font-mono text-muted-foreground">••••••••</span>
            </div>
          )}
          <div className="pt-1 mt-0.5 border-t border-border/40 text-[9px] text-muted-foreground flex items-center gap-1">
            <ExternalLink className="w-2.5 h-2.5 text-sky-400" />
            <span>Updates dynamically from master config</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
