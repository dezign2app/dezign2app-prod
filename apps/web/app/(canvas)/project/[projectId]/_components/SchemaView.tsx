import React, { useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Connection,
  useReactFlow,
} from "@xyflow/react";
import { Button } from "@workspace/ui/components/button";
import { PlusSquare, Database, LayoutTemplate, Server, DatabaseZap } from "lucide-react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { nodeTypes } from "./backend-nodes/Nodes";
import { ForeignKeyEdge } from "./backend-nodes/ForeignKeyEdge";
import {
  HTTPConnectionEdge,
  MessagingEdge,
  DatabaseRefEdge,
} from "./backend-nodes/CustomEdges";
import {
  isValidConnection,
  getUniqueNodeLabel,
  DEFAULT_DATABASE_NODE_LABEL,
  DEFAULT_DATABASE_ENGINE,
  DEFAULT_DATABASE_ENV_VARS,
} from "@workspace/canvas";
import {
  getOffsetPosition,
  useCanvasHandlers,
} from "./hooks/useCanvasHandlers";
import { useSchemaAutoLayout } from "./hooks/useAutoLayout";

const edgeTypes = {
  "foreign-key": ForeignKeyEdge,
  connection: HTTPConnectionEdge,
  message: MessagingEdge,
  "database-connection": DatabaseRefEdge,
};

interface SchemaViewProps {
  projectId: string;
}

export function SchemaView({ projectId }: SchemaViewProps) {
  const { nodes, edges, onEdgesChange, onConnect, addTableNode, addNode, setView } =
    useBackendCanvasStore();

  useEffect(() => {
    setView("schema");
  }, [setView]);

  const {
    handleNodesChange,
    handleNodeDragStart,
    handleSelectionDragStart,
    handleMoveEnd,
  } = useCanvasHandlers(projectId, "schema");
  const { screenToFlowPosition, fitView } = useReactFlow();
  const schemaNodes = React.useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.type === "entity" ||
          n.type === "database" ||
          n.type === "redis_instance" ||
          n.type === "redis_schema",
      ),
    [nodes],
  );
  const schemaNodeIds = React.useMemo(
    () => new Set(schemaNodes.map((n) => n.id)),
    [schemaNodes],
  );
  const schemaEdges = React.useMemo(
    () =>
      edges.filter(
        (e) =>
          (e.type === "foreign-key" ||
            e.type === "database-connection" ||
            e.type === "connection") &&
          schemaNodeIds.has(e.source) &&
          schemaNodeIds.has(e.target),
      ),
    [edges, schemaNodeIds],
  );

  const { handleLayout } = useSchemaAutoLayout({
    nodes: schemaNodes,
    edges: schemaEdges,
  });

  const hasFitted = useRef(false);
  useEffect(() => {
    if (schemaNodes.length > 0 && !hasFitted.current) {
      hasFitted.current = true;
      window.requestAnimationFrame(() => {
        fitView({ duration: 600, padding: 0.15 });
      });
    }
  }, [schemaNodes.length]);

  const getCenterPosition = () => {
    if (typeof window === "undefined") return { x: 100, y: 100 };
    return screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  };

  const handleAddDatabase = () => {
    const center = getCenterPosition();
    const { x, y } = getOffsetPosition(center.x - 75, center.y - 30, nodes);
    const dbLabel = getUniqueNodeLabel(
      nodes,
      DEFAULT_DATABASE_NODE_LABEL,
      "database",
    );
    addNode({
      id: crypto.randomUUID(),
      type: "database",
      position: { x, y },
      data: {
        label: dbLabel,
        dbEngine: DEFAULT_DATABASE_ENGINE,
        dbType: "relational",
        dbCategory: "sql",
        dbConnectionType: "env_var",
        connectionStringEnv: DEFAULT_DATABASE_ENV_VARS.connectionStringEnv,
        dbFilePathEnv: DEFAULT_DATABASE_ENV_VARS.dbFilePathEnv,
        color: "#f59e0b",
        isDefault: true,
      },
    });
  };

  const handleAddRedisInstance = () => {
    const center = getCenterPosition();
    const { x, y } = getOffsetPosition(center.x - 75, center.y - 30, nodes);
    const dbLabel = getUniqueNodeLabel(nodes, "Primary_Redis_Cache", "redis_instance");
    addNode({
      id: crypto.randomUUID(),
      type: "redis_instance",
      position: { x, y },
      data: {
        label: dbLabel,
        dbEngine: "redis",
        dbType: "key-value",
        dbCategory: "nosql",
        dbConnectionType: "env_var",
        connectionStringEnv: "REDIS_URL",
        maxmemoryPolicy: "volatile-lru",
        maxmemory: "2gb",
        persistenceMode: "RDB+AOF",
        color: "#ef4444",
        isDefault: false,
      },
    });
  };

  const handleAddTable = () => {
    const center = getCenterPosition();
    const { x, y } = getOffsetPosition(center.x - 75, center.y - 30, nodes);

    // Check if an SQL / relational database node exists; if not, create default SQLite DB node
    let dbNode = nodes.find(
      (n) => n.type === "database" && n.data?.dbEngine !== "redis",
    );
    let dbId = dbNode?.id;

    if (!dbId) {
      dbId = crypto.randomUUID();
      const dbLabel = getUniqueNodeLabel(
        nodes,
        DEFAULT_DATABASE_NODE_LABEL,
        "database",
      );
      addNode({
        id: dbId,
        type: "database",
        position: { x: x - 250, y: y - 100 },
        data: {
          label: dbLabel,
          dbEngine: DEFAULT_DATABASE_ENGINE,
          dbType: "relational",
          dbCategory: "sql",
          dbConnectionType: "env_var",
          connectionStringEnv: DEFAULT_DATABASE_ENV_VARS.connectionStringEnv,
          dbFilePathEnv: DEFAULT_DATABASE_ENV_VARS.dbFilePathEnv,
          color: "#f59e0b",
          isDefault: true,
        },
      });
    }

    const tableId = crypto.randomUUID();
    const tableLabel = getUniqueNodeLabel(nodes, "Untitled_Table", "entity");
    addNode({
      id: tableId,
      type: "entity",
      position: { x, y },
      data: {
        label: tableLabel,
        columns: [{ name: "id", type: "TEXT", isPrimaryKey: true }],
        indexes: [],
        databaseId: dbId,
      },
    });

    if (dbId) {
      useBackendCanvasStore.getState().addEdge({
        id: `edge-${dbId}-${tableId}`,
        source: dbId,
        target: tableId,
        sourceHandle: "database-source",
        targetHandle: "database-entity-target",
        type: "database-connection",
      });
    }
  };

  const handleAddVectorDb = () => {
    const center = getCenterPosition();
    const { x, y } = getOffsetPosition(center.x - 75, center.y - 30, nodes);

    // Check if a database node exists
    let dbNode = nodes.find(
      (n) => n.type === "database" && n.data?.dbEngine !== "redis",
    );
    let dbId = dbNode?.id;

    if (!dbId) {
      dbId = crypto.randomUUID();
      const dbLabel = getUniqueNodeLabel(
        nodes,
        DEFAULT_DATABASE_NODE_LABEL,
        "database",
      );
      addNode({
        id: dbId,
        type: "database",
        position: { x: x - 250, y: y - 100 },
        data: {
          label: dbLabel,
          dbEngine: DEFAULT_DATABASE_ENGINE,
          dbType: "relational",
          dbCategory: "sql",
          dbConnectionType: "env_var",
          connectionStringEnv: DEFAULT_DATABASE_ENV_VARS.connectionStringEnv,
          dbFilePathEnv: DEFAULT_DATABASE_ENV_VARS.dbFilePathEnv,
          color: "#f59e0b",
          isDefault: true,
        },
      });
    }

    const tableId = crypto.randomUUID();
    const vectorLabel = getUniqueNodeLabel(nodes, "Vector_Collection", "entity");
    addNode({
      id: tableId,
      type: "entity",
      position: { x, y },
      data: {
        label: vectorLabel,
        dbType: "vector",
        columns: [{ name: "id", type: "TEXT", isPrimaryKey: true }],
        databaseId: dbId,
      },
    });

    if (dbId) {
      useBackendCanvasStore.getState().addEdge({
        id: `edge-${dbId}-${tableId}`,
        source: dbId,
        target: tableId,
        sourceHandle: "database-source",
        targetHandle: "database-entity-target",
        type: "database-connection",
      });
    }
  };

  const handleAddRedisSchema = () => {
    const center = getCenterPosition();
    const { x, y } = getOffsetPosition(center.x - 75, center.y - 30, nodes);

    // Check if a dedicated Redis instance node exists
    let redisDbNode = nodes.find(
      (n) =>
        n.type === "redis_instance" ||
        (n.type === "database" && n.data?.dbEngine === "redis"),
    );
    let dbId = redisDbNode?.id;

    if (!dbId) {
      dbId = crypto.randomUUID();
      const redisInstances = nodes.filter(
        (n) => n.type === "redis_instance" || (n.type === "database" && n.data?.dbEngine === "redis"),
      );
      const dbLabel = getUniqueNodeLabel(
        nodes,
        redisInstances.length > 0 ? `Redis_${redisInstances.length + 1}` : "Redis",
        "redis_instance",
      );
      addNode({
        id: dbId,
        type: "redis_instance",
        position: { x: x - 250, y: y - 100 },
        data: {
          label: dbLabel,
          dbEngine: "redis",
          dbType: "key-value",
          dbCategory: "nosql",
          dbConnectionType: "env_var",
          connectionStringEnv: "REDIS_URL",
          color: "#ef4444",
          isDefault: false,
        },
      });
    }

    const schemaId = crypto.randomUUID();
    const redisSchemas = nodes.filter((n) => n.type === "redis_schema");
    const redisLabel = getUniqueNodeLabel(
      nodes,
      redisSchemas.length > 0 ? `Cache_${redisSchemas.length + 1}` : "Cache",
      "redis_schema",
    );
    addNode({
      id: schemaId,
      type: "redis_schema",
      position: { x, y },
      data: {
        label: redisLabel,
        dbType: "redis",
        redisDataStructure: "hash",
        keyTemplate: "",
        columns: [],
        hashConfig: {
          fields: [],
        },
        databaseId: dbId,
      },
    });

    if (dbId) {
      useBackendCanvasStore.getState().addEdge({
        id: `edge-${dbId}-${schemaId}`,
        source: dbId,
        target: schemaId,
        sourceHandle: "database-source",
        targetHandle: "database-entity-target",
        type: "database-connection",
      });
    }
  };

  return (
    <div className="w-full h-full bg-muted/20">
      <ReactFlow
        nodes={schemaNodes}
        edges={schemaEdges}
        elevateEdgesOnSelect={true}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={handleNodeDragStart}
        onSelectionDragStart={handleSelectionDragStart}
        deleteKeyCode={["Backspace", "Delete"]}
        onConnect={onConnect}
        isValidConnection={(connection: Connection) => {
          const src = nodes.find((n) => n.id === connection.source);
          const tgt = nodes.find((n) => n.id === connection.target);
          if (!src || !tgt) return false;

          // Redis Instance can only connect to Redis Schema
          if (src.type === "redis_instance" && tgt.type !== "redis_schema" && tgt.data?.dbType !== "redis") {
            return false;
          }
          // SQL Database can only connect to SQL Tables / Vector Collections
          if (src.type === "database" && (tgt.type === "redis_schema" || tgt.data?.dbType === "redis")) {
            return false;
          }
          // Redis Schema can only connect to Redis Instance
          if (tgt.type === "redis_schema" && src.type !== "redis_instance" && src.data?.dbEngine !== "redis") {
            return false;
          }

          return isValidConnection(
            src.type,
            connection.sourceHandle,
            tgt.type,
            connection.targetHandle,
          ).valid;
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onMoveEnd={handleMoveEnd}
        attributionPosition="bottom-right"
        minZoom={0.01}
        maxZoom={3}
      >
        <Background gap={12} size={1} />
        <Controls />
        <MiniMap />
        <Panel position="top-right" className="flex gap-2 flex-col p-1.5 bg-background/80 backdrop-blur-md border border-border/60 rounded-xl shadow-lg">
          {/* Relational & Vector Storage */}
          <div className="flex flex-col gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={handleAddDatabase}
            >
              <Server className="w-3.5 h-3.5 mr-2 text-amber-500" />
              Database
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start"
              onClick={handleAddTable}
            >
              <PlusSquare className="w-3.5 h-3.5 mr-2" />
              Table
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start"
              onClick={handleAddVectorDb}
            >
              <Database className="w-3.5 h-3.5 mr-2 text-violet-500" />
              Vector Collection
            </Button>
          </div>

          <div className="h-px bg-border/60 mx-1" />

          {/* Redis In-Memory Cache & Schemas */}
          <div className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-red-500/5 dark:bg-red-950/20 border border-red-500/25">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1">
              <DatabaseZap className="w-3 h-3 text-red-500" />
              Redis
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/15"
              onClick={handleAddRedisInstance}
            >
              <Server className="w-3.5 h-3.5 mr-2 text-red-500" />
              Redis Instance
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/15"
              onClick={handleAddRedisSchema}
            >
              <DatabaseZap className="w-3.5 h-3.5 mr-2 text-red-500" />
              Redis Schema
            </Button>
          </div>

          <div className="h-px bg-border/60 mx-1" />

          {/* Utilities */}
          <Button
            variant="outline"
            size="sm"
            className="bg-sidebar dark:bg-sidebar shadow-sm text-xs justify-start"
            onClick={() => handleLayout("LR")}
          >
            <LayoutTemplate className="w-3.5 h-3.5 mr-2" />
            Auto-layout
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
