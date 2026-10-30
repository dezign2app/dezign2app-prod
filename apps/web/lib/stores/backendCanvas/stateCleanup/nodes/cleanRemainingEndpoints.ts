import { Endpoint } from "@workspace/canvas/types";
import { EndpointWithNode } from "../../types";
import { DeletedNodesMeta } from "../types";
import { filterPipelineStepsOnNodeDeletion } from "./pipelineStepCleaners";

export interface CleanRemainingEndpointsResult {
  nextEndpoints: EndpointWithNode[];
  endpointsToDelete: EndpointWithNode[];
  deletedEndpointIds: Set<string>;
}

/**
 * Cleans up endpoints belonging to deleted nodes, database references, CRUD mappings,
 * published events, and pipeline steps referencing deleted nodes or resources.
 */
export function cleanRemainingEndpoints(
  endpoints: EndpointWithNode[],
  meta: DeletedNodesMeta,
  deletedEventIds: Set<string>,
): CleanRemainingEndpointsResult {
  const { allIdsSet, deletedBrokerIds, deletedBrokerTopicIds } = meta;

  const endpointsToDelete = endpoints.filter((e) => allIdsSet.has(e.nodeId));
  const deletedEndpointIds = new Set(endpointsToDelete.map((e) => e.id));

  const nextEndpoints = endpoints
    .filter((e) => !allIdsSet.has(e.nodeId))
    .map((ep) => {
      let changed = false;
      let newDbIds = ep.databaseNodeIds;
      let newDbId = ep.databaseNodeId;
      let newCrudOps = ep.crudOperations;
      let newCrudExp = ep.crudExplanations;
      let newPubEvents = ep.publishedEvents;
      let newPipelineSteps = ep.pipelineSteps;

      if (newPipelineSteps && newPipelineSteps.length > 0) {
        const filteredSteps = filterPipelineStepsOnNodeDeletion(
          newPipelineSteps,
          meta,
          deletedEndpointIds,
        );
        if (filteredSteps.length !== newPipelineSteps.length) {
          changed = true;
          newPipelineSteps = filteredSteps;
        }
      }

      if (newDbIds && newDbIds.some((id) => allIdsSet.has(id))) {
        newDbIds = newDbIds.filter((id) => !allIdsSet.has(id));
        newDbId = newDbIds[0] || "none";
        changed = true;
      }
      if (newDbId && allIdsSet.has(newDbId)) {
        newDbId = "none";
        changed = true;
      }

      if (newCrudOps) {
        const cleanedOps: NonNullable<Endpoint["crudOperations"]> = {};
        for (const [key, val] of Object.entries(newCrudOps)) {
          if (!allIdsSet.has(key)) cleanedOps[key] = val;
          else changed = true;
        }
        if (changed) newCrudOps = cleanedOps;
      }

      if (newCrudExp) {
        const cleanedExp: NonNullable<Endpoint["crudExplanations"]> = {};
        for (const [key, val] of Object.entries(newCrudExp)) {
          if (!allIdsSet.has(key)) cleanedExp[key] = val;
          else changed = true;
        }
        if (changed) newCrudExp = cleanedExp;
      }

      if (newPubEvents) {
        const cleanedEvents = newPubEvents.filter(
          (pev) =>
            !deletedEventIds.has(pev.id) &&
            !allIdsSet.has(pev.id) &&
            !(
              pev.brokerNodeId &&
              (allIdsSet.has(pev.brokerNodeId) ||
                deletedBrokerIds.has(pev.brokerNodeId))
            ) &&
            !(
              pev.messagingResourceId &&
              deletedBrokerTopicIds.has(pev.messagingResourceId)
            ),
        );
        if (cleanedEvents.length !== newPubEvents.length) {
          changed = true;
          newPubEvents = cleanedEvents;
        }
      }

      return changed
        ? {
            ...ep,
            databaseNodeIds: newDbIds,
            databaseNodeId: newDbId,
            crudOperations: newCrudOps,
            crudExplanations: newCrudExp,
            publishedEvents: newPubEvents,
            pipelineSteps: newPipelineSteps,
          }
        : ep;
    });

  return { nextEndpoints, endpointsToDelete, deletedEndpointIds };
}
