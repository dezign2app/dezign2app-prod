import { ConnectionContext } from "../types";

/**
 * Handles database/redis instance to entity/redis schema sync and Auth <-> WebApp sync.
 */
export function handleDatabaseConnect({
  get,
  sourceNode,
  targetNode,
}: ConnectionContext): void {
  // Automatically sync databaseId on target entity / redis schema node when connecting database / redis instance -> entity / redis schema
  if (
    (sourceNode.type === "database" && targetNode.type === "entity") ||
    (sourceNode.type === "redis_instance" &&
      (targetNode.type === "redis_schema" || targetNode.type === "entity"))
  ) {
    get().updateNode(targetNode.id, {
      data: {
        ...targetNode.data,
        databaseId: sourceNode.id,
      },
    });
  }

  // Automatically sync authNodeId on WebApp node when connecting Auth -> WebApp or WebApp -> Auth
  if (sourceNode.type === "auth" && targetNode.type === "webApp") {
    get().updateNode(targetNode.id, {
      data: {
        ...targetNode.data,
        authNodeId: sourceNode.id,
      },
    });
  }
  if (sourceNode.type === "webApp" && targetNode.type === "auth") {
    get().updateNode(sourceNode.id, {
      data: {
        ...sourceNode.data,
        authNodeId: targetNode.id,
      },
    });
  }
}
