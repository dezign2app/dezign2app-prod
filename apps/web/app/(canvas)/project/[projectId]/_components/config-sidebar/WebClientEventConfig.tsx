import React, { useState, useEffect } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Accordion } from "@workspace/ui/components/accordion";
import { BackendNode, UIEventItem } from "@/types/canvas";
import { Endpoint, WEB_CLIENT_EVENTS } from "@workspace/canvas";
import {
  TargetEndpointSection,
  EventPropertiesSection,
  EventNavigationSection,
} from "./web-client-event-config";

const EVENT_OPTIONS = [...WEB_CLIENT_EVENTS];

const SERVER_NODE_TYPES = [
  "service",
  "gateway",
  "serverless",
  "langgraph",
  "worker",
  "external",
];

/** Collect all endpoints from a node */
function collectEndpoints(
  node: BackendNode,
  storeEndpoints: (Endpoint & { nodeId: string })[],
): Endpoint[] {
  const results: Endpoint[] = [];

  const persisted = storeEndpoints.filter((ep) => ep.nodeId === node.id);
  results.push(...persisted);

  if (node.data.endpoints) {
    for (const ep of node.data.endpoints) {
      if (!results.find((r) => r.id === ep.id)) results.push(ep);
    }
  }

  if (node.data.routeGroups) {
    for (const group of node.data.routeGroups) {
      for (const ep of group.endpoints || []) {
        if (!results.find((r) => r.id === ep.id)) results.push(ep);
      }
    }
  }

  return results;
}

interface WebClientEventConfigProps {
  id: string; // The event ID
  nodeId: string;
}

export const WebClientEventConfig = ({ id, nodeId }: WebClientEventConfigProps) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const onConnect = useBackendCanvasStore((s) => s.onConnect);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);

  // Find the parent WebClient node and the event item
  const parentNode = nodes.find((n) => n.id === nodeId);
  const currentEvents = parentNode?.data?.events || [];
  const item: UIEventItem | undefined = currentEvents.find((e) => e.id === id);

  const initialEvent = item?.event || "click";
  const isStandard = EVENT_OPTIONS.some((opt) => opt === initialEvent);

  const [eventName, setEventName] = useState(item?.name || "");
  const [eventType, setEventType] = useState(
    isStandard ? initialEvent : initialEvent ? "other" : "click",
  );
  const [customEvent, setCustomEvent] = useState(
    isStandard ? "" : initialEvent,
  );
  const [eventSchema, setEventSchema] = useState(item?.schema || "");
  const [navType, setNavType] = useState<"link" | "router">(
    item?.navigationType || "link",
  );
  const [navCond, setNavCond] = useState<
    "direct" | "on_success" | "on_condition" | "on_error"
  >(item?.navigationCondition || "direct");
  const [condCode, setCondCode] = useState(item?.conditionCode || "");

  useEffect(() => {
    if (item) {
      setEventName(item.name || "");
      const evt = item.event || "click";
      const isStd = EVENT_OPTIONS.some((opt) => opt === evt);
      setEventType(isStd ? evt : evt ? "other" : "click");
      setCustomEvent(isStd ? "" : evt);
      setEventSchema(item.schema || "");
      setNavType(item.navigationType || "link");
      setNavCond(item.navigationCondition || "direct");
      setCondCode(item.conditionCode || "");
    }
  }, [item]);

  const handleUpdateEvent = (
    name: string,
    finalEvent: string,
    schema: string,
    extraChanges?: Partial<UIEventItem>,
  ) => {
    if (!parentNode) return;
    const currentNodeEvents = parentNode.data.events || [];
    const newEvents: UIEventItem[] = currentNodeEvents.map((e) =>
      e.id === id
        ? {
            ...e,
            name,
            event: finalEvent,
            schema,
            navigationType:
              finalEvent === "navigateToPage"
                ? "link"
                : extraChanges?.navigationType ?? navType,
            navigationCondition: extraChanges?.navigationCondition ?? navCond,
            conditionCode: extraChanges?.conditionCode ?? condCode,
            ...extraChanges,
          }
        : e,
    );
    updateNode(nodeId, { data: { ...parentNode.data, events: newEvents } });

    // Manage PageRef node & edge lifecycle
    const store = useBackendCanvasStore.getState();
    const existingEdge = store.edges.find(
      (e) => e.source === nodeId && e.sourceHandle === `events-${id}`,
    );

    if (finalEvent !== "navigateToPage") {
      if (existingEdge) {
        const targetNode = store.nodes.find((n) => n.id === existingEdge.target);
        if (targetNode && targetNode.type === "page_ref") {
          store.deleteEdge(existingEdge.id);
          const remainingEdges = store.edges.filter(
            (e) => e.target === targetNode.id && e.id !== existingEdge.id,
          );
          if (remainingEdges.length === 0) {
            store.deleteNode(targetNode.id);
          }
        }
      }
    } else if (!existingEdge) {
      const currentNode = store.nodes.find((n) => n.id === nodeId);
      const pos = currentNode?.position || { x: 100, y: 100 };
      const newRefId = crypto.randomUUID();

      store.addNode({
        id: newRefId,
        type: "page_ref",
        position: { x: pos.x + 340, y: pos.y + 60 },
        data: {
          label: "Page Ref",
          description: "Target page reference for navigation",
        },
      });

      store.addEdge({
        id: `edge-${Date.now()}`,
        source: nodeId,
        target: newRefId,
        sourceHandle: `events-${id}`,
        targetHandle: "page-ref-in",
        type: "connection",
      });
    }
  };

  // Find linked endpoint via existing edge
  const existingEdge = edges.find(
    (e) => e.source === nodeId && e.sourceHandle === `events-${id}`,
  );

  const getLinkedEndpoint = () => {
    if (!existingEdge || !existingEdge.targetHandle) return null;
    const targetNode = nodes.find((n) => n.id === existingEdge.target);
    if (!targetNode) return null;
    const parts = existingEdge.targetHandle.split("-in-");
    const endpointId = parts[parts.length - 1];
    if (!endpointId) return null;

    let endpoint: Endpoint | undefined = endpoints.find(
      (ep) => ep.nodeId === targetNode.id && ep.id === endpointId,
    );
    if (!endpoint)
      endpoint = targetNode.data?.endpoints?.find(
        (ep: Endpoint) => ep.id === endpointId,
      );
    if (!endpoint && targetNode.data?.routeGroups) {
      for (const group of targetNode.data.routeGroups) {
        endpoint = group.endpoints?.find(
          (ep: Endpoint) => ep.id === endpointId,
        );
        if (endpoint) break;
      }
    }
    if (!endpoint) return null;
    return { targetNode, endpoint };
  };

  const link = getLinkedEndpoint();
  const linkedTargetNode = link?.targetNode;
  const endpoint = link?.endpoint;

  // All service nodes available on the canvas
  const serviceNodes = nodes.filter(
    (n) => n.id !== nodeId && SERVER_NODE_TYPES.includes(n.type),
  );

  const currentServiceId = linkedTargetNode?.id || "";
  const currentEndpointId = endpoint?.id || "";

  const availableEndpoints = linkedTargetNode
    ? collectEndpoints(linkedTargetNode, endpoints)
    : [];

  const handleServiceChange = (serviceId: string) => {
    // Remove existing edge for this event
    if (existingEdge) {
      deleteEdge(existingEdge.id);
    }
    if (serviceId === "none" || !serviceId) return;

    // Target service selected; user can pick endpoint next
    const targetService = serviceNodes.find((n) => n.id === serviceId);
    if (!targetService) return;

    const endpointsList = collectEndpoints(targetService, endpoints);
    if (endpointsList.length > 0 && endpointsList[0]) {
      const targetEp = endpointsList[0];
      onConnect({
        source: nodeId,
        target: serviceId,
        sourceHandle: `events-${id}`,
        targetHandle: `endpoint-in-${targetEp.id}`,
      });
    }
  };

  const handleEndpointChange = (endpointId: string) => {
    if (!currentServiceId) return;

    // Remove old edge
    if (existingEdge) {
      deleteEdge(existingEdge.id);
    }

    if (endpointId === "none" || !endpointId) return;

    // Connect new edge
    onConnect({
      source: nodeId,
      target: currentServiceId,
      sourceHandle: `events-${id}`,
      targetHandle: `endpoint-in-${endpointId}`,
    });
  };

  useEffect(() => {
    if (!endpoint) return;
    const inferred: Record<string, string> = {};

    if (endpoint.pathParams)
      endpoint.pathParams.forEach((p) => {
        if (p.name) inferred[p.name] = p.type || "string";
      });
    if (endpoint.queryParams)
      endpoint.queryParams.forEach((p) => {
        if (p.name) inferred[p.name] = p.type || "string";
      });
    if (endpoint.headers)
      endpoint.headers.forEach((h) => {
        if (h.name) inferred[h.name] = h.type || "string";
      });

    if (endpoint.requestBody?.rawJson) {
      try {
        const parsed = JSON.parse(endpoint.requestBody.rawJson);
        Object.assign(inferred, parsed);
      } catch {}
    }

    const strVal = JSON.stringify(inferred, null, 2);
    setEventSchema(strVal);
    handleUpdateEvent(
      eventName,
      eventType === "other" ? customEvent : eventType,
      strVal,
    );
  }, [endpoint?.id]);

  if (!item) return null;

  const isNavigateToPage = eventType === "navigateToPage";

  return (
    <div className="flex flex-col gap-5 font-sans">
      <Accordion
        type="multiple"
        defaultValue={
          isNavigateToPage
            ? ["navigation", "settings"]
            : ["connection", "settings"]
        }
        className="w-full flex flex-col gap-3 border-none"
      >
        {/* ── 1. TARGET SERVICE & ENDPOINT SELECTION ── */}
        {!isNavigateToPage && (
          <TargetEndpointSection
            currentServiceId={currentServiceId}
            currentEndpointId={currentEndpointId}
            serviceNodes={serviceNodes}
            availableEndpoints={availableEndpoints}
            linkedTargetNode={linkedTargetNode}
            endpoint={endpoint}
            handleServiceChange={handleServiceChange}
            handleEndpointChange={handleEndpointChange}
          />
        )}

        {/* ── 2. EVENT PROPERTIES & SCHEMA ── */}
        <EventPropertiesSection
          eventName={eventName}
          eventType={eventType}
          customEvent={customEvent}
          eventSchema={eventSchema}
          eventOptions={EVENT_OPTIONS}
          isNavigateToPage={isNavigateToPage}
          setEventName={setEventName}
          setEventType={setEventType}
          setCustomEvent={setCustomEvent}
          setEventSchema={setEventSchema}
          handleUpdateEvent={handleUpdateEvent}
        />

        {/* ── 3. TARGET PAGE NAVIGATION ── */}
        <EventNavigationSection
          eventId={id}
          nodeId={nodeId}
          eventName={eventName}
          eventType={eventType}
          customEvent={customEvent}
          eventSchema={eventSchema}
          item={item}
          handleUpdateEvent={handleUpdateEvent}
        />
      </Accordion>
    </div>
  );
};
