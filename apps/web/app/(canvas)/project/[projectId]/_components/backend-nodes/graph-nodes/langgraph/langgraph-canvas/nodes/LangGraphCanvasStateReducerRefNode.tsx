import React, { useState, useEffect, useMemo } from "react";
import {
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  Connection,
} from "@xyflow/react";
import { Trash, GitMerge, AlertCircle, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Badge } from "@workspace/ui/components/badge";
import type {
  LangGraphStateReducerRefNode,
  LangGraphCanvasNode,
  StateGlobalNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_STATE_GLOBAL,
  LANGGRAPH_CANVAS_NODE_STATE_REDUCER_REF,
  HANDLE_STATE_IN,
  HANDLE_STATE_OUT,
} from "../constants";
import { LocalInput } from "../../../common";

export const LangGraphCanvasStateReducerRefNode = ({
  id,
  data,
  selected,
}: NodeProps<LangGraphStateReducerRefNode>) => {
  const { setNodes, getNodes, setEdges } = useReactFlow<LangGraphCanvasNode>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.label || "State Reducer Ref");

  useEffect(() => {
    setNameValue(data.label || "State Reducer Ref");
  }, [data.label]);

  const allNodes = getNodes();
  const stateGlobalNode = useMemo(() => {
    return allNodes.find(
      (n): n is StateGlobalNode => n.type === LANGGRAPH_CANVAS_NODE_STATE_GLOBAL,
    );
  }, [allNodes]);

  const availableChannels = useMemo(() => {
    return stateGlobalNode?.data?.stateChannels || [
      { key: "messages", type: "messages", reducer: "add_messages" },
    ];
  }, [stateGlobalNode]);

  const currentChannel = useMemo(() => {
    return availableChannels.find((c) => c.key === data.targetChannelKey) || availableChannels[0];
  }, [availableChannels, data.targetChannelKey]);

  const updateRefData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id && n.type === LANGGRAPH_CANVAS_NODE_STATE_REDUCER_REF
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim() || "State Reducer Ref";
    setNameValue(trimmed);
    if (trimmed !== data.label) {
      updateRefData({ label: trimmed });
    }
  };

  const handleSelectChannel = (channelKey: string) => {
    updateRefData({
      targetChannelKey: channelKey,
      label: `Mutate: ${channelKey}`,
    });
    setNameValue(`Mutate: ${channelKey}`);
  };

  const handleSelectMode = (mode: "append" | "set" | "overwrite" | "untracked") => {
    updateRefData({ mode });
  };

  const handleDelete = () => {
    if (data.onDeleteStateReducerRef) {
      data.onDeleteStateReducerRef();
    } else {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    }
  };

  // Color mappings based on reducer mode
  const mode = data.mode || "append";
  const modeBadgeColor =
    mode === "append"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : mode === "overwrite"
        ? "bg-red-500/20 text-red-300 border-red-500/30"
        : mode === "untracked"
          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
          : "bg-slate-500/20 text-slate-300 border-slate-500/30";

  return (
    <div
      className={`rounded-xl bg-card/95 backdrop-blur-md border-2 border-amber-500/50 w-[260px] p-2.5 flex flex-col gap-2 transition-all duration-200 shadow-lg relative ${
        selected
          ? "ring-4 ring-amber-500/20 shadow-amber-500/10 scale-105 border-amber-400"
          : "hover:border-amber-500/80"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <GitMerge className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            {isEditingName ? (
              <LocalInput
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                className="h-5 text-xs font-bold font-mono px-1 py-0 bg-background"
                autoFocus
              />
            ) : (
              <span
                onDoubleClick={() => setIsEditingName(true)}
                className="font-bold text-xs text-foreground tracking-wide truncate cursor-pointer hover:underline"
                title="Double click to rename"
              >
                {nameValue}
              </span>
            )}
            <span className="text-[9px] font-mono text-amber-400/80">
              State Reducer Ref
            </span>
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors nodrag ml-1"
          title="Delete Reducer Ref Node"
        >
          <Trash className="w-3 h-3" />
        </button>
      </div>

      {/* Target State Channel Selector */}
      <div className="flex flex-col gap-1 nodrag">
        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
          Target Channel
        </span>
        <Select
          value={data.targetChannelKey || availableChannels[0]?.key || "messages"}
          onValueChange={handleSelectChannel}
        >
          <SelectTrigger className="h-7 text-xs font-mono bg-secondary/50 border-border/50">
            <SelectValue placeholder="Select channel" />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            {availableChannels.map((c) => (
              <SelectItem key={c.key} value={c.key} className="text-xs">
                {c.key} ({c.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mutation Mode */}
      <div className="flex items-center justify-between nodrag bg-secondary/30 p-1.5 rounded-lg border border-border/40">
        <div className="flex flex-col">
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
            Mutation Mode
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">
            {mode === "append"
              ? "ReducedValue (concat)"
              : mode === "overwrite"
                ? "Overwrite(...) bypass"
                : mode === "untracked"
                  ? "UntrackedValue"
                  : "Direct replacement"}
          </span>
        </div>
        <Select
          value={mode}
          onValueChange={(val) => handleSelectMode(val as "append" | "set" | "overwrite" | "untracked")}
        >
          <SelectTrigger className={`h-6 text-[10px] font-mono font-bold w-24 border ${modeBadgeColor}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            <SelectItem value="append">append</SelectItem>
            <SelectItem value="set">set</SelectItem>
            <SelectItem value="overwrite">overwrite</SelectItem>
            <SelectItem value="untracked">untracked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Connection Info */}
      <div className="text-[9px] text-muted-foreground flex items-center justify-between px-1">
        <span className="flex items-center gap-1 font-mono">
          <Zap className="w-2.5 h-2.5 text-amber-400" />
          Reducer: <span className="font-bold text-foreground">{currentChannel?.reducer || "add_messages"}</span>
        </span>
        <span className="italic text-[8px]">Connect to Node</span>
      </div>

      {/* Source Handle (connects into LangGraphCanvasNode HANDLE_STATE_IN) */}
      <Handle
        type="source"
        position={Position.Right}
        id={HANDLE_STATE_OUT}
        className="!bg-amber-400 !w-3.5 !h-3.5 !border-2 !border-background hover:!scale-125 transition-transform !-right-[7px]"
        title="Connect to LangGraph Node (state_out)"
      />
    </div>
  );
};
