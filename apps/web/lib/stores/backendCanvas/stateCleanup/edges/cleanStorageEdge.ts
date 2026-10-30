import { BackendEdge } from "@/types/canvas";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup between storage/bucket ref nodes and endpoint in-handles,
 * removing storage_operation pipeline steps.
 */
export function cleanStorageEdge(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  const isTargetEndpointHandle =
    edge.targetHandle?.startsWith("endpoint-in-") ||
    edge.targetHandle?.startsWith("endpoints-in-") ||
    edge.targetHandle?.startsWith("routeEndpoints-in-");

  if (isTargetEndpointHandle) {
    const epId = edge.targetHandle?.replace(
      /^(?:routeEndpoints|endpoints|endpoint)-in-/,
      "",
    );
    const srcNode = ctx.currentState.nodes.find((n) => n.id === edge.source);
    if (
      srcNode &&
      (srcNode.type === "storage_operation_ref" ||
        srcNode.type === "storage_ref" ||
        srcNode.type === "bucket_ref" ||
        srcNode.type === "storage_bucket_ref" ||
        srcNode.type === "StorageBucketRefNode" ||
        srcNode.type === "StorageOperationRefNode")
    ) {
      const fnName =
        edge.sourceHandle
          ?.replace(/^func-out-/, "")
          ?.replace(/^func-(?:in-)?/, "") || "";

      ctx.nextEndpoints = ctx.nextEndpoints.map((ep) => {
        if (ep.id === epId && ep.pipelineSteps && ep.pipelineSteps.length > 0) {
          const updatedSteps = ep.pipelineSteps.filter((step) => {
            if (step.type !== "storage_operation") return true;
            if (
              fnName &&
              (step.functionRef?.name === fnName || step.operationId === fnName)
            ) {
              return false;
            }
            if (
              srcNode.data?.storageNodeId &&
              step.storageNodeId === srcNode.data.storageNodeId
            ) {
              return false;
            }
            return true;
          });
          if (updatedSteps.length !== ep.pipelineSteps.length) {
            ctx.endpointsChanged = true;
            const updatedEp = { ...ep, pipelineSteps: updatedSteps };
            ctx.pendingEndpointUpserts.push(updatedEp);
            return updatedEp;
          }
        }
        return ep;
      });
    }
  }
}
