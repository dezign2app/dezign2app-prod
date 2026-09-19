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
} from "@workspace/canvas";
import { useCanvasHandlers } from "./hooks/useCanvasHandlers";
import { useSchemaAutoLayout } from "./hooks/useAutoLayout";
import { LayoutTemplate } from "lucide-react";

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
  const { nodes, edges, onEdgesChange, onConnect, setView } =
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
  const { fitView } = useReactFlow();
  const { handleLayout } = useSchemaAutoLayout();
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

  const hasFitted = useRef(false);
  useEffect(() => {
    if (schemaNodes.length > 0 && !hasFitted.current) {
      hasFitted.current = true;
      const timer = setTimeout(() => {
        fitView({ duration: 500, padding: 0.35, maxZoom: 0.65 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [schemaNodes.length, fitView]);


  return (
    <div className="w-full h-full bg-muted/20">
      <ReactFlow
        nodes={schemaNodes}
        edges={schemaEdges}
        fitView
        fitViewOptions={{ padding: 0.35, maxZoom: 0.65 }}
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

          if (src.type === "redis_instance" && tgt.type !== "redis_schema" && tgt.data?.dbType !== "redis") {
            return false;
          }
          if (src.type === "database" && (tgt.type === "redis_schema" || tgt.data?.dbType === "redis")) {
            return false;
          }
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
        <Controls fitViewOptions={{ padding: 0.35, maxZoom: 0.65 }} />
        <MiniMap />

        {/* Auto Layout floating button on canvas */}
        <Panel position="top-left" className="mt-2 ml-2">
          <button
            type="button"
            onClick={() => handleLayout("LR")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/90 backdrop-blur-sm border border-border/60 shadow-md text-xs font-medium text-foreground hover:bg-accent hover:border-border transition-all select-none"
            title="Auto Layout"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-primary" />
            Auto Layout
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
