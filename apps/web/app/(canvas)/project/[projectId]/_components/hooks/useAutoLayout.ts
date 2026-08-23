import { useCallback, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  type LayoutNode,
  type LayoutEdge,
  type PositionNodeChange,
  type UseAutoLayoutOptions,
  type UseGraphAutoLayoutOptions,
  type UseSchemaAutoLayoutOptions,
  type UseLangGraphAutoLayoutOptions,
} from "./auto-layout/types";

import { performSchemaLayout } from "./auto-layout/schemaLayout";
import { performGraphLayout } from "./auto-layout/graphLayout";
import { performLangGraphLayout } from "./auto-layout/langGraphLayout";

export type {
  LayoutNode,
  LayoutEdge,
  PositionNodeChange,
  UseAutoLayoutOptions,
  UseGraphAutoLayoutOptions,
  UseSchemaAutoLayoutOptions,
  UseLangGraphAutoLayoutOptions,
};

/**
 * Dedicated Auto Layout Hook for Schema View (Database & Entity Tables)
 */
export function useSchemaAutoLayout(options?: UseSchemaAutoLayoutOptions) {
  const { fitView } = useReactFlow();
  const store = useBackendCanvasStore();

  const nodes: LayoutNode[] =
    options?.nodes ??
    store.nodes.filter(
      (n) =>
        n.type === "entity" ||
        n.type === "database" ||
        n.type === "redis_instance" ||
        n.type === "redis_schema",
    );
  const edges: LayoutEdge[] =
    options?.edges ??
    store.edges.filter(
      (e) =>
        e.type === "foreign-key" ||
        e.type === "database-connection" ||
        e.type === "connection",
    );
  const onNodesChange = options?.onNodesChange ?? store.onNodesChange;

  const handleLayout = useCallback(
    (direction: string = "LR") => {
      performSchemaLayout({
        nodes,
        edges,
        onNodesChange,
        fitView,
        direction,
      });
    },
    [nodes, edges, onNodesChange, fitView],
  );

  return { handleLayout };
}

/**
 * Dedicated Auto Layout Hook for Canvas Graph View (Services, Microservices, Gateways, Queues, etc.)
 */
export function useGraphAutoLayout(options?: UseGraphAutoLayoutOptions) {
  const { fitView } = useReactFlow();
  const store = useBackendCanvasStore();

  const nodes: LayoutNode[] =
    options?.nodes ??
    store.nodes.filter(
      (n) =>
        n.type !== "group" &&
        n.type !== "entity" &&
        n.type !== "database" &&
        n.type !== "redis_instance" &&
        n.type !== "redis_schema",
    );
  const edges: LayoutEdge[] =
    options?.edges ??
    store.edges.filter(
      (e) =>
        e.type !== "database-connection" &&
        e.type !== "foreign-key" &&
        e.type !== "transformer-reference" &&
        e.type !== "reference",
    );
  const onNodesChange = options?.onNodesChange ?? store.onNodesChange;

  const storeEndpoints = store.endpoints;
  const storeEvents = useMemo(() => {
    const all = [...store.events];
    store.endpoints.forEach((ep) => {
      ep.publishedEvents?.forEach((pev) => {
        all.push({ ...pev, nodeId: ep.nodeId, variant: "publish" as const });
      });
    });
    return all;
  }, [store.events, store.endpoints]);

  const handleLayout = useCallback(
    (direction: string = "LR") => {
      performGraphLayout({
        nodes,
        edges,
        onNodesChange,
        fitView,
        direction,
        storeEndpoints,
        storeEvents,
      });
    },
    [nodes, edges, onNodesChange, fitView, storeEndpoints, storeEvents],
  );

  return { handleLayout };
}

/**
 * Dedicated Auto Layout Hook for LangGraph Studio View
 */
export function useLangGraphAutoLayout(options?: UseLangGraphAutoLayoutOptions) {
  const { fitView } = useReactFlow();

  const nodes: LayoutNode[] = options?.nodes ?? [];
  const edges: LayoutEdge[] = options?.edges ?? [];
  const onNodesChange = options?.onNodesChange;

  const handleLayout = useCallback(
    (direction: string = "LR") => {
      performLangGraphLayout({
        nodes,
        edges,
        onNodesChange,
        fitView,
        direction,
      });
    },
    [nodes, edges, onNodesChange, fitView],
  );

  return { handleLayout };
}

/**
 * Unified Auto Layout Hook with automatic view strategy dispatching
 */
export function useAutoLayout(options?: UseAutoLayoutOptions) {
  const { fitView } = useReactFlow();
  const store = useBackendCanvasStore();

  const nodes: LayoutNode[] = options?.nodes ?? store.nodes;
  const edges: LayoutEdge[] = options?.edges ?? store.edges;
  const onNodesChange = options?.onNodesChange;

  const storeEndpoints = store.endpoints;
  const storeEvents = useMemo(() => {
    const all = [...store.events];
    store.endpoints.forEach((ep) => {
      ep.publishedEvents?.forEach((pev) => {
        all.push({ ...pev, nodeId: ep.nodeId, variant: "publish" as const });
      });
    });
    return all;
  }, [store.events, store.endpoints]);

  const handleLayout = useCallback(
    (direction: string = "LR") => {
      const nonHeadNodes = nodes.filter(
        (n) => n.type !== "api_endpoint" && n.type !== "event_item",
      );

      const isSchemaView =
        nonHeadNodes.length > 0 &&
        nonHeadNodes.every(
          (n) =>
            n.type === "entity" ||
            n.type === "database" ||
            n.type === "redis_instance" ||
            n.type === "redis_schema",
        );

      const isLangGraphView = nonHeadNodes.some(
        (n) =>
          n.type === "step" ||
          n.type === "langgraph_agent" ||
          n.type === "langgraph_node" ||
          n.type === "start" ||
          n.id === "START",
      );

      if (isSchemaView) {
        performSchemaLayout({
          nodes,
          edges,
          onNodesChange: onNodesChange ?? store.onNodesChange,
          fitView,
          direction,
        });
      } else if (isLangGraphView) {
        performLangGraphLayout({
          nodes,
          edges,
          onNodesChange,
          fitView,
          direction,
        });
      } else {
        performGraphLayout({
          nodes,
          edges,
          onNodesChange: onNodesChange ?? store.onNodesChange,
          fitView,
          direction,
          storeEndpoints,
          storeEvents,
        });
      }
    },
    [nodes, edges, onNodesChange, fitView, storeEndpoints, storeEvents, store.onNodesChange],
  );

  return { handleLayout };
}
