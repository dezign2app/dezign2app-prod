import { DeletionTarget } from "../types";
import { SubItemSimulationContext, SubItemSimulationResult } from "./types";
import { handleColumnDeletion } from "./handleColumnDeletion";
import { handleIndexDeletion } from "./handleIndexDeletion";
import { handleSectionDeletion } from "./handleSectionDeletion";
import { handleActionDeletion } from "./handleActionDeletion";
import { handleZoneDeletion } from "./handleZoneDeletion";
import { handleEndpointDeletion } from "./handleEndpointDeletion";
import { handlePageRename } from "./handlePageRename";
import { handleCustomDeletion } from "./handleCustomDeletion";

export function simulateSubItemDeletion(
  ctx: SubItemSimulationContext,
  target: DeletionTarget,
): SubItemSimulationResult {
  if (target.type === "column") {
    return handleColumnDeletion(ctx, target);
  }
  if (target.type === "index") {
    return handleIndexDeletion(ctx, target);
  }
  if (target.type === "section") {
    return handleSectionDeletion(ctx, target);
  }
  if (target.type === "action") {
    return handleActionDeletion(ctx, target);
  }
  if (target.type === "zone") {
    return handleZoneDeletion(ctx, target);
  }
  if (target.type === "endpoint") {
    return handleEndpointDeletion(ctx, target);
  }
  if (target.type === "pageRename") {
    return handlePageRename(ctx, target);
  }
  if (target.type === "custom") {
    return handleCustomDeletion(ctx, target);
  }

  return {
    nextNodes: [...ctx.nodes],
    nextEndpoints: [...ctx.endpoints],
    nextEvents: [...ctx.events],
    nextEdges: [...ctx.edges],
    targetNodes: [],
    severedConnections: [],
    cascadeElements: [],
    brokenReferences: [],
  };
}
