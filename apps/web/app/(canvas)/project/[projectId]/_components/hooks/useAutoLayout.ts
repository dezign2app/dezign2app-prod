import { useCallback } from "react";
import { useReactFlow, Position } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  HEAD_TARGET_HANDLES,
  HEAD_NODE_TYPES,
  TARGET_NODE_TYPES,
  type LayoutNode,
  type LayoutEdge,
  type PositionNodeChange,
  type UseAutoLayoutOptions,
} from "./auto-layout/types";
import { getNodeDimensions, getIsPkNode } from "./auto-layout/nodeDimensions";
import { runBarycenterRefinement } from "./auto-layout/barycenterLayout";
import { layoutHeadNodes } from "./auto-layout/headNodeLayout";
import { layoutSchemaRanks } from "./auto-layout/schemaRankLayout";

export type {
  LayoutNode,
  LayoutEdge,
  PositionNodeChange,
  UseAutoLayoutOptions,
};

export function useAutoLayout(options?: UseAutoLayoutOptions) {
  const { fitView } = useReactFlow();
  const store = useBackendCanvasStore();

  const nodes: LayoutNode[] = options?.nodes ?? store.nodes;
  const edges: LayoutEdge[] = options?.edges ?? store.edges;
  const onNodesChange = options?.onNodesChange ?? store.onNodesChange;

  // Store-level endpoint & event lists for handle-aware barycenter
  const storeEndpoints = store.endpoints;
  const storeEvents = store.events;

  const handleLayout = useCallback(
    (direction: string = "LR") => {
      const isHorizontal = direction === "LR";

      // 1. Identify Target nodes (nodes that can have attached head nodes)
      const targetNodeIds = new Set<string>();
      nodes.forEach((n: LayoutNode) => {
        if (TARGET_NODE_TYPES.has(n.type ?? "")) {
          targetNodeIds.add(n.id);
        }
      });
      edges.forEach((edge: LayoutEdge) => {
        if (HEAD_TARGET_HANDLES.has(edge.targetHandle ?? "")) {
          targetNodeIds.add(edge.target);
        }
      });

      // 2. Identify head-connection edges vs main flow edges
      const isHeadConnectionEdge = (edge: LayoutEdge): boolean => {
        const isTargetMatch = targetNodeIds.has(edge.target);
        const isHeadHandle = HEAD_TARGET_HANDLES.has(edge.targetHandle ?? "");
        const sourceNodeType =
          nodes.find((n: LayoutNode) => n.id === edge.source)?.type ?? "";
        const isHeadSourceType = HEAD_NODE_TYPES.has(sourceNodeType);
        return isTargetMatch && (isHeadHandle || isHeadSourceType);
      };

      const headEdges: LayoutEdge[] = edges.filter(isHeadConnectionEdge);
      const flowEdges: LayoutEdge[] = edges.filter(
        (e: LayoutEdge) => !isHeadConnectionEdge(e),
      );

      // 3. Identify attached head nodes (nodes attached to a target node's top handles)
      const attachedHeadNodeIdSet = new Set<string>(
        headEdges.map((e: LayoutEdge) => e.source),
      );
      const attachedHeadNodes: LayoutNode[] = nodes.filter((n: LayoutNode) =>
        attachedHeadNodeIdSet.has(n.id),
      );
      const nonHeadNodes: LayoutNode[] = nodes.filter(
        (n: LayoutNode) => !attachedHeadNodeIdSet.has(n.id),
      );

      // 3.5. Separate Database nodes & Database connection edges from flowNodes & flowEdges
      const isDatabaseNode = (n: LayoutNode) => n.type === "database";
      const databaseNodes = nonHeadNodes.filter(isDatabaseNode);
      const databaseNodeIdSet = new Set(databaseNodes.map((n) => n.id));

      const isDatabaseConnectionEdge = (e: LayoutEdge): boolean => {
        return (
          e.type === "database-connection" ||
          databaseNodeIdSet.has(e.source) ||
          databaseNodeIdSet.has(e.target)
        );
      };

      const databaseEdges = flowEdges.filter(isDatabaseConnectionEdge);
      const entityFlowEdges: LayoutEdge[] = flowEdges.filter(
        (e: LayoutEdge) => !isDatabaseConnectionEdge(e),
      );
      const entityFlowNodes: LayoutNode[] = nonHeadNodes.filter(
        (n: LayoutNode) => !isDatabaseNode(n),
      );

      // 4. Run Dagre layout for entityFlowNodes and entityFlowEdges (Entity tables DAG)
      const isSchemaView =
        nonHeadNodes.length > 0 &&
        nonHeadNodes.every((n) => n.type === "entity" || n.type === "database");
      const hasEntityNodes = nonHeadNodes.some(
        (n) => n.type === "entity" || n.type === "database",
      );

      // Schema views MUST stay LR — column handles are fixed at Position.Right (source)
      // and Position.Left (target) in ColumnRow.tsx. Forcing TB would make bezier curves
      // loop all the way around nodes, looking like they hit the top of the card.
      const schemaDirection = isSchemaView ? "LR" : direction;
      const isSchemaHorizontal = schemaDirection === "LR";


      const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(
        () => ({}),
      );
      dagreGraph.setGraph({
        rankdir: schemaDirection,
        marginx: isSchemaView ? 120 : 80,
        marginy: isSchemaView ? 120 : 80,
        // Wide ranksep so tables at adjacent ranks have breathing room
        ranksep: isSchemaView
          ? 320
          : hasEntityNodes
            ? isHorizontal
              ? 280
              : 220
            : isHorizontal
              ? 200
              : 150,
        // Tighter nodesep than before so the hub rank doesn't blow out vertically
        nodesep: isSchemaView ? 80 : hasEntityNodes ? 160 : 110,
      });


      entityFlowNodes.forEach((node: LayoutNode) => {
        const { width, height } = getNodeDimensions(node);
        dagreGraph.setNode(node.id, { width, height });
      });

      entityFlowEdges.forEach((edge: LayoutEdge) => {
        if (isSchemaView && edge.type === "foreign-key") {
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

      // 5. Store positions computed by Dagre
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

      // 5.5. Layout pass: schema multi-column staggering for schema view, barycenter for canvas graph
      if (isSchemaView) {
        layoutSchemaRanks({
          dagreGraph,
          entityFlowNodes,
          entityFlowEdges,
          positionsMap,
        });
      } else {
        runBarycenterRefinement({
          dagreGraph,
          flowNodes: entityFlowNodes,
          flowEdges: entityFlowEdges,
          positionsMap,
          isHorizontal: isSchemaHorizontal,
          storeEndpoints,
          storeEvents,
        });
      }

      // 6. Layout attached head nodes grouped by category columns above each target node
      layoutHeadNodes({
        targetNodeIds,
        nodes,
        positionsMap,
        headEdges,
        attachedHeadNodes,
      });

      // 6.5. Layout Database Node(s) at the top of the schema canvas
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
              connectedEntityIds.size > 0
                ? connectedEntityIds.has(fn.id)
                : true,
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

          // Horizontal spacing pass if multiple database nodes exist
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

      // 6.6. Enforce positive canvas origin margin (minX >= 60, minY >= 60)
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

      // 7. Update node positions atomically
      if (options?.onNodesChange) {
        const nodeChanges: PositionNodeChange[] = nodes.map((node: LayoutNode) => {
          const pos = positionsMap.get(node.id) ?? {
            x: node.position.x,
            y: node.position.y,
          };
          const isDb = databaseNodeIdSet.has(node.id);
          return {
            id: node.id,
            type: "position",
            position: pos,
            sourcePosition: isDb
              ? Position.Bottom
              : isHorizontal
                ? Position.Right
                : Position.Bottom,
            targetPosition: isDb
              ? Position.Top
              : isHorizontal
                ? Position.Left
                : Position.Top,
          };
        });
        options.onNodesChange(nodeChanges);
      } else {
        useBackendCanvasStore.setState((state) => {
          const updatedNodes = state.nodes.map((node) => {
            const pos = positionsMap.get(node.id);
            if (!pos) return node;
            const isAttachedHead = attachedHeadNodeIdSet.has(node.id);
            const isDb = databaseNodeIdSet.has(node.id);
            return {
              ...node,
              position: pos,
              sourcePosition: isDb
                ? Position.Bottom
                : isAttachedHead
                  ? Position.Bottom
                  : isHorizontal
                    ? Position.Right
                    : Position.Bottom,
              targetPosition: isDb
                ? Position.Top
                : isAttachedHead
                  ? Position.Top
                  : isHorizontal
                    ? Position.Left
                    : Position.Top,
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

      // Smoothly fit view after DOM renders cleanly
      setTimeout(() => {
        fitView({ duration: 300, padding: 0.15 });
      }, 50);
    },
    [nodes, edges, fitView, options?.onNodesChange, storeEndpoints, storeEvents],
  );

  return { handleLayout };
}
