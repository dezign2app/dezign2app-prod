"use client";

import React, { useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { RealtimeConnection, Endpoint, UIEventItem } from "@workspace/canvas/types";
import { extractPathsFromObject } from "./pipeline-step-editor/sourcePaths";
import { AvailablePath } from "./pipeline-step-editor/types";
import { parseSchemaJson } from "@/lib/compiler/utils";
import {
  WebPageRealtimeConnectionConfigProps,
  useDerivedRealtimeInfo,
  RealtimeConnectionHeader,
  RealtimeProtocolSection,
  WebRtcCapabilitiesSection,
  RealtimeStateStoreSection,
} from "./web-page-realtime-config";
import { ensureWsPackageInService } from "@/lib/stores/backendCanvas/packageTypesSync";
import { ActionFlowEditor, ActionSimulator } from "./web-page-event-config";
import { useWebPageConnectedContext } from "./web-page-config/hooks/useWebPageConnectedContext";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@workspace/ui/components/accordion";
import { Badge } from "@workspace/ui/components/badge";
import { Layers, Play } from "lucide-react";
import { isStorageRefNode } from "@/lib/stores/backendCanvas/edge/utils";
import type { ActionStepItem } from "./web-page-event-config/TargetEndpointSection";
import type { FrontendActionStepDraft } from "./web-page-event-config/action-flow/types";

export type { WebPageRealtimeConnectionConfigProps };

export const WebPageRealtimeConnectionConfig: React.FC<WebPageRealtimeConnectionConfigProps> = ({
  id,
  nodeId,
}) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const events = useBackendCanvasStore((s) => s.events);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const pageNode = nodes.find((n) => n.id === nodeId);
  const connections = pageNode?.data?.realtimeConnections ?? [];
  const manualConn = connections.find((c) => c.id === id);

  const derivedInfo = useDerivedRealtimeInfo(id, nodeId, events, endpoints, nodes);

  const conn: RealtimeConnection = useMemo(() => {
    if (derivedInfo?.step) {
      const s = derivedInfo.step;
      const ev = events.find((e) => e.id === derivedInfo.sourceEventId);
      const ep = endpoints.find((e) => e.id === derivedInfo.sourceEndpointId);
      const sourceItemName = ep ? ep.name || "Endpoint" : ev ? ev.name : undefined;
      const isLangGraph = s.type === "langgraph_invoke";
      const isRtc = !isLangGraph && s.clientDeliveryProtocol === "WEBRTC";
      const protocol: RealtimeConnection["protocol"] = isLangGraph
        ? (s.langGraphStreamingProtocol === "websocket" || s.clientDeliveryProtocol === "WEBSOCKET"
          ? "WEBSOCKET"
          : "SSE")
        : (s.clientDeliveryProtocol || "SSE");
      const eventName =
        s.clientDeliveryEventName ||
        (isLangGraph
          ? (protocol === "WEBSOCKET" ? "agent_stream" : (sourceItemName || s.name || "message"))
          : (sourceItemName || "message"));
      const room = s.clientDeliveryRoom || (isLangGraph ? s.langGraphStreamingRoom : undefined);

      return {
        id,
        protocol,
        eventName,
        room,
        mediaMode: isRtc ? s.clientDeliveryMediaMode : undefined,
        enableDataChannel: isRtc ? s.clientDeliveryEnableDataChannel : undefined,
        enableMic: isRtc ? (s.clientDeliveryEnableMic ?? s.clientDeliveryEnableAudio) : undefined,
        enableSpeaker: isRtc ? s.clientDeliveryEnableSpeaker : undefined,
        enableCamera: isRtc ? (s.clientDeliveryEnableCamera ?? s.clientDeliveryEnableVideo) : undefined,
        enableScreenShare: isRtc ? s.clientDeliveryEnableScreenShare : undefined,
        enableRemoteVideo: isRtc ? s.clientDeliveryEnableRemoteVideo : undefined,
        iceServerUrl: isRtc ? s.clientDeliveryIceServer : undefined,
        description: sourceItemName || s.name,
        sourceServiceNodeId: derivedInfo.sourceNode?.id,
        sourceServiceLabel: derivedInfo.sourceNode?.data?.label || derivedInfo.sourceNode?.type || "Service",
        sourceEventId: derivedInfo.sourceEventId || derivedInfo.sourceEndpointId || undefined,
        sourceItemName,
        sourceItemType: ep ? "endpoint" : ev ? "event" : undefined,
        storeActionBinding: manualConn?.storeActionBinding,
        storeActionBindings: manualConn?.storeActionBindings,
        actionSteps: manualConn?.actionSteps ?? [],
      };
    }
    if (manualConn) return { ...manualConn, actionSteps: manualConn.actionSteps ?? [] };
    return {
      id,
      protocol: "SSE",
      eventName: "message",
      actionSteps: [],
    };
  }, [manualConn, derivedInfo, id, events, endpoints]);

  const isDerived = Boolean(derivedInfo?.step);
  const isConnected = Boolean(
    isDerived ||
      (conn.sourceServiceNodeId && nodes.some((n) => n.id === conn.sourceServiceNodeId)),
  );

  const handleUpdateManual = (changes: Partial<RealtimeConnection>) => {
    if (!pageNode) return;
    // Protocol / capabilities cannot be edited manually for derived connections, but bindings and action steps CAN
    if (
      isDerived &&
      !changes.storeActionBinding &&
      changes.storeActionBinding !== null &&
      !changes.storeActionBindings &&
      !changes.actionSteps
    ) {
      return;
    }
    const isAlreadyInExisting = connections.some((c) => c.id === id);
    const updatedList = isAlreadyInExisting
      ? connections.map((c) => (c.id === id ? { ...c, ...changes } : c))
      : [...connections, { ...conn, ...changes }];

    updateNode(nodeId, {
      data: {
        ...pageNode.data,
        label: pageNode.data.label || "",
        realtimeConnections: updatedList,
      },
    });
    if (changes.protocol === "WEBSOCKET" && conn.sourceServiceNodeId) {
      ensureWsPackageInService({ serviceNodeId: conn.sourceServiceNodeId });
    }
  };

  const stateStoreNodes = useMemo(() => {
    return nodes.filter((n) => n.type === "state_store");
  }, [nodes]);

  const suggestedPaths = useMemo((): AvailablePath[] => {
    const paths: AvailablePath[] = [];

    if (derivedInfo?.sourceEndpointId) {
      const ep = endpoints.find((e) => e.id === derivedInfo.sourceEndpointId);
      if (ep?.responseBody) {
        if (Array.isArray(ep.responseBody.fields)) {
          ep.responseBody.fields.forEach((f) => {
            if (f.name) {
              paths.push({ path: f.name, type: f.type, description: f.description });
            }
          });
        }
        if (ep.responseBody.rawJson) {
          const parsed = parseSchemaJson(ep.responseBody.rawJson);
          if (parsed && typeof parsed === "object") {
            const jsonPaths = extractPathsFromObject(parsed);
            jsonPaths.forEach((jp) => {
              if (!paths.some((p) => p.path === jp.path)) {
                paths.push(jp);
              }
            });
          }
        }
      }
    }

    if (derivedInfo?.sourceEventId) {
      const ev = events.find((e) => e.id === derivedInfo.sourceEventId);
      if (ev?.payloadSchema) {
        if (Array.isArray(ev.payloadSchema.fields)) {
          ev.payloadSchema.fields.forEach((f) => {
            if (f.name) {
              paths.push({ path: f.name, type: f.type, description: f.description });
            }
          });
        }
        if (ev.payloadSchema.rawJson) {
          const parsed = parseSchemaJson(ev.payloadSchema.rawJson);
          if (parsed && typeof parsed === "object") {
            const jsonPaths = extractPathsFromObject(parsed);
            jsonPaths.forEach((jp) => {
              if (!paths.some((p) => p.path === jp.path)) {
                paths.push(jp);
              }
            });
          }
        }
      }
    }

    if (paths.length === 0) {
      paths.push(
        { path: "data", type: "object", description: "Parsed event data payload" },
        { path: "message", type: "string", description: "Message body or text" },
        { path: "type", type: "string", description: "Event type or name" },
        { path: "payload", type: "object", description: "Nested message payload" },
      );
    }

    return paths;
  }, [derivedInfo?.sourceEndpointId, derivedInfo?.sourceEventId, endpoints, events]);

  const { isProtected } = useWebPageConnectedContext({
    nodeId,
    data: pageNode?.data,
    allNodes: nodes,
    allEdges: edges,
    allEndpoints: endpoints,
  });

  const serviceNodes = useMemo(() => {
    return nodes.filter(
      (n) =>
        n.type === "service" ||
        n.type === "serverless" ||
        n.type === "worker" ||
        Boolean(n.data?.endpoints),
    );
  }, [nodes]);

  const actionEdges = edges.filter(
    (e) =>
      (e.source === nodeId && (e.sourceHandle === `rtc-out-${id}` || e.sourceHandle === `rtc-in-${id}`)) ||
      (e.target === nodeId && (e.targetHandle === `rtc-in-${id}` || e.targetHandle === `rtc-out-${id}`)),
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

  const canvasSteps: ActionStepItem[] = sortedActionEdges.map((e, idx) => {
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

  const handleDeleteStep = (edgeId: string) => {
    useBackendCanvasStore.getState().deleteEdge(edgeId);
  };

  return (
    <div className="flex flex-col gap-6">
      <RealtimeConnectionHeader
        conn={conn}
        pageLabel={pageNode?.data?.label || "Page"}
        isConnected={isConnected}
        isDerived={isDerived}
        derivedInfo={derivedInfo}
        onEditInPipeline={() => {
          if (derivedInfo?.sourceEventId && derivedInfo.sourceNode) {
            setActiveConfigItem({
              type: "event",
              id: derivedInfo.sourceEventId,
              nodeId: derivedInfo.sourceNode.id,
            });
          } else if (derivedInfo?.sourceEndpointId && derivedInfo.sourceNode) {
            setActiveConfigItem({
              type: "endpoint",
              id: derivedInfo.sourceEndpointId,
              nodeId: derivedInfo.sourceNode.id,
            });
          }
        }}
      />

      <div className="flex flex-col gap-4">
        {/* Pipeline Action Steps Accordion (Frontend Action Steps) */}
        <Accordion
          type="multiple"
          defaultValue={["steps", "simulator"]}
          className="w-full flex flex-col gap-3 border-none"
        >
          <AccordionItem
            value="steps"
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
                  {(conn?.actionSteps?.length || canvasSteps.length)} {((conn?.actionSteps?.length || canvasSteps.length) === 1 ? "step" : "steps")}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-5 pt-2">
              <ActionFlowEditor
                item={{
                  id: conn.id,
                  name: conn.eventName || "message",
                  event: conn.protocol || "SSE",
                  actionSteps: conn.actionSteps,
                }}
                canvasSteps={canvasSteps}
                serviceNodes={serviceNodes}
                allNodes={nodes}
                endpoints={endpoints}
                webPageNodeId={nodeId}
                actionId={id}
                isProtected={isProtected}
                onSave={(drafts: FrontendActionStepDraft[]) =>
                  handleUpdateManual({ actionSteps: drafts })
                }
                onDeleteStep={handleDeleteStep}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="simulator"
            className="border border-cyan-500/30 rounded-xl overflow-hidden bg-card"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
              <div className="flex items-center gap-2">
                <Play size={14} className="text-cyan-500 fill-cyan-500/20" />
                <span className="text-xs font-semibold">
                  Simulate &amp; Test Action
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 font-mono text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                >
                  Interactive
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-5 pt-2">
              <ActionSimulator
                item={{
                  id: conn.id,
                  name: conn.eventName || "message",
                  event: conn.protocol || "SSE",
                  actionSteps: conn.actionSteps,
                }}
                steps={conn.actionSteps && conn.actionSteps.length > 0 ? conn.actionSteps : []}
                canvasSteps={canvasSteps}
                allNodes={nodes}
                endpoints={endpoints}
                webPageNodeId={nodeId}
                actionId={id}
                isProtected={isProtected}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <RealtimeProtocolSection
          conn={conn}
          isDerived={isDerived}
          onUpdate={handleUpdateManual}
        />

        {conn.protocol === "WEBRTC" && (
          <WebRtcCapabilitiesSection
            id={id}
            conn={conn}
            isDerived={isDerived}
            onUpdate={handleUpdateManual}
          />
        )}

        <RealtimeStateStoreSection
          id={id}
          nodeId={nodeId}
          storeBinding={conn.storeActionBinding}
          isDerived={isDerived}
          stateStoreNodes={stateStoreNodes}
          suggestedPaths={suggestedPaths}
          onUpdateStoreBinding={(binding) =>
            handleUpdateManual({ storeActionBinding: binding })
          }
        />
      </div>
    </div>
  );
};
