import { useMemo } from "react";
import type { LangGraphCanvasEdge } from "../types";
import {
  HANDLE_LLM_IN,
  HANDLE_TOOL_IN,
  HANDLE_MIDDLEWARE_IN,
  HANDLE_MEMORY_IN,
} from "../constants";

export interface ConnectedNodeResources {
  connectedLLMId: string | null;
  connectedToolIds: string[];
  connectedMiddlewareIds: string[];
  connectedMemoryIds: string[];
  connectedToolsCount: number;
  connectedMiddlewareCount: number;
}

export type MinimalCanvasEdge = {
  source: string;
  target: string;
  targetHandle?: string | null;
};

/**
 * Pure helper to extract connected LLM, Tools, Middleware, and Memory IDs for a given canvas node.
 */
export function getConnectedNodeResources(
  nodeId?: string | null,
  edges?: MinimalCanvasEdge[] | LangGraphCanvasEdge[],
): ConnectedNodeResources {
  if (!nodeId || !edges || edges.length === 0) {
    return {
      connectedLLMId: null,
      connectedToolIds: [],
      connectedMiddlewareIds: [],
      connectedMemoryIds: [],
      connectedToolsCount: 0,
      connectedMiddlewareCount: 0,
    };
  }

  const llmEdge = edges.find(
    (e) => e.target === nodeId && e.targetHandle === HANDLE_LLM_IN,
  );
  const connectedLLMId = llmEdge ? llmEdge.source : null;

  const connectedToolIds = edges
    .filter((e) => e.target === nodeId && e.targetHandle === HANDLE_TOOL_IN)
    .map((e) => e.source);

  const connectedMiddlewareIds = edges
    .filter(
      (e) => e.target === nodeId && e.targetHandle === HANDLE_MIDDLEWARE_IN,
    )
    .map((e) => e.source);

  const connectedMemoryIds = edges
    .filter((e) => e.target === nodeId && e.targetHandle === HANDLE_MEMORY_IN)
    .map((e) => e.source);

  return {
    connectedLLMId,
    connectedToolIds,
    connectedMiddlewareIds,
    connectedMemoryIds,
    connectedToolsCount: connectedToolIds.length,
    connectedMiddlewareCount: connectedMiddlewareIds.length,
  };
}

/**
 * Hook to memoize connected resources for a specific node from canvas edges.
 */
export function useConnectedNodeResources(
  nodeId?: string | null,
  edges?: MinimalCanvasEdge[] | LangGraphCanvasEdge[],
): ConnectedNodeResources {
  return useMemo(
    () => getConnectedNodeResources(nodeId, edges),
    [nodeId, edges],
  );
}
