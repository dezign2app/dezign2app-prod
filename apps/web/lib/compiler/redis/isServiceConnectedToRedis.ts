import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";

/**
 * Determines whether a specific service node is actively connected to any Redis node,
 * cache reference, or Redis schema.
 */
export function isServiceConnectedToRedis(
  serviceNode: BackendNode,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  endpoints: (Endpoint & { nodeId?: string })[] = [],
): boolean {
  const redisNodes = allNodes.filter(
    (n) =>
      n.type === "redis_instance" ||
      n.type === "redis_schema" ||
      n.type === "redis-cache" ||
      n.type === "redis-streams" ||
      n.type === "redis-pubsub" ||
      n.data?.dbType === "redis",
  );
  if (redisNodes.length === 0) return false;

  const redisNodeIds = new Set(redisNodes.map((r) => r.id));

  // 1. Direct or handle-based edges between service and Redis nodes
  const serviceEndpoints = [
    ...(serviceNode.data?.endpoints || []),
    ...(serviceNode.data?.routeGroups?.flatMap((rg) => rg.endpoints || []) || []),
    ...endpoints.filter((ep) => ep.nodeId === serviceNode.id),
  ];
  const serviceEndpointIds = new Set(serviceEndpoints.map((ep) => ep.id));

  const hasConnectedEdge = allEdges.some((edge) => {
    if (!edge) return false;
    const isSourceService = edge.source === serviceNode.id;
    const isTargetService = edge.target === serviceNode.id;

    if (isSourceService && redisNodeIds.has(edge.target)) return true;
    if (isTargetService && redisNodeIds.has(edge.source)) return true;

    if (edge.sourceHandle && serviceEndpointIds.size > 0) {
      for (const epId of serviceEndpointIds) {
        if (
          edge.sourceHandle.includes(epId) &&
          (redisNodeIds.has(edge.target) || redisNodeIds.has(edge.source))
        ) {
          return true;
        }
      }
    }
    return false;
  });

  if (hasConnectedEdge) return true;

  // 2. Explicit crudOperations referencing a Redis node
  const hasCrudConnection = serviceEndpoints.some((ep) => {
    if (!ep.crudOperations) return false;
    const targetIds = Object.keys(ep.crudOperations);
    return targetIds.some((id) => redisNodeIds.has(id));
  });

  if (hasCrudConnection) return true;

  // 3. databaseNodeIds or databaseNodeId referencing a Redis node
  const hasDatabaseNodeId = serviceEndpoints.some((ep) => {
    if (ep.databaseNodeId && redisNodeIds.has(ep.databaseNodeId)) return true;
    if (
      ep.databaseNodeIds &&
      ep.databaseNodeIds.some((id) => redisNodeIds.has(id))
    )
      return true;
    return false;
  });

  return hasDatabaseNodeId;
}
