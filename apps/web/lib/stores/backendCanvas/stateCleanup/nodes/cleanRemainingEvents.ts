import { EventWithNode } from "../../types";
import { DeletedNodesMeta } from "../types";
import { filterPipelineStepsOnNodeDeletion } from "./pipelineStepCleaners";

export interface CleanRemainingEventsResult {
  nextEvents: EventWithNode[];
  eventsToDelete: EventWithNode[];
  deletedEventIds: Set<string>;
}

/**
 * Cleans up events belonging to deleted nodes, broker references on surviving events,
 * and pipeline steps referencing deleted nodes or resources.
 */
export function cleanRemainingEvents(
  events: EventWithNode[],
  meta: DeletedNodesMeta,
  deletedEndpointIds: Set<string>,
): CleanRemainingEventsResult {
  const { allIdsSet, deletedBrokerIds, deletedBrokerTopicIds } = meta;

  const eventsToDelete = events.filter((ev) => allIdsSet.has(ev.nodeId));
  const deletedEventIds = new Set(eventsToDelete.map((ev) => ev.id));

  const nextEvents = events
    .filter((ev) => !allIdsSet.has(ev.nodeId))
    .map((ev) => {
      let evChanged = false;
      let updatedEv = ev;

      if (
        (ev.brokerNodeId &&
          (allIdsSet.has(ev.brokerNodeId) ||
            deletedBrokerIds.has(ev.brokerNodeId))) ||
        (ev.messagingResourceId &&
          deletedBrokerTopicIds.has(ev.messagingResourceId))
      ) {
        updatedEv = {
          ...updatedEv,
          brokerNodeId: "",
          messagingResourceId: undefined,
        };
        evChanged = true;
      }

      if (updatedEv.pipelineSteps && updatedEv.pipelineSteps.length > 0) {
        const filteredSteps = filterPipelineStepsOnNodeDeletion(
          updatedEv.pipelineSteps,
          meta,
          deletedEndpointIds,
        );
        if (filteredSteps.length !== updatedEv.pipelineSteps.length) {
          updatedEv = { ...updatedEv, pipelineSteps: filteredSteps };
          evChanged = true;
        }
      }

      return evChanged ? updatedEv : ev;
    });

  return { nextEvents, eventsToDelete, deletedEventIds };
}
