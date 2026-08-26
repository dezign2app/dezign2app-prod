import { NodeConnectionDetail } from "@workspace/canvas/types";

/**
 * Deduplicates trace items based on nodeId, nodeName, and detail
 */
export function deduplicateTraces(
  traces: NodeConnectionDetail[],
): NodeConnectionDetail[] {
  const seen = new Set<string>();
  return traces.filter((item) => {
    const key = `${item.nodeId}:${item.nodeName}:${item.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Clean path parameters for representation (e.g., /users/:id -> /users/1)
 */
export function cleanPath(pathStr: string): string {
  const p = pathStr.startsWith("/") ? pathStr : `/${pathStr}`;
  return p.replace(/:\w+|\{\w+\}/g, "1");
}
