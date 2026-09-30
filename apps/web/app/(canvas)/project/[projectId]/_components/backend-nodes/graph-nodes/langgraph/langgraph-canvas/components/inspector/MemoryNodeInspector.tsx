import React from "react";
import {
  Database,
  Trash,
  HardDrive,
  Key,
  Layers,
  Sparkles,
  MessageSquare,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import type { MemoryNodeData } from "@workspace/canvas";
import { LocalInput } from "../../../../common";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  checkCheckpointerTablesStatus,
  provisionCheckpointerTables,
} from "../../utils/checkpointerTables";
import { CheckpointerTablesList } from "./CheckpointerTablesList";
import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";
import { Plus } from "lucide-react";

interface MemoryNodeInspectorProps {
  selectedMemoryData: MemoryNodeData;
  onDeleteMemory: () => void;
  onUpdateMemory: (changes: Partial<MemoryNodeData>) => void;
}

export function MemoryNodeInspector({
  selectedMemoryData,
  onDeleteMemory,
  onUpdateMemory,
}: MemoryNodeInspectorProps) {
  const allCanvasNodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

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
  const checkpointer = selectedMemoryData.checkpointer || "memory";
  const threadIdKey = selectedMemoryData.threadIdKey || "thread_id";
  const threadScope = selectedMemoryData.threadScope || "session";

  const isEnabled = selectedMemoryData.enabled !== false;
  const tableStatus = React.useMemo(
    () =>
      checkCheckpointerTablesStatus(
        allCanvasNodes,
        edges,
        isEnabled,
        checkpointer,
        selectedMemoryData.checkpointerConnectionId,
      ),
    [allCanvasNodes, edges, isEnabled, checkpointer, selectedMemoryData.checkpointerConnectionId],
  );

  const handleCreateInspectorTables = () => {
    if (!tableStatus.configuredNodeId) {
      toast.error(`Please select a ${checkpointer === "postgres" ? "PostgreSQL database" : "Redis instance"} first.`);
      return;
    }

    const created = provisionCheckpointerTables({
      linkedNodeId: tableStatus.configuredNodeId,
      checkpointerType: checkpointer,
      nodes: allCanvasNodes,
      edges,
      addNode,
      updateNode,
      addEdge,
    });

    if (created > 0) {
      toast.success(
        `Provisioned & synced LangGraph checkpointer ${checkpointer === "postgres" ? "tables" : "schemas"} with foreign key mappings and indexes in SchemaView!`,
      );
      if (selectedMemoryData.checkpointerConnectionId !== tableStatus.configuredNodeId) {
        onUpdateMemory({ checkpointerConnectionId: tableStatus.configuredNodeId });
      }
    } else {
      toast.info("All LangGraph checkpointer tables are up to date.");
    }
  };


  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-500">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-mono truncate max-w-[170px]">
                {selectedMemoryData.name ||
                  selectedMemoryData.label ||
                  "Memory Saver"}
              </h2>
              <p className="text-[10px] font-mono text-muted-foreground opacity-70">
                {selectedMemoryData.memoryId || selectedMemoryData.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            onClick={onDeleteMemory}
            title="Delete Memory Node"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Identity & Basic Config */}
      <div className="flex flex-col gap-4 p-3 bg-secondary/10 rounded-xl border border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Memory Configuration
          </h3>
        </div>

        {/* Memory Name */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-foreground">
            Node Label / Name
          </Label>
          <LocalInput
            value={selectedMemoryData.name || selectedMemoryData.label || ""}
            onChange={(e) =>
              onUpdateMemory({ name: e.target.value, label: e.target.value })
            }
            className="h-7 text-xs font-mono bg-background"
            placeholder="session_memory_db"
          />
        </div>

        {/* Enable / Disable Checkpointer Toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">
              Enable Checkpointing
            </span>
            <span className="text-[10px] text-muted-foreground">
              Persist graph state snapshots across turns
            </span>
          </div>
          <Switch
            checked={selectedMemoryData.enabled !== false}
            onCheckedChange={(c) => onUpdateMemory({ enabled: c })}
          />
        </div>

        {/* Checkpointer Engine */}
        <div className={`flex flex-col gap-2 ${selectedMemoryData.enabled === false ? "opacity-40 pointer-events-none" : ""}`}>
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            Checkpointer Engine
          </Label>
          <Select
            value={checkpointer}
            onValueChange={(val: string) => {
              if (val === "postgres") {
                const defaultPg = postgresNodes[0];
                onUpdateMemory({
                  checkpointer: "postgres",
                  checkpointerConnectionId: defaultPg?.id,
                });
              } else if (val === "redis") {
                const defaultRedis = redisNodes[0];
                onUpdateMemory({
                  checkpointer: "redis",
                  checkpointerConnectionId: defaultRedis?.id,
                });
              } else {
                onUpdateMemory({ checkpointer: val });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs bg-background font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="memory">In-Memory (MemorySaver)</SelectItem>
              <SelectItem value="postgres">PostgreSQL (PostgresSaver)</SelectItem>
              <SelectItem value="redis">Redis (RedisSaver)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Persists state snapshots and message history across turns for
            agents.
          </p>

          {/* Linked Database for PostgreSQL */}
          {checkpointer === "postgres" && (
            <div className="flex flex-col gap-1.5 mt-2 p-2.5 rounded-lg border border-sky-500/20 bg-sky-500/5">
              <Label className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Database className="w-3 h-3" />
                Linked PostgreSQL Database
              </Label>
              <Select
                value={
                  selectedMemoryData.checkpointerConnectionId &&
                  postgresNodes.some((p) => p.id === selectedMemoryData.checkpointerConnectionId)
                    ? String(selectedMemoryData.checkpointerConnectionId)
                    : (postgresNodes[0]?.id || "none")
                }
                onValueChange={(val: string) =>
                  onUpdateMemory({ checkpointerConnectionId: val === "none" ? undefined : val })
                }
              >
                <SelectTrigger className="h-7 text-xs bg-background font-mono">
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
                <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-medium mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>No PostgreSQL database found in SchemaView. Please add one.</span>
                </div>
              )}
            </div>
          )}

          {/* Linked Redis Instance */}
          {checkpointer === "redis" && (
            <div className="flex flex-col gap-1.5 mt-2 p-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
              <Label className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <HardDrive className="w-3 h-3" />
                Linked Redis Instance
              </Label>
              <Select
                value={
                  selectedMemoryData.checkpointerConnectionId &&
                  redisNodes.some((r) => r.id === selectedMemoryData.checkpointerConnectionId)
                    ? String(selectedMemoryData.checkpointerConnectionId)
                    : (redisNodes[0]?.id || "none")
                }
                onValueChange={(val: string) =>
                  onUpdateMemory({ checkpointerConnectionId: val === "none" ? undefined : val })
                }
              >
                <SelectTrigger className="h-7 text-xs bg-background font-mono">
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
                <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-medium mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>No Redis instance found in SchemaView. Please add one.</span>
                </div>
              )}
            </div>
          )}

          {/* Tables Status & Provisioning List */}
          {isEnabled &&
            (checkpointer === "postgres" || checkpointer === "redis") &&
            !tableStatus.isMissingStorage && (
              <CheckpointerTablesList
                checkpointerType={checkpointer}
                existingTables={tableStatus.existingTables}
                linkedNodeId={tableStatus.configuredNodeId}
                onCreateTables={handleCreateInspectorTables}
              />
            )}
        </div>
      </div>

      {/* Session & Thread ID Config */}
      <div className="flex flex-col gap-4 p-3 bg-secondary/10 rounded-xl border border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Session & Thread Key
          </h3>
        </div>

        {/* Thread / Session ID Key Field */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-foreground">
            Session / Thread Identifier Key
          </Label>
          <LocalInput
            value={threadIdKey}
            onChange={(e) => onUpdateMemory({ threadIdKey: e.target.value })}
            className="h-7 text-xs font-mono bg-background"
            placeholder="thread_id"
          />
          <div className="flex flex-wrap gap-1 mt-1">
            {["thread_id", "session_id", "user_id", "chat_id"].map(
              (keyName) => (
                <button
                  key={keyName}
                  type="button"
                  onClick={() => onUpdateMemory({ threadIdKey: keyName })}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    threadIdKey === keyName
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-300 font-bold"
                      : "bg-secondary/30 border-border/40 text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  {keyName}
                </button>
              ),
            )}
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight font-mono">
            Key used in runtime graph execution:{" "}
            <code className="text-foreground">{`configurable: { ${threadIdKey || "thread_id"}: "..." }`}</code>
          </p>
        </div>

        {/* Thread Scope */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            Thread Persistence Scope
          </Label>
          <Select
            value={threadScope}
            onValueChange={(val: "session" | "user" | "global") =>
              onUpdateMemory({ threadScope: val })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-background font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="session">
                Session Level (Unique per chat session)
              </SelectItem>
              <SelectItem value="user">
                User Level (Persists across user login sessions)
              </SelectItem>
              <SelectItem value="global">
                Global Level (Shared across all agent runs)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* History Window & Summarization Options */}
      <div className="flex flex-col gap-4 p-3 bg-secondary/10 rounded-xl border border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            History Window & Limits
          </h3>
        </div>

        {/* Auto Summarize */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/40">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">
              Auto-Summarization
            </span>
            <span className="text-[10px] text-muted-foreground">
              Compress older messages to save LLM context window
            </span>
          </div>
          <Switch
            checked={selectedMemoryData.autoSummarize ?? true}
            onCheckedChange={(c) => onUpdateMemory({ autoSummarize: c })}
          />
        </div>

        {/* Max Window Messages */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-foreground">
            Max Window Messages
          </Label>
          <LocalInput
            type="number"
            value={selectedMemoryData.maxWindowMessages ?? 10}
            onChange={(e) =>
              onUpdateMemory({
                maxWindowMessages: parseInt(e.target.value, 10) || 10,
              })
            }
            className="h-7 text-xs font-mono bg-background"
            placeholder="10"
          />
          <p className="text-[10px] text-muted-foreground">
            Maximum recent messages retained before summarizing or trimming.
          </p>
        </div>

        {/* Save Messages Flag */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/40">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">
              Save Message History
            </span>
            <span className="text-[10px] text-muted-foreground">
              Store full turn-by-turn chat history to database
            </span>
          </div>
          <Switch
            checked={selectedMemoryData.saveMessages ?? true}
            onCheckedChange={(c) => onUpdateMemory({ saveMessages: c })}
          />
        </div>
      </div>
    </div>
  );
}
