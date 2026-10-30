import { BackendEdge } from "@/types/canvas";
import { ConsumedEventItem } from "@workspace/canvas/types";
import { EdgeCleanupContext } from "../types";

/**
 * Handles edge cleanup for consumedEvents-in- and consumedEvents-out- handles,
 * resetting brokerNodeId and messagingResourceId on events and service node data.
 */
export function cleanConsumedEventsHandle(
  edge: BackendEdge,
  ctx: EdgeCleanupContext,
): void {
  const consumeHandle = edge.targetHandle?.startsWith("consumedEvents-in-")
    ? edge.targetHandle
    : edge.sourceHandle?.startsWith("consumedEvents-in-")
      ? edge.sourceHandle
      : edge.targetHandle?.startsWith("consumedEvents-out-")
        ? edge.targetHandle
        : edge.sourceHandle?.startsWith("consumedEvents-out-")
          ? edge.sourceHandle
          : null;

  if (consumeHandle) {
    const eventId = consumeHandle.replace(
      /^(consumedEvents-in-|consumedEvents-out-)/,
      "",
    );

    ctx.nextEvents = ctx.nextEvents.map((ev) => {
      if (ev.id === eventId && (ev.brokerNodeId || ev.messagingResourceId)) {
        ctx.eventsChanged = true;
        const updatedEv = {
          ...ev,
          brokerNodeId: "",
          messagingResourceId: undefined,
        };
        ctx.pendingEventUpserts.push(updatedEv);
        return updatedEv;
      }
      return ev;
    });

    ctx.nextNodes = ctx.nextNodes.map((n) => {
      if (n.type === "service" && n.data?.consumedEvents) {
        const hasEv = n.data.consumedEvents.some(
          (ce: ConsumedEventItem) => ce.id === eventId,
        );
        if (hasEv) {
          ctx.nodesChanged = true;
          const updatedCons = n.data.consumedEvents.map(
            (ce: ConsumedEventItem) =>
              ce.id === eventId
                ? {
                    ...ce,
                    brokerNodeId: "",
                    messagingResourceId: undefined,
                    targetNodeId: undefined,
                  }
                : ce,
          );
          const updatedNode = {
            ...n,
            data: { ...n.data, consumedEvents: updatedCons },
          };
          ctx.pendingNodeUpserts.push(updatedNode);
          return updatedNode;
        }
      }
      return n;
    });
  }
}
