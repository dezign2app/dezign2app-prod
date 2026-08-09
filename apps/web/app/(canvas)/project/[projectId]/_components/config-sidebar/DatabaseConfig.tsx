import React from "react";
import { Database, Key, Server, Plus, Table2, Trash2, CheckCircle2 } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { DEFAULT_DATABASE_ENV_VARS, getUniqueNodeLabel } from "@workspace/canvas";

interface DatabaseConfigProps {
  id: string;
  nodeId: string;
}

export function DatabaseConfig({ id, nodeId }: DatabaseConfigProps) {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addNode = useBackendCanvasStore((s) => s.addNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);

  const dbNode = nodes.find((n) => n.id === nodeId);
  if (!dbNode) return null;

  const data = dbNode.data || {};
  const label = data.label || "Primary SQLite DB";
  const engine = data.dbEngine || "sqlite";
  const connStringEnv = data.connectionStringEnv || DEFAULT_DATABASE_ENV_VARS.connectionStringEnv;
  const dbFilePathEnv = data.dbFilePathEnv || DEFAULT_DATABASE_ENV_VARS.dbFilePathEnv;

  const attachedTables = nodes.filter(
    (n) => n.type === "entity" && n.data?.databaseId === nodeId,
  );

  const handleUpdateField = (field: string, value: string | boolean | undefined) => {
    updateNode(nodeId, {
      data: {
        ...data,
        [field]: value,
      },
    });
  };

  const handleAddTableToDb = () => {
    const tableId = crypto.randomUUID();
    const dbPos = dbNode.position || { x: 100, y: 100 };
    const tableLabel = getUniqueNodeLabel(nodes, `Table_${attachedTables.length + 1}`, "entity");

    addNode({
      id: tableId,
      type: "entity",
      position: { x: dbPos.x, y: dbPos.y + 220 },
      data: {
        label: tableLabel,
        columns: [{ name: "id", type: "INTEGER", isPrimaryKey: true }],
        indexes: [],
        databaseId: nodeId,
      },
    });

    addEdge({
      id: `edge-${nodeId}-${tableId}`,
      source: nodeId,
      target: tableId,
      sourceHandle: "database-source",
      targetHandle: "database-entity-target",
      type: "database-connection",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border/60">
        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <Database size={22} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight truncate">
              {label}
            </h2>
            <Badge variant="outline" className="text-[10px] uppercase font-mono bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
              {engine}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure database connection environment variables & attached tables.
          </p>
        </div>
      </div>

      {/* General Settings */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Server size={14} className="text-amber-500" />
          General Info
        </h3>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Database Label</Label>
          <Input
            value={label}
            onChange={(e) => handleUpdateField("label", e.target.value)}
            placeholder="e.g. Primary SQLite DB"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Database Engine</Label>
          <Select
            value={engine}
            onValueChange={(val) => handleUpdateField("dbEngine", val)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sqlite" className="text-xs">
                SQLite 3.x (Default)
              </SelectItem>
              <SelectItem value="postgres" className="text-xs">
                PostgreSQL
              </SelectItem>
              <SelectItem value="mysql" className="text-xs">
                MySQL / MariaDB
              </SelectItem>
              <SelectItem value="mongodb" className="text-xs">
                MongoDB
              </SelectItem>
              <SelectItem value="pinecone" className="text-xs">
                Pinecone (Vector)
              </SelectItem>
              <SelectItem value="redis" className="text-xs">
                Redis (Key-Value)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Environment Variable Configurations */}
      <div className="space-y-4 pt-2 border-t border-border/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Key size={14} className="text-amber-500" />
          Environment Variables (Predefined & Editable)
        </h3>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Connection String ENV Key</Label>
          <Input
            value={connStringEnv}
            onChange={(e) => handleUpdateField("connectionStringEnv", e.target.value)}
            placeholder="e.g. DATABASE_URL"
            className="h-8 text-xs font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Environment variable holding the connection URI (`process.env.{connStringEnv}`).
          </p>
        </div>

        {engine === "sqlite" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">DB File Path ENV Key</Label>
            <Input
              value={dbFilePathEnv}
              onChange={(e) => handleUpdateField("dbFilePathEnv", e.target.value)}
              placeholder="e.g. DB_FILE_PATH"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Environment variable for SQLite database file path (`process.env.{dbFilePathEnv}`).
            </p>
          </div>
        )}
      </div>

      {/* Hanging / Attached Tables */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Table2 size={14} className="text-amber-500" />
            Hanging Entity Tables ({attachedTables.length})
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            onClick={handleAddTableToDb}
          >
            <Plus size={12} className="mr-1 text-amber-500" />
            Add Table
          </Button>
        </div>

        {attachedTables.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
            No tables currently attached to this database. Click "+ Add Table" above or connect a table on the canvas.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {attachedTables.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={14} className="text-amber-500 shrink-0" />
                  <span className="font-semibold truncate">{t.data.label || "Table"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({(t.data.columns || []).length} cols)
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  title="Unlink from DB"
                  onClick={() => {
                    updateNode(t.id, {
                      data: { ...t.data, databaseId: undefined },
                    });
                    const store = useBackendCanvasStore.getState();
                    const edge = store.edges.find(
                      (e) => e.source === nodeId && e.target === t.id,
                    );
                    if (edge) store.deleteEdge(edge.id);
                  }}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
