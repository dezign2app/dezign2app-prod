import {
  BackendNode,
  BackendEdge,
  TransformerHelperNodeData,
} from "@workspace/canvas/types";
import { toVarName } from "@/lib/compiler/utils";
import { AvailableTransformer } from "../types";

/**
 * Gathers all transformer helpers and standalone transformer nodes in the project.
 */
export function getAvailableTransformers(
  allNodes: BackendNode[],
  serviceNodeId?: string,
  allEdges: BackendEdge[] = [],
): AvailableTransformer[] {
  const transformers: AvailableTransformer[] = [];
  const seenNames = new Set<string>();

  // 1. Service Helpers from the current service
  const currentService = allNodes.find((n) => n.id === serviceNodeId);
  const currentHelpers = currentService?.data?.transformerHelpers;
  if (Array.isArray(currentHelpers)) {
    currentHelpers.forEach((h: TransformerHelperNodeData) => {
      if (!h.name) return;
      const cleanName = toVarName(h.name);
      const isLocal = h.scope !== "global";
      const importPath = isLocal ? `../transformers/${cleanName}` : "@workspace/transformers";
      transformers.push({
        id: h.id || `helper-${cleanName}`,
        name: cleanName,
        description: h.description,
        scope: h.scope === "global" ? "global" : "local",
        targetServiceId: serviceNodeId,
        targetEndpointId: h.targetEndpointId,
        sourceType: "service_helper",
        importPath,
        inputSchema: h.inputSchema || [],
        returnSchema: h.returnSchema || [],
        logicMode: h.logicMode,
        code: h.code,
        prompt: h.prompt,
        isAsync: h.isAsync,
      });
      seenNames.add(h.name);
    });
  }

  // 2. Global helpers from other services
  allNodes
    .filter((n) => n.type === "service" && n.id !== serviceNodeId)
    .forEach((svc) => {
      const otherHelpers = svc.data?.transformerHelpers;
      if (Array.isArray(otherHelpers)) {
        otherHelpers.forEach((h: TransformerHelperNodeData) => {
          if (h.name && h.scope === "global" && !seenNames.has(h.name)) {
            transformers.push({
              id: h.id || `helper-${h.name}`,
              name: h.name,
              description: h.description,
              scope: "global",
              targetServiceId: svc.id,
              targetEndpointId: h.targetEndpointId,
              sourceType: "service_helper",
              importPath: "@workspace/transformers",
              inputSchema: h.inputSchema || [],
              returnSchema: h.returnSchema || [],
              logicMode: h.logicMode,
              code: h.code,
              prompt: h.prompt,
              isAsync: h.isAsync,
            });
            seenNames.add(h.name);
          }
        });
      }
    });

  // 3. Standalone Transformer Nodes from Canvas
  allNodes
    .filter((n) => n.type === "transformer")
    .forEach((tNode) => {
      const nodeData = tNode.data;
      const rawName = nodeData?.functionName || nodeData?.label || "transformData";
      const fnName = toVarName(rawName);
      if (!fnName || seenNames.has(fnName)) return;

      let targetServiceId = nodeData?.targetServiceId;
      if (!targetServiceId) {
        const edge = allEdges.find(
          (e) => e.source === tNode.id || e.target === tNode.id,
        );
        if (edge) {
          const otherId = edge.source === tNode.id ? edge.target : edge.source;
          const other = allNodes.find(
            (n) => n.id === otherId && n.type === "service",
          );
          if (other) targetServiceId = other.id;
        }
      }

      const scope = nodeData?.scope === "local" ? "local" : "global";
      const isLocalToCurrent =
        scope === "local" &&
        (!targetServiceId || targetServiceId === serviceNodeId);
      const importPath = isLocalToCurrent
        ? `../transformers/${fnName}`
        : "@workspace/transformers";

      // Check if there's already a transformer_ref node for this service
      const refNode = allNodes.find(
        (n) =>
          n.type === "transformer_ref" &&
          (n.data?.targetServiceId === serviceNodeId ||
            allEdges.some((e) => e.source === n.id && e.target === serviceNodeId)),
      );

      transformers.push({
        id: tNode.id,
        name: fnName,
        description: nodeData?.description,
        scope,
        targetServiceId,
        targetEndpointId: nodeData?.targetEndpointId,
        sourceType: "canvas_node",
        nodeId: tNode.id,
        transformerRefNodeId: refNode?.id,
        importPath,
        inputSchema: nodeData?.inputSchema || [],
        returnSchema: nodeData?.returnSchema || [],
        logicMode: nodeData?.logicMode,
        code: nodeData?.code,
        prompt: nodeData?.prompt,
        isAsync: nodeData?.isAsync,
      });
      seenNames.add(fnName);
    });

  return transformers;
}
