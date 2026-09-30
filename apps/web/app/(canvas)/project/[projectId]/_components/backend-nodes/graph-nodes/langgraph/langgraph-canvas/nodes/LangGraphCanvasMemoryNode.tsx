import React from "react";
import { NodeProps, useReactFlow } from "@xyflow/react";
import { Database, HardDrive, Key, Layers, AlertTriangle } from "lucide-react";
import { Switch } from "@workspace/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { MemoryNode, LangGraphCanvasNode } from "@workspace/canvas";
import { LANGGRAPH_CANVAS_NODE_MEMORY } from "../constants";
import { LocalInput } from "../../../common";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

export const LangGraphCanvasMemoryNode = ({
  id,
  data,
  selected,
}: NodeProps<MemoryNode>) => {
  const { setNodes } = useReactFlow<LangGraphCanvasNode>();
  const allCanvasNodes = useBackendCanvasStore((s) => s.nodes);

  const postgresNodes = React.useMemo(
    () => allCanvasNodes.filter((n) => n?.type === "database" && n.data?.dbEngine === "postgres"),
    [allCanvasNodes],
  );

  const redisNodes = React.useMemo(
    () =>
      allCanvasNodes.filter(
        (n) => n?.type === "redis_instance" || (n?.type === "database" && n.data?.dbEngine === "redis"),
      ),
    [allCanvasNodes],
  );

  const isEnabled = data.enabled !== false;
  const checkpointerType = data.checkpointer || "postgres";
  const threadIdKey = data.threadIdKey || "thread_id";

  const updateMemoryData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id && n.type === LANGGRAPH_CANVAS_NODE_MEMORY
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const handleToggle = (checked: boolean) => {
    updateMemoryData({ enabled: checked });
    if (data.onToggleEnabled) {
      data.onToggleEnabled(checked);
    }
  };

  return (
    <div
      className={`rounded-xl bg-card/95 backdrop-blur-md border-2 w-[300px] p-3 flex flex-col gap-2.5 transition-all duration-200 shadow-xl relative cursor-pointer ${
        selected
          ? "ring-4 ring-amber-500/20 shadow-amber-500/10 scale-105 border-amber-500"
          : "border-amber-500/60 hover:border-amber-500/90"
      }`}
      onClick={() => {
        data.onOpenMemoryTab?.();
      }}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-foreground tracking-wide flex items-center gap-1.5">
              Checkpointer
              {isEnabled && (
                <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-amber-500/15 text-amber-500 uppercase">
                  {checkpointerType}
                </span>
              )}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">
              {isEnabled
                ? checkpointerType === "postgres"
                  ? "PostgresSaver (persisted)"
                  : checkpointerType === "redis"
                    ? "RedisSaver (persisted)"
                    : "MemorySaver (in-memory)"
                : "Disabled (no checkpoint)"}
            </span>
          </div>
        </div>

        {/* Toggle Button to Enable or Disable Checkpointing */}
        <div
          className="flex items-center gap-1.5 nodrag"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-[9px] font-mono font-bold text-muted-foreground">
            {isEnabled ? "ON" : "OFF"}
          </span>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            className="scale-75"
          />
        </div>
      </div>

      {/* Disabled State Body */}
      {!isEnabled && (
        <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/40 flex flex-col items-center justify-center gap-1 text-center py-2.5">
          <span className="text-xs font-semibold text-muted-foreground">
            Checkpointing Disabled
          </span>
          <span className="text-[9px] text-muted-foreground/70 leading-tight">
            Graph state is temporary for the current turn. Toggle ON to persist snapshots across turns.
          </span>
        </div>
      )}

      {/* Enabled State Body */}
      {isEnabled && (
        <div
          className="flex flex-col gap-2.5 nodrag"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Checkpointer Saver Engine Selection */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-semibold text-muted-foreground uppercase">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-500" />
                Saver Engine
              </span>
              <button
                type="button"
                className="text-[9px] text-amber-500 hover:underline cursor-pointer lowercase"
                onClick={() => data.onOpenMemoryTab?.()}
              >
                memory tab ↗
              </button>
            </div>
            <Select
              value={checkpointerType}
              onValueChange={(val: string) => {
                let defaultConn = data.checkpointerConnectionId;
                if (val === "postgres") {
                  defaultConn = postgresNodes[0]?.id;
                } else if (val === "redis") {
                  defaultConn = redisNodes[0]?.id;
                }
                updateMemoryData({
                  checkpointer: val,
                  checkpointerConnectionId: defaultConn,
                });
                if (data.onUpdateMemoryConfig) {
                  data.onUpdateMemoryConfig({
                    checkpointer: val,
                    checkpointerNodeId: defaultConn,
                  });
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-secondary/30 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL (PostgresSaver)</SelectItem>
                <SelectItem value="redis">Redis (RedisSaver)</SelectItem>
                <SelectItem value="memory">In-Memory (MemorySaver)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Linked Database for PostgreSQL */}
          {checkpointerType === "postgres" && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold text-sky-500 uppercase flex items-center gap-1">
                <Database className="w-3 h-3 text-sky-500" />
                Linked PostgreSQL Database
              </span>
              <Select
                value={
                  data.checkpointerConnectionId &&
                  postgresNodes.some((p) => p.id === data.checkpointerConnectionId)
                    ? String(data.checkpointerConnectionId)
                    : (postgresNodes[0]?.id || "none")
                }
                onValueChange={(val: string) => {
                  const newId = val === "none" ? undefined : val;
                  updateMemoryData({ checkpointerConnectionId: newId });
                  if (data.onUpdateMemoryConfig) {
                    data.onUpdateMemoryConfig({ checkpointerNodeId: newId });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-secondary/30 font-mono">
                  <SelectValue placeholder="Select Database..." />
                </SelectTrigger>
                <SelectContent>
                  {postgresNodes.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No PostgreSQL database in SchemaView
                    </SelectItem>
                  ) : (
                    postgresNodes.map((db) => (
                      <SelectItem key={db.id} value={db.id}>
                        {db.data?.label || "PostgreSQL DB"} (postgres)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {postgresNodes.length === 0 && (
                <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  No PostgreSQL DB in SchemaView
                </span>
              )}
            </div>
          )}

          {/* Linked Redis Instance */}
          {checkpointerType === "redis" && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold text-red-500 uppercase flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-red-500" />
                Linked Redis Instance
              </span>
              <Select
                value={
                  data.checkpointerConnectionId &&
                  redisNodes.some((r) => r.id === data.checkpointerConnectionId)
                    ? String(data.checkpointerConnectionId)
                    : (redisNodes[0]?.id || "none")
                }
                onValueChange={(val: string) => {
                  const newId = val === "none" ? undefined : val;
                  updateMemoryData({ checkpointerConnectionId: newId });
                  if (data.onUpdateMemoryConfig) {
                    data.onUpdateMemoryConfig({ checkpointerNodeId: newId });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-secondary/30 font-mono">
                  <SelectValue placeholder="Select Redis..." />
                </SelectTrigger>
                <SelectContent>
                  {redisNodes.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No Redis in SchemaView
                    </SelectItem>
                  ) : (
                    redisNodes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.data?.label || "Redis Instance"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {redisNodes.length === 0 && (
                <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  No Redis in SchemaView
                </span>
              )}
            </div>
          )}

          {/* Thread / Session ID Field */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Key className="w-3 h-3 text-amber-500" />
              Thread ID Key
            </span>
            <LocalInput
              className="h-7 text-xs bg-secondary/30 border border-border/50 p-1.5 rounded font-mono nodrag"
              placeholder="thread_id"
              value={threadIdKey}
              onChange={(e) => {
                updateMemoryData({ threadIdKey: e.target.value });
                if (data.onUpdateMemoryConfig) {
                  data.onUpdateMemoryConfig({ threadIdKey: e.target.value });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
