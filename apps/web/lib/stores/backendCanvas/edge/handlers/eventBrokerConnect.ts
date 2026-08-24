import { ConnectionContext } from "../types";

/**
 * Handles updating brokerNodeId on published/consumed events when connected via messaging handles.
 */
export function handleEventBrokerConnect({
  get,
  connection,
}: ConnectionContext): void {
  const isPublishedConnect = connection.sourceHandle?.startsWith(
    "publishedEvents-out-",
  );
  const isConsumedConnect =
    connection.targetHandle?.startsWith("consumedEvents-in-");

  if (isPublishedConnect && connection.sourceHandle) {
    const eventId = connection.sourceHandle.replace(
      "publishedEvents-out-",
      "",
    );
    get().updateEvent(eventId, {
      brokerNodeId: connection.target ?? undefined,
    });
  }

  if (isConsumedConnect && connection.targetHandle) {
    const eventId = connection.targetHandle.replace("consumedEvents-in-", "");
    get().updateEvent(eventId, {
      brokerNodeId: connection.source ?? undefined,
    });
  }
}
