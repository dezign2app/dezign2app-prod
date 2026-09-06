import React, { useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Connection,
  useReactFlow,
} from "@xyflow/react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSimulationStore } from "@/lib/stores/simulationStore";
import { nodeTypes } from "../backend-nodes/Nodes";
import { ForeignKeyEdge } from "../backend-nodes/ForeignKeyEdge";
import {
  HTTPConnectionEdge,
  MessagingEdge,
  IdentityConnectionEdge,
  TransformerReferenceEdge,
  TypeReferenceEdge,
} from "../backend-nodes/CustomEdges";
import { isValidConnection } from "@workspace/canvas";
import { useCanvasHandlers } from "../hooks/useCanvasHandlers";
import { useGraphAutoLayout } from "../hooks/useAutoLayout";
import { TopToolbarPanel } from "./TopToolbarPanel";
import { TestCaseDialogs } from "./TestCaseDialogs";

const edgeTypes = {
  "foreign-key": ForeignKeyEdge,
  connection: HTTPConnectionEdge,
  message: MessagingEdge,
  "identity-connection": IdentityConnectionEdge,
  "transformer-reference": TransformerReferenceEdge,
  "type-reference": TypeReferenceEdge,
  reference: TransformerReferenceEdge,
};

export interface GraphViewProps {
  projectId: string;
}

export function GraphView({ projectId }: GraphViewProps) {
  const { nodes, edges, onEdgesChange, onConnect, addNode, setView } =
    useBackendCanvasStore();

  useEffect(() => {
    setView("graph");
  }, [setView]);
  const simulation = useSimulationStore();
  const selectedCaseId = useSimulationStore((state) => state.selectedCaseId);
  const testCases = useSimulationStore((state) => state.testCases);
  const selectTestCase = useSimulationStore((state) => state.selectTestCase);

  const [caseNameDialog, setCaseNameDialog] = useState<{
    mode: "create" | "rename";
    value: string;
  } | null>(null);
  const [deleteCaseOpen, setDeleteCaseOpen] = useState(false);

  const {
    handleNodesChange,
    handleNodeDragStart,
    handleSelectionDragStart,
    handleMoveEnd,
  } = useCanvasHandlers(projectId, "graph");
  const { fitView } = useReactFlow();

  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const events = useBackendCanvasStore((s) => s.events);

  const graphNodes = React.useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.type !== "group" &&
          n.type !== "entity" &&
          n.type !== "database" &&
          n.type !== "redis_instance" &&
          n.type !== "redis_schema",
      ),
    [nodes],
  );

  const graphNodeIds = React.useMemo(
    () => new Set(graphNodes.map((n) => n.id)),
    [graphNodes],
  );
  const validEndpointKeys = React.useMemo(() => {
    const keys = new Set(endpoints.map((ep) => `${ep.nodeId}::${ep.id}`));
    nodes.forEach((n) => {
      const nodeEndpoints = Array.isArray(n.data?.endpoints) ? n.data.endpoints : [];
      nodeEndpoints.forEach((ep) => {
        if (ep && typeof ep === "object" && "id" in ep && typeof ep.id === "string") {
          keys.add(`${n.id}::${ep.id}`);
        }
      });
      const routeGroups = Array.isArray(n.data?.routeGroups) ? n.data.routeGroups : [];
      routeGroups.forEach((rg) => {
        if (rg && typeof rg === "object" && "endpoints" in rg && Array.isArray(rg.endpoints)) {
          rg.endpoints.forEach((ep) => {
            if (ep && typeof ep === "object" && "id" in ep && typeof ep.id === "string") {
              keys.add(`${n.id}::${ep.id}`);
            }
          });
        }
      });
    });
    return keys;
  }, [endpoints, nodes]);

  const validEventKeys = React.useMemo(() => {
    const keys = new Set(events.map((ev) => `${ev.nodeId}::${ev.id}`));
    endpoints.forEach((ep) => {
      ep.publishedEvents?.forEach((pev) => {
        if (pev?.id) keys.add(`${ep.nodeId}::${pev.id}`);
      });
    });
    nodes.forEach((n) => {
      const published = Array.isArray(n.data?.publishedEvents) ? n.data.publishedEvents : [];
      published.forEach((pev) => {
        if (pev && typeof pev === "object" && "id" in pev && typeof pev.id === "string") {
          keys.add(`${n.id}::${pev.id}`);
        }
      });
      const consumed = Array.isArray(n.data?.consumedEvents) ? n.data.consumedEvents : [];
      consumed.forEach((cev) => {
        if (cev && typeof cev === "object" && "id" in cev && typeof cev.id === "string") {
          keys.add(`${n.id}::${cev.id}`);
        }
      });
      const nodeEndpoints = Array.isArray(n.data?.endpoints) ? n.data.endpoints : [];
      nodeEndpoints.forEach((ep) => {
        if (ep && typeof ep === "object" && "publishedEvents" in ep && Array.isArray(ep.publishedEvents)) {
          ep.publishedEvents.forEach((pev) => {
            if (pev && typeof pev === "object" && "id" in pev && typeof pev.id === "string") {
              keys.add(`${n.id}::${pev.id}`);
            }
          });
        }
      });
    });
    return keys;
  }, [events, endpoints, nodes]);

  const graphEdges = React.useMemo(() => {
    const seenIds = new Set<string>();
    return edges.filter((e) => {
      if (!e.id || seenIds.has(e.id)) {
        return false;
      }
      seenIds.add(e.id);
      if (e.type === "database-connection" || e.type === "foreign-key") {
        return false;
      }
      if (!graphNodeIds.has(e.source) || !graphNodeIds.has(e.target)) {
        return false;
      }

      if (e.sourceHandle?.startsWith("endpoint-out-") || e.sourceHandle?.startsWith("endpoint-in-")) {
        const epId = e.sourceHandle.replace(/^endpoint-(out|in)-/, "");
        if (!validEndpointKeys.has(`${e.source}::${epId}`)) return false;
      }
      if (e.targetHandle?.startsWith("endpoint-in-") || e.targetHandle?.startsWith("endpoint-out-")) {
        const epId = e.targetHandle.replace(/^endpoint-(in|out)-/, "");
        if (!validEndpointKeys.has(`${e.target}::${epId}`)) return false;
      }

      if (e.sourceHandle?.startsWith("publishedEvents-out-") || e.sourceHandle?.startsWith("consumedEvents-out-")) {
        const evId = e.sourceHandle.replace(/^(publishedEvents|consumedEvents)-out-/, "");
        if (!validEventKeys.has(`${e.source}::${evId}`)) return false;
      }
      if (e.targetHandle?.startsWith("consumedEvents-in-") || e.targetHandle?.startsWith("publishedEvents-in-")) {
        const evId = e.targetHandle.replace(/^(consumedEvents|publishedEvents)-in-/, "");
        if (!validEventKeys.has(`${e.target}::${evId}`)) return false;
      }

      return true;
    });
  }, [edges, graphNodeIds, validEndpointKeys, validEventKeys]);

  const { handleLayout } = useGraphAutoLayout({
    nodes: graphNodes,
    edges: graphEdges,
  });

  const hasFitted = useRef(false);
  useEffect(() => {
    if (graphNodes.length > 0 && !hasFitted.current) {
      hasFitted.current = true;
      const timer = setTimeout(() => {
        fitView({ duration: 500, padding: 0.35, maxZoom: 0.65 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [graphNodes.length, fitView]);



  const sortedGraphNodes = React.useMemo(() => {
    return [...graphNodes].sort((a, b) => {
      if (a.type === "webAppGroup") return -1;
      if (b.type === "webAppGroup") return 1;
      return 0;
    });
  }, [graphNodes]);

  const visualGraphNodes = React.useMemo(() => {
    const hasRun = simulation.status !== "idle";
    if (!hasRun) {
      return sortedGraphNodes;
    }

    return sortedGraphNodes.map((node) => {
      let isVisited = simulation.activeNodeIds.includes(node.id);
      let isCurrent = simulation.currentNodeId === node.id;

      if (
        node.type === "db_ref" ||
        node.type === "vector_db_ref" ||
        node.type === "redis-cache"
      ) {
        const activeEndpointIds = simulation.trace
          .slice(0, simulation.activeIndex + 1)
          .filter((t) => t.kind === "endpoint")
          .map((t) => t.id);

        const connectedToActive = edges.some((edge) => {
          if (
            edge.target === node.id &&
            simulation.activeNodeIds.includes(edge.source)
          ) {
            if (edge.sourceHandle?.startsWith("endpoint-out-")) {
              const endpointId = edge.sourceHandle.replace("endpoint-out-", "");
              return activeEndpointIds.includes(endpointId);
            }
            return true;
          }
          if (
            edge.source === node.id &&
            simulation.activeNodeIds.includes(edge.target)
          ) {
            return true;
          }
          return false;
        });
        if (connectedToActive) isVisited = true;

        const currentEndpointIds =
          simulation.trace[simulation.activeIndex]?.kind === "endpoint"
            ? [simulation.trace[simulation.activeIndex]?.id]
            : [];

        const connectedToCurrent = edges.some((edge) => {
          if (
            edge.target === node.id &&
            simulation.currentNodeId === edge.source
          ) {
            if (edge.sourceHandle?.startsWith("endpoint-out-")) {
              const endpointId = edge.sourceHandle.replace("endpoint-out-", "");
              return currentEndpointIds.includes(endpointId);
            }
            return true;
          }
          if (
            edge.source === node.id &&
            simulation.currentNodeId === edge.target
          ) {
            return true;
          }
          return false;
        });
        if (connectedToCurrent) isCurrent = true;
      }

      return {
        ...node,
        style: {
          ...node.style,
          opacity: !isVisited ? 0.14 : 1,
          transition: "opacity 180ms ease, filter 180ms ease",
          filter: isCurrent
            ? "drop-shadow(0 0 8px hsl(var(--primary)))"
            : undefined,
        },
      };
    });
  }, [sortedGraphNodes, simulation.status, simulation.activeNodeIds, simulation.currentNodeId, simulation.trace, simulation.activeIndex, edges]);


  const selectedCaseEntry = testCases.find(
    (testCase) => testCase.id === selectedCaseId,
  );

  React.useEffect(() => {
    if (!selectedCaseEntry && testCases[0]) {
      selectTestCase(testCases[0].id);
    }
  }, [testCases.length, selectedCaseId, selectedCaseEntry, selectTestCase]);

  return (
    <div className="w-full h-full bg-muted/20">
      <ReactFlow
        nodes={visualGraphNodes}
        edges={graphEdges}
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
        <TopToolbarPanel onLayout={handleLayout} />
      </ReactFlow>

      <TestCaseDialogs
        projectId={projectId}
        caseNameDialog={caseNameDialog}
        setCaseNameDialog={setCaseNameDialog}
        deleteCaseOpen={deleteCaseOpen}
        setDeleteCaseOpen={setDeleteCaseOpen}
      />
    </div>
  );
}
