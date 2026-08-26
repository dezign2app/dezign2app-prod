import React, { useState, useEffect } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Accordion } from "@workspace/ui/components/accordion";
import { BackendNode, UIEventItem, Parameter, Schema } from "@/types/canvas";
import { Endpoint, WEB_PAGE_EVENTS } from "@workspace/canvas";
import {
  TargetEndpointSection,
  EventPropertiesSection,
  EventNavigationSection,
  RequestConfigSection,
} from "./web-page-event-config";
import { RequestBodyMode } from "./RequestBodyEditor";
import { generateId } from "../backend-nodes/graph-nodes/common";

const EVENT_OPTIONS = [...WEB_PAGE_EVENTS];

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

export interface WebPageEventConfigProps {
  id: string; // The event ID
  nodeId: string;
}

export const WebPageEventConfig = ({ id, nodeId }: WebPageEventConfigProps) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const updateEndpoint = useBackendCanvasStore((s) => s.updateEndpoint);
  const onConnect = useBackendCanvasStore((s) => s.onConnect);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);

  // Find the parent WebPage node and the event item
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
      setNavType(item.navigationType || "link");
      setNavCond(item.navigationCondition || "direct");
      setCondCode(item.conditionCode || "");
    }
  }, [item]);

  const handleUpdateEvent = (
    name: string,
    finalEvent: string,
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

  const updateEventFields = (changes: Partial<UIEventItem>) => {
    if (!parentNode) return;
    const currentNodeEvents = parentNode.data.events || [];
    const newEvents: UIEventItem[] = currentNodeEvents.map((e) =>
      e.id === id ? { ...e, ...changes } : e,
    );
    updateNode(nodeId, { data: { ...parentNode.data, events: newEvents } });
  };

  // Find linked endpoint via existing edge
  const existingEdge = edges.find(
    (e) =>
      (e.source === nodeId &&
        (e.sourceHandle === `events-${id}` ||
          e.sourceHandle === id ||
          e.sourceHandle?.endsWith(id))) ||
      (e.target === nodeId &&
        (e.targetHandle === `events-${id}` ||
          e.targetHandle === id ||
          e.targetHandle?.endsWith(id))),
  );

  const getLinkedEndpoint = () => {
    let targetNodeId: string | undefined;
    let endpointId: string | undefined;

    if (existingEdge) {
      const isSource = existingEdge.source === nodeId;
      targetNodeId = isSource ? existingEdge.target : existingEdge.source;
      const handle = isSource
        ? existingEdge.targetHandle
        : existingEdge.sourceHandle;
      if (handle) {
        endpointId = handle.replace(
          /^(endpoint-in-|endpoint-out-|endpoints-in-|endpoints-out-|events-in-|events-out-)/,
          "",
        );
        if (endpointId.includes("-in-")) {
          const parts = endpointId.split("-in-");
          endpointId = parts[parts.length - 1];
        } else if (endpointId.includes("-out-")) {
          const parts = endpointId.split("-out-");
          endpointId = parts[parts.length - 1];
        }
      }
    }

    if (!endpointId && item?.targetRoute) {
      endpointId = item.targetRoute;
    }

    if (!targetNodeId) {
      const anyServiceEdge = edges.find(
        (e) =>
          (e.source === nodeId &&
            nodes.some(
              (n) => n.id === e.target && SERVER_NODE_TYPES.includes(n.type),
            )) ||
          (e.target === nodeId &&
            nodes.some(
              (n) => n.id === e.source && SERVER_NODE_TYPES.includes(n.type),
            )),
      );
      if (anyServiceEdge) {
        const isSource = anyServiceEdge.source === nodeId;
        targetNodeId = isSource ? anyServiceEdge.target : anyServiceEdge.source;
        const handle = isSource
          ? anyServiceEdge.targetHandle
          : anyServiceEdge.sourceHandle;
        if (handle && !endpointId) {
          endpointId = handle.replace(
            /^(endpoint-in-|endpoint-out-|endpoints-in-|endpoints-out-|events-in-|events-out-)/,
            "",
          );
          if (endpointId.includes("-in-")) {
            const parts = endpointId.split("-in-");
            endpointId = parts[parts.length - 1];
          }
        }
      }
    }

    if (!targetNodeId) return null;
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return null;

    let endpoint: Endpoint | undefined;
    if (endpointId) {
      endpoint = endpoints.find(
        (ep) =>
          ep.nodeId === targetNode.id &&
          (ep.id === endpointId || ep.name === endpointId),
      );
      if (!endpoint) {
        endpoint = endpoints.find(
          (ep) => ep.id === endpointId || ep.name === endpointId,
        );
      }
      if (!endpoint && targetNode.data?.endpoints) {
        endpoint = (targetNode.data.endpoints as Endpoint[]).find(
          (ep) => ep.id === endpointId || ep.name === endpointId,
        );
      }
      if (!endpoint && targetNode.data?.routeGroups) {
        for (const group of targetNode.data.routeGroups) {
          endpoint = (group.endpoints as Endpoint[] | undefined)?.find(
            (ep) => ep.id === endpointId || ep.name === endpointId,
          );
          if (endpoint) break;
        }
      }
    }

    if (!endpoint) {
      const srvEndpoints = endpoints.filter((ep) => ep.nodeId === targetNode.id);
      if (srvEndpoints.length > 0 && srvEndpoints[0]) {
        endpoint = srvEndpoints[0];
      } else if (
        targetNode.data?.endpoints &&
        (targetNode.data.endpoints as Endpoint[]).length > 0
      ) {
        endpoint = (targetNode.data.endpoints as Endpoint[])[0];
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

  if (!item) return null;

  const isNavigateToPage = eventType === "navigateToPage";

  // Check if authentication / protected route is enabled
  const isAuthRequired = Boolean(
    endpoint
      ? endpoint.requireAuth !== false
      : parentNode?.data?.requireAuth !== false,
  );

  // Derive live parameters and request body from connected endpoint
  const headers: Parameter[] = React.useMemo(() => {
    let baseHeaders =
      endpoint?.headers && endpoint.headers.length > 0
        ? [...endpoint.headers]
        : item?.headers && item.headers.length > 0
        ? [...item.headers]
        : [];

    if (isAuthRequired) {
      if (!baseHeaders.some((h) => h.name.toLowerCase() === "authorization")) {
        baseHeaders = [
          {
            id: "auth-bearer-header",
            name: "Authorization",
            type: "string",
            required: true,
            description: "Bearer <token>",
            defaultValue: "Bearer <token>",
            key: "Authorization",
            value: "Bearer <token>",
          },
          ...baseHeaders,
        ];
      }
    } else {
      baseHeaders = baseHeaders.filter(
        (h) => h.name.toLowerCase() !== "authorization",
      );
    }
    return baseHeaders;
  }, [endpoint?.headers, item?.headers, isAuthRequired]);

  const pathParams: Parameter[] = React.useMemo(() => {
    if (endpoint?.pathParams && endpoint.pathParams.length > 0) return endpoint.pathParams;
    if (item?.pathParams && item.pathParams.length > 0) return item.pathParams;
    return [];
  }, [endpoint?.pathParams, item?.pathParams]);

  const queryParams: Parameter[] = React.useMemo(() => {
    if (endpoint?.queryParams && endpoint.queryParams.length > 0) return endpoint.queryParams;
    if (item?.queryParams && item.queryParams.length > 0) return item.queryParams;
    return [];
  }, [endpoint?.queryParams, item?.queryParams]);

  const requestBody: Schema = React.useMemo(() => {
    if (endpoint?.requestBody) {
      const epFields =
        endpoint.requestBody.fields && endpoint.requestBody.fields.length > 0
          ? endpoint.requestBody.fields
          : endpoint.params && endpoint.params.length > 0
          ? endpoint.params
          : [];
      return {
        id: endpoint.requestBody.id || endpoint.id || generateId(),
        fields: epFields,
        rawJson: endpoint.requestBody.rawJson ?? endpoint.body ?? "",
      };
    }
    if (endpoint?.body) {
      return { id: endpoint.id || generateId(), rawJson: endpoint.body, fields: [] };
    }
    if (endpoint?.params && endpoint.params.length > 0) {
      return { id: endpoint.id || generateId(), fields: [...endpoint.params], rawJson: "" };
    }
    if (item?.requestBody) {
      return item.requestBody;
    }
    return { id: generateId(), fields: [] };
  }, [
    endpoint?.id,
    endpoint?.requestBody,
    endpoint?.params,
    endpoint?.body,
    item?.requestBody,
  ]);

  const requestBodyMode: RequestBodyMode = React.useMemo(() => {
    if (endpoint?.requestBodyMode) return endpoint.requestBodyMode;
    if (requestBody.rawJson?.trim()) return "raw_json";
    if (item?.requestBodyMode) return item.requestBodyMode;
    return "field_builder";
  }, [endpoint?.requestBodyMode, requestBody.rawJson, item?.requestBodyMode]);

  const handleHeadersChange = (newHeaders: Parameter[]) => {
    updateEventFields({ headers: newHeaders });
    if (endpoint) {
      updateEndpoint(endpoint.id, { headers: newHeaders });
    }
  };

  const handlePathParamsChange = (newPathParams: Parameter[]) => {
    updateEventFields({ pathParams: newPathParams });
    if (endpoint) {
      updateEndpoint(endpoint.id, { pathParams: newPathParams });
    }
  };

  const handleQueryParamsChange = (newQueryParams: Parameter[]) => {
    updateEventFields({ queryParams: newQueryParams });
    if (endpoint) {
      updateEndpoint(endpoint.id, { queryParams: newQueryParams });
    }
  };

  const handleRequestBodyChange = (newRequestBody: Schema) => {
    updateEventFields({ requestBody: newRequestBody });
    if (endpoint) {
      updateEndpoint(endpoint.id, { requestBody: newRequestBody });
    }
  };

  const handleRequestBodyModeChange = (newMode: RequestBodyMode) => {
    updateEventFields({ requestBodyMode: newMode });
    if (endpoint) {
      updateEndpoint(endpoint.id, { requestBodyMode: newMode });
    }
  };

  return (
    <div className="flex flex-col gap-5 font-sans">
      <Accordion
        type="multiple"
        defaultValue={
          isNavigateToPage
            ? ["navigation", "settings"]
            : ["connection", "settings", "request_config"]
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

        {/* ── 2. EVENT PROPERTIES ── */}
        <EventPropertiesSection
          eventName={eventName}
          eventType={eventType}
          customEvent={customEvent}
          eventOptions={EVENT_OPTIONS}
          isNavigateToPage={isNavigateToPage}
          setEventName={setEventName}
          setEventType={setEventType}
          setCustomEvent={setCustomEvent}
          handleUpdateEvent={handleUpdateEvent}
        />

        {/* ── 3. REQUEST CONFIGURATION (MATCHES ENDPOINT CONFIG) ── */}
        {!isNavigateToPage && (
          <RequestConfigSection
            headers={headers}
            pathParams={pathParams}
            queryParams={queryParams}
            requestBody={requestBody}
            requestBodyMode={requestBodyMode}
            connectedEndpoint={endpoint}
            onHeadersChange={handleHeadersChange}
            onPathParamsChange={handlePathParamsChange}
            onQueryParamsChange={handleQueryParamsChange}
            onRequestBodyChange={handleRequestBodyChange}
            onRequestBodyModeChange={handleRequestBodyModeChange}
          />
        )}

        {/* ── 4. TARGET PAGE NAVIGATION ── */}
        {isNavigateToPage && (
          <EventNavigationSection
            eventId={id}
            nodeId={nodeId}
            eventName={eventName}
            eventType={eventType}
            customEvent={customEvent}
            item={item}
            handleUpdateEvent={handleUpdateEvent}
          />
        )}
      </Accordion>
    </div>
  );
};
