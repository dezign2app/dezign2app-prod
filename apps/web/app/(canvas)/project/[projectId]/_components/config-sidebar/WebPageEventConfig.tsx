import React, { useState, useEffect } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { BackendNode, UIEventItem, PageSection } from "@/types/canvas";
import { Endpoint, WEB_PAGE_EVENTS } from "@workspace/canvas";
import {
  EventNavigationSection,
  ActionFlowEditor,
} from "./web-page-event-config";
import { ActionStepItem } from "./web-page-event-config/TargetEndpointSection";
import { isStorageRefNode } from "@/lib/stores/backendCanvas/edge/utils";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Radio, Wifi, Video, RefreshCw, Layers, Zap } from "lucide-react";

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
  id: string; // The action/event ID
  nodeId: string;
}

export const WebPageEventConfig = ({ id, nodeId }: WebPageEventConfigProps) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);

  const parentNode = nodes.find((n) => n.id === nodeId);
  const sections: PageSection[] = parentNode?.data?.sections || [];
  const item: UIEventItem | undefined = sections
    .flatMap((s) => s.actions || [])
    .find((e) => e.id === id);
  const parentSection = sections.find((s) =>
    (s.actions || []).some((act) => act.id === id),
  );

  const initialEvent = item?.event || "click";
  const isStandard = EVENT_OPTIONS.some((opt) => opt === initialEvent);

  const [eventName, setEventName] = useState(item?.name || "");
  const [eventType, setEventType] = useState(
    isStandard ? initialEvent : "click",
  );
  const [navType, setNavType] = useState<"link" | "router">(
    item?.navigationType || "link",
  );
  const [navCond, setNavCond] = useState<
    "direct" | "on_success" | "on_condition" | "on_error"
  >(item?.navigationCondition || "direct");
  const [condCode, setCondCode] = useState(item?.conditionCode || "");

  const [sseConfig, setSseConfig] = useState(item?.sseConfig || {});
  const [wsConfig, setWsConfig] = useState(item?.wsConfig || {});
  const [webRtcConfig, setWebRtcConfig] = useState(item?.webRtcConfig || {});
  const [pollingConfig, setPollingConfig] = useState(item?.pollingConfig || {});

  useEffect(() => {
    if (item) {
      setEventName(item.name || "");
      const evt = item.event || "click";
      const isStd = EVENT_OPTIONS.some((opt) => opt === evt);
      setEventType(isStd ? evt : "click");
      setNavType(item.navigationType || "link");
      setNavCond(item.navigationCondition || "direct");
      setCondCode(item.conditionCode || "");
      setSseConfig(item.sseConfig || {});
      setWsConfig(item.wsConfig || {});
      setWebRtcConfig(item.webRtcConfig || {});
      setPollingConfig(item.pollingConfig || {});
    }
  }, [item]);

  const updateActionInParent = (changes: Partial<UIEventItem>) => {
    const currentNodes = useBackendCanvasStore.getState().nodes;
    const latestParent = currentNodes.find((n) => n.id === nodeId) || parentNode;
    if (!latestParent) return;
    const currentSections: PageSection[] = latestParent.data.sections || [];
    const updatedSections = currentSections.map((sec) => ({
      ...sec,
      actions: (sec.actions || []).map((act) =>
        act.id === id ? { ...act, ...changes } : act,
      ),
    }));
    updateNode(nodeId, { data: { ...latestParent.data, sections: updatedSections } });
  };

  const handleUpdateEvent = (
    name: string,
    finalEvent: string,
    extraChanges?: Partial<UIEventItem>,
  ) => {
    if (!parentNode) return;

    updateActionInParent({
      name,
      event: finalEvent,
      navigationType:
        finalEvent === "navigateToPage"
          ? "link"
          : extraChanges?.navigationType ?? navType,
      navigationCondition: extraChanges?.navigationCondition ?? navCond,
      conditionCode: extraChanges?.conditionCode ?? condCode,
      ...extraChanges,
    });

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
          if (remainingEdges.length === 0) store.deleteNode(targetNode.id);
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
        data: { label: "Page Ref", description: "Target page reference" },
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
    updateActionInParent(changes);
  };

  const actionEdges = edges.filter(
    (e) =>
      (e.source === nodeId && e.sourceHandle === `events-${id}`) ||
      (e.target === nodeId && e.targetHandle === `events-${id}`),
  );

  const sortedActionEdges = [...actionEdges].sort((a, b) => {
    const ordA =
      a.data?.sequenceOrder ??
      (a.data?.label ? parseInt(a.data.label, 10) : 99);
    const ordB =
      b.data?.sequenceOrder ??
      (b.data?.label ? parseInt(b.data.label, 10) : 99);
    return ordA - ordB;
  });

  const steps: ActionStepItem[] = sortedActionEdges.map((e, idx) => {
    const isSource = e.source === nodeId;
    const targetNodeId = isSource ? e.target : e.source;
    const handle = isSource ? e.targetHandle : e.sourceHandle;
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    const stepNumber = e.data?.sequenceOrder ?? idx + 1;
    const stepLabel = e.data?.label ?? String(stepNumber);
    const isStorageRef = isStorageRefNode(targetNode?.type);

    if (isStorageRef) {
      const opName =
        handle?.replace(/^func-(?:in-)?/, "") ||
        e.data?.operationName ||
        "uploadObject";
      const bucketName =
        targetNode?.data?.bucketId ||
        targetNode?.data?.bucketName ||
        e.data?.bucketId ||
        "bucket";
      return {
        step: stepNumber,
        label: stepLabel,
        edgeId: e.id,
        targetNodeId,
        targetNode,
        isStorageRef: true,
        operationName: opName,
        bucketName,
        endpoint: {
          id: `storage-op-${opName}`,
          name: `${opName}()`,
          type:
            opName.toLowerCase().includes("presign") ||
            opName.toLowerCase().includes("upload")
              ? "PUT"
              : "STORAGE",
          summary: `Storage bucket operation via ${bucketName}`,
        },
        edge: e,
      };
    }

    let endpointId: string | undefined;
    if (handle) {
      const parts = handle.split("-in-");
      endpointId = parts[parts.length - 1];
    }

    let targetEndpoint: Endpoint | undefined;
    if (endpointId && targetNode) {
      const storeEndpoints = endpoints.filter(
        (ep) => ep.nodeId === targetNodeId && ep.id === endpointId,
      );
      if (storeEndpoints.length > 0) targetEndpoint = storeEndpoints[0];
      if (!targetEndpoint && targetNode.data?.endpoints) {
        targetEndpoint = targetNode.data.endpoints.find(
          (ep: Endpoint) => ep.id === endpointId,
        );
      }
      if (!targetEndpoint && targetNode.data?.routeGroups) {
        for (const group of targetNode.data.routeGroups) {
          targetEndpoint = group.endpoints?.find(
            (ep: Endpoint) => ep.id === endpointId,
          );
          if (targetEndpoint) break;
        }
      }
    }

    if (!targetEndpoint && targetNode) {
      const allTargetEndpoints = collectEndpoints(targetNode, endpoints);
      if (allTargetEndpoints.length > 0) targetEndpoint = allTargetEndpoints[0];
    }

    return {
      step: stepNumber,
      label: stepLabel,
      edgeId: e.id,
      targetNodeId,
      targetNode,
      endpointId,
      endpoint: targetEndpoint,
      edge: e,
    };
  });

  const serviceNodes = nodes.filter(
    (n) => n.id !== nodeId && SERVER_NODE_TYPES.includes(n.type),
  );

  const handleDeleteStep = (edgeId: string) => {
    deleteEdge(edgeId);
  };

  if (!item) return <div className="p-4 text-xs text-muted-foreground">Action not found.</div>;

  const isNavigateToPage = eventType === "navigateToPage";
  const isSse = eventType === "sse";
  const isWebsocket = eventType === "websocket";
  const isWebrtc = eventType === "webrtc";
  const isPolling = eventType === "polling";

  return (
    <div className="flex flex-col gap-5 font-sans">
      {/* Merged Action Header: Event Type & Action Name */}
      <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-b from-card to-card/60 shadow-xs flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary border border-primary/20">
              <Zap size={13} className="fill-primary/20" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Action Event</span>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 uppercase">
                {eventType}
              </Badge>
            </div>
          </div>
          {parentSection?.name ? (
            <Badge variant="secondary" className="text-[10px] font-normal text-muted-foreground px-2 py-0.5">
              {parentSection.name}
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Trigger Event
            </Label>
            <Select
              value={eventType}
              onValueChange={(v) => {
                setEventType(v);
                handleUpdateEvent(eventName, v);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background font-mono focus:ring-1 focus:ring-ring focus:ring-offset-0">
                <SelectValue placeholder="Select trigger event" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs font-mono">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Action Name
            </Label>
            <Input
              className="h-8 text-xs bg-background font-mono"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              onBlur={() => handleUpdateEvent(eventName, eventType)}
              placeholder="e.g. submitOrder, fetchUserProfile"
            />
          </div>
        </div>
      </div>

      <Accordion
        type="multiple"
        defaultValue={
          isNavigateToPage
            ? ["navigation"]
            : ["connection", "sse_config", "ws_config", "webrtc_config", "polling_config"]
        }
        className="w-full flex flex-col gap-3 border-none"
      >
        {!isNavigateToPage && (
          <AccordionItem
            value="connection"
            className="border rounded-xl overflow-hidden bg-card"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-primary" />
                <span className="text-xs font-semibold">
                  Pipeline Steps
                </span>
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1.5 py-0 font-mono"
                >
                  {(item?.actionSteps?.length || steps.length)} {((item?.actionSteps?.length || steps.length) === 1 ? "step" : "steps")}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-5 pt-2">
              <ActionFlowEditor
                item={item}
                canvasSteps={steps}
                serviceNodes={serviceNodes}
                allNodes={nodes}
                endpoints={endpoints}
                webPageNodeId={nodeId}
                actionId={id}
                onSave={(drafts) =>
                  updateActionInParent({ actionSteps: drafts })
                }
                onDeleteStep={handleDeleteStep}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {isSse && (
          <AccordionItem value="sse_config" className="border border-amber-500/30 rounded-lg bg-amber-500/5 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold hover:no-underline flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-2"><Radio size={14} /> SSE Setup</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Reconnect Strategy</Label>
                <Select value={sseConfig.reconnectStrategy || "exponential"} onValueChange={(val: "exponential" | "linear" | "none") => { const next = { ...sseConfig, reconnectStrategy: val }; setSseConfig(next); updateEventFields({ sseConfig: next }); }}>
                  <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="exponential">Exponential</SelectItem><SelectItem value="linear">Linear</SelectItem><SelectItem value="none">None</SelectItem></SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {isWebsocket && (
          <AccordionItem value="ws_config" className="border border-cyan-500/30 rounded-lg bg-cyan-500/5 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold hover:no-underline flex items-center justify-between text-cyan-600 dark:text-cyan-400">
              <span className="flex items-center gap-2"><Wifi size={14} /> WebSocket Setup</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
              <div className="space-y-1"><Label className="text-xs">Heartbeat Interval (ms)</Label><Input type="number" value={wsConfig.heartbeatInterval ?? 30000} onChange={(e) => { const next = { ...wsConfig, heartbeatInterval: parseInt(e.target.value, 10) }; setWsConfig(next); updateEventFields({ wsConfig: next }); }} className="h-8 text-xs bg-background" /></div>
            </AccordionContent>
          </AccordionItem>
        )}

        {isWebrtc && (
          <AccordionItem value="webrtc_config" className="border border-purple-500/30 rounded-lg bg-purple-500/5 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold hover:no-underline flex items-center justify-between text-purple-600 dark:text-purple-400">
              <span className="flex items-center gap-2"><Video size={14} /> WebRTC Setup</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
              <div className="space-y-1"><Label className="text-xs">Signaling Server URL</Label><Input value={webRtcConfig.signalingServer || ""} onChange={(e) => { const next = { ...webRtcConfig, signalingServer: e.target.value }; setWebRtcConfig(next); updateEventFields({ webRtcConfig: next }); }} className="h-8 text-xs bg-background" /></div>
            </AccordionContent>
          </AccordionItem>
        )}

        {isPolling && (
          <AccordionItem value="polling_config" className="border border-blue-500/30 rounded-lg bg-blue-500/5 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-xs font-semibold hover:no-underline flex items-center justify-between text-blue-600 dark:text-blue-400">
              <span className="flex items-center gap-2"><RefreshCw size={14} /> Polling Setup</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
              <div className="space-y-1"><Label className="text-xs">Interval (ms)</Label><Input type="number" value={pollingConfig.intervalMs ?? 5000} onChange={(e) => { const next = { ...pollingConfig, intervalMs: parseInt(e.target.value, 10) }; setPollingConfig(next); updateEventFields({ pollingConfig: next }); }} className="h-8 text-xs bg-background" /></div>
            </AccordionContent>
          </AccordionItem>
        )}

        {isNavigateToPage && (
          <EventNavigationSection
            eventId={id}
            nodeId={nodeId}
            eventName={eventName}
            eventType={eventType}
            item={item}
            handleUpdateEvent={handleUpdateEvent}
          />
        )}
      </Accordion>
    </div>
  );
};
