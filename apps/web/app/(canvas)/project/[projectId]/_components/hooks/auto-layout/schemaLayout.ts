import { Position } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "./types";
import { getNodeDimensions, getIsPkNode } from "./nodeDimensions";
import { layoutSchemaRanks } from "./schemaRankLayout";

export interface PerformSchemaLayoutOptions {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  onNodesChange?: (changes: PositionNodeChange[]) => void;
  fitView: (options?: { duration?: number; padding?: number }) => void;
  direction?: string;
}

export function performSchemaLayout({
  nodes,
  edges,
  onNodesChange,
  fitView,
  direction = "LR",
}: PerformSchemaLayoutOptions) {
  // Filter for Schema nodes (entity, redis_schema, database, redis_instance) and edges (foreign-key, database-connection)
  const schemaNodes = nodes.filter(
    (n) =>
      n.type === "entity" ||
      n.type === "database" ||
      n.type === "redis_instance" ||
      n.type === "redis_schema",
  );
  if (schemaNodes.length === 0) return;

  const schemaEdges = edges.filter(
    (e) =>
      e.type === "foreign-key" ||
      e.type === "database-connection" ||
      e.type === "connection",
  );

  const isDatabaseNode = (n: LayoutNode) =>
    n.type === "database" || n.type === "redis_instance";
  const databaseNodes = schemaNodes.filter(isDatabaseNode);
  const databaseNodeIdSet = new Set(databaseNodes.map((n) => n.id));

  const isDatabaseConnectionEdge = (e: LayoutEdge): boolean => {
    return (
      e.type === "database-connection" ||
      databaseNodeIdSet.has(e.source) ||
      databaseNodeIdSet.has(e.target)
    );
  };

  const databaseEdges = schemaEdges.filter(isDatabaseConnectionEdge);
  const entityFlowEdges = schemaEdges.filter((e) => !isDatabaseConnectionEdge(e));
  const entityFlowNodes = schemaNodes.filter((n) => !isDatabaseNode(n));

  // Schema views MUST stay LR — column handles are fixed at Position.Right (source) & Position.Left (target)
  const schemaDirection = "LR";

  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: schemaDirection,
    marginx: 120,
    marginy: 120,
    ranksep: 320,
    nodesep: 50,
  });

  entityFlowNodes.forEach((node: LayoutNode) => {
    const { width, height } = getNodeDimensions(node);
    dagreGraph.setNode(node.id, { width, height });
  });

  entityFlowEdges.forEach((edge: LayoutEdge) => {
    if (edge.type === "foreign-key") {
      const sourceNode = entityFlowNodes.find((n) => n.id === edge.source);
      const targetNode = entityFlowNodes.find((n) => n.id === edge.target);

      const sourceIsPk = getIsPkNode(sourceNode, edge.sourceHandle);
      const targetIsPk = getIsPkNode(targetNode, edge.targetHandle);

      if (sourceIsPk && !targetIsPk) {
        dagreGraph.setEdge(edge.source, edge.target);
      } else if (targetIsPk && !sourceIsPk) {
        dagreGraph.setEdge(edge.target, edge.source);
      } else {
        dagreGraph.setEdge(edge.source, edge.target);
      }
    } else {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const positionsMap = new Map<string, { x: number; y: number }>();
  entityFlowNodes.forEach((node: LayoutNode) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const { width, height } = getNodeDimensions(node);
    if (nodeWithPosition) {
      positionsMap.set(node.id, {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      });
    } else {
      positionsMap.set(node.id, { x: node.position.x, y: node.position.y });
    }
  });

  // Stagger schema ranks
  layoutSchemaRanks({
    dagreGraph,
    entityFlowNodes,
    entityFlowEdges,
    positionsMap,
  });

  // Layout Database Node(s) at the top of the schema canvas
  if (databaseNodes.length > 0) {
    if (entityFlowNodes.length > 0) {
      databaseNodes.forEach((dbNode) => {
        const dbDim = getNodeDimensions(dbNode);

        const connectedEntityIds = new Set<string>();
        databaseEdges.forEach((e) => {
          if (e.source === dbNode.id) connectedEntityIds.add(e.target);
          if (e.target === dbNode.id) connectedEntityIds.add(e.source);
        });
        entityFlowNodes.forEach((fn) => {
          if ((fn.data as { databaseId?: string })?.databaseId === dbNode.id) {
            connectedEntityIds.add(fn.id);
          }
        });

        const targetEntities = entityFlowNodes.filter((fn) =>
          connectedEntityIds.size > 0 ? connectedEntityIds.has(fn.id) : true,
        );

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;

        targetEntities.forEach((fn) => {
          const pos = positionsMap.get(fn.id);
          if (!pos) return;
          const { width } = getNodeDimensions(fn);
          if (pos.x < minX) minX = pos.x;
          if (pos.x + width > maxX) maxX = pos.x + width;
          if (pos.y < minY) minY = pos.y;
        });

        if (minX === Infinity) {
          minX = 100;
          maxX = 400;
          minY = 300;
        }

        const centerX = (minX + maxX) / 2;
        const dbX = centerX - dbDim.width / 2;
        const dbY = minY - dbDim.height - 140;

        positionsMap.set(dbNode.id, { x: dbX, y: dbY });
      });

      if (databaseNodes.length > 1) {
        const sortedDbs = [...databaseNodes].sort((a, b) => {
          const posA = positionsMap.get(a.id)?.x ?? 0;
          const posB = positionsMap.get(b.id)?.x ?? 0;
          return posA - posB;
        });

        const dbGap = 60;
        for (let i = 0; i < sortedDbs.length - 1; i++) {
          const dbA = sortedDbs[i]!;
          const dbB = sortedDbs[i + 1]!;
          const posA = positionsMap.get(dbA.id)!;
          const posB = positionsMap.get(dbB.id)!;
          const dimA = getNodeDimensions(dbA);

          if (posB.x < posA.x + dimA.width + dbGap) {
            positionsMap.set(dbB.id, {
              x: posA.x + dimA.width + dbGap,
              y: posB.y,
            });
          }
        }
      }
    } else {
      let currentX = 100;
      databaseNodes.forEach((dbNode) => {
        const dim = getNodeDimensions(dbNode);
        positionsMap.set(dbNode.id, { x: currentX, y: 60 });
        currentX += dim.width + 80;
      });
    }
  }

  // Canvas origin margin check
  let globalMinX = Infinity;
  let globalMinY = Infinity;
  positionsMap.forEach((pos) => {
    if (pos.x < globalMinX) globalMinX = pos.x;
    if (pos.y < globalMinY) globalMinY = pos.y;
  });

  const shiftX = globalMinX < 60 ? 60 - globalMinX : 0;
  const shiftY = globalMinY < 60 ? 60 - globalMinY : 0;

  if (shiftX !== 0 || shiftY !== 0) {
    positionsMap.forEach((pos, id) => {
      positionsMap.set(id, {
        x: pos.x + shiftX,
        y: pos.y + shiftY,
      });
    });
  }

  // Update node positions
  if (onNodesChange) {
    const nodeChanges: PositionNodeChange[] = schemaNodes.map((node: LayoutNode) => {
      const pos = positionsMap.get(node.id) ?? {
        x: node.position.x,
        y: node.position.y,
      };
      const isDb = databaseNodeIdSet.has(node.id);
      return {
        id: node.id,
        type: "position",
        position: pos,
        sourcePosition: isDb ? Position.Bottom : Position.Right,
        targetPosition: isDb ? Position.Top : Position.Left,
      };
    });
    onNodesChange(nodeChanges);
  } else {
    useBackendCanvasStore.setState((state) => {
      const updatedNodes = state.nodes.map((node) => {
        const pos = positionsMap.get(node.id);
        if (!pos) return node;
        const isDb = databaseNodeIdSet.has(node.id);
        return {
          ...node,
          position: pos,
          sourcePosition: isDb ? Position.Bottom : Position.Right,
          targetPosition: isDb ? Position.Top : Position.Left,
        };
      });

      const movedNodeIds = new Set(positionsMap.keys());
      const upserts = updatedNodes.filter((n) => movedNodeIds.has(n.id));

      return {
        nodes: updatedNodes,
        pendingNodeUpserts: [
          ...state.pendingNodeUpserts.filter((u) => !movedNodeIds.has(u.id)),
          ...upserts,
        ],
      };
    });
  }

  setTimeout(() => {
    fitView({ duration: 300, padding: 0.15 });
  }, 50);
}
