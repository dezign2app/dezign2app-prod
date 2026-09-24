"use client";

import React, { useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { RealtimeConnection } from "@workspace/canvas/types";
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

export type { WebPageRealtimeConnectionConfigProps };

export const WebPageRealtimeConnectionConfig: React.FC<WebPageRealtimeConnectionConfigProps> = ({
  id,
  nodeId,
}) => {
  const nodes = useBackendCanvasStore((s) => s.nodes);
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
      const isRtc = s.clientDeliveryProtocol === "WEBRTC";
      return {
        id,
        protocol: s.clientDeliveryProtocol || "SSE",
        eventName: s.clientDeliveryEventName,
        room: s.clientDeliveryRoom,
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
      };
    }
    if (manualConn) return manualConn;
    return {
      id,
      protocol: "SSE",
      eventName: "message",
    };
  }, [manualConn, derivedInfo, id, events, endpoints]);

  const isDerived = Boolean(derivedInfo?.step);
  const isConnected = Boolean(
    isDerived ||
      (conn.sourceServiceNodeId && nodes.some((n) => n.id === conn.sourceServiceNodeId)),
  );

  const handleUpdateManual = (changes: Partial<RealtimeConnection>) => {
    if (isDerived || !pageNode) return;
    const existing = connections.map((c) => (c.id === id ? { ...c, ...changes } : c));
    updateNode(nodeId, {
      data: {
        ...pageNode.data,
        label: pageNode.data.label || "",
        realtimeConnections: existing,
      },
    });
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
