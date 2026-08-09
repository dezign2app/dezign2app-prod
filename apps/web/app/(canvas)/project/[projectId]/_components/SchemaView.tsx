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
import { PlusSquare, Database, LayoutTemplate, Server } from "lucide-react";
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
import { useAutoLayout } from "./hooks/useAutoLayout";

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
  const { nodes, edges, onEdgesChange, onConnect, addTableNode, addNode } =
    useBackendCanvasStore();

  const { handleNodesChange, handleMoveEnd } = useCanvasHandlers(
    projectId,
    "schema",
  );
  const { screenToFlowPosition, fitView } = useReactFlow();
  const schemaNodes = nodes.filter(
    (n) => n.type === "entity" || n.type === "database",
  );
  const schemaEdges = edges.filter(
    (e) =>
      e.type === "foreign-key" ||
      e.type === "database-connection" ||
      e.type === "connection",
  );

  const { handleLayout } = useAutoLayout({
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
        isDefault: true,
      },
    });
  };

  const handleAddTable = () => {
    const center = getCenterPosition();
    const { x, y } = getOffsetPosition(center.x - 75, center.y - 30, nodes);

    // Check if a database node exists; if not, create default SQLite DB node
    let dbNode = nodes.find((n) => n.type === "database");
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
        columns: [{ name: "id", type: "INTEGER", isPrimaryKey: true }],
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
    let dbNode = nodes.find((n) => n.type === "database");
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
        columns: [{ name: "_id", type: "UUID", isPrimaryKey: true }],
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

  return (
    <div className="w-full h-full bg-muted/20">
      <ReactFlow
        nodes={schemaNodes}
        edges={schemaEdges}
        elevateEdgesOnSelect={true}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        deleteKeyCode={["Backspace", "Delete"]}
        onConnect={onConnect}
        isValidConnection={(connection: Connection) => {
          const src = nodes.find((n) => n.id === connection.source);
          const tgt = nodes.find((n) => n.id === connection.target);
          if (!src || !tgt) return false;
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
        <Panel position="top-right" className="flex gap-2 flex-col">
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
