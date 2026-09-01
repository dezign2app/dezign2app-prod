"use client";

import React, { useMemo } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode, RealtimeConnection, ClientDeliveryProtocol, PipelineStep } from "@workspace/canvas/types";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Radio, ArrowLeft, ExternalLink, Globe, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { sanitizeEventName } from "./pipeline-step-editor/PushToClientStepSection";
import { cn } from "@workspace/ui/lib/utils";

export interface WebPageRealtimeConnectionConfigProps {
  id: string;
  nodeId: string;
}

const PROTOCOL_OPTIONS: { value: ClientDeliveryProtocol | "POLLING"; label: string; desc: string }[] = [
  {
    value: "SSE",
    label: "Server-Sent Events (SSE)",
    desc: "Unidirectional HTTP event stream from server to browser (EventSource).",
  },
  {
    value: "WEBSOCKET",
    label: "WebSocket",
    desc: "Full-duplex real-time bidirectional messaging channel.",
  },
  {
    value: "WEBRTC",
    label: "WebRTC Data Channel",
    desc: "Low-latency peer-to-peer or server-to-peer data channel.",
  },
  {
    value: "POLLING",
    label: "Long Polling / Polling",
    desc: "Periodic HTTP fetch requests at configured intervals.",
  },
  {
    value: "API_PUSH",
    label: "Outbound Webhook (API Push)",
    desc: "Server emits an outbound webhook HTTP request to a client endpoint.",
  },
];

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
  const connections: RealtimeConnection[] = (pageNode?.data?.realtimeConnections as RealtimeConnection[]) || [];
  const manualConn = connections.find((c) => c.id === id);

  // Check if derived from a push_to_client step in any service pipeline
  const derivedInfo = useMemo(() => {
    let matchedStep: PipelineStep | null = null;
    let matchedSourceNodeId: string | null = null;
    let matchedEventId: string | null = null;
    let matchedEndpointId: string | null = null;

    const searchSteps = (steps: PipelineStep[] | undefined, srcNodeId: string, evId?: string, epId?: string) => {
      if (!steps) return;
      for (const step of steps) {
        if (step.id === id || (step.type === "push_to_client" && step.clientDeliveryTargetPageId === nodeId && step.id === id)) {
          matchedStep = step;
          matchedSourceNodeId = srcNodeId;
          matchedEventId = evId || null;
          matchedEndpointId = epId || null;
          return;
        }
        if (step.thenSteps) searchSteps(step.thenSteps, srcNodeId, evId, epId);
        if (step.elseSteps) searchSteps(step.elseSteps, srcNodeId, evId, epId);
        if (step.trySteps) searchSteps(step.trySteps, srcNodeId, evId, epId);
        if (step.catchSteps) searchSteps(step.catchSteps, srcNodeId, evId, epId);
        if (step.loopBody) searchSteps(step.loopBody, srcNodeId, evId, epId);
        if (step.switchCases) step.switchCases.forEach((c) => searchSteps(c.steps, srcNodeId, evId, epId));
        if (step.switchDefault) searchSteps(step.switchDefault, srcNodeId, evId, epId);
        if (step.parallelBranches) step.parallelBranches.forEach((b) => searchSteps(b.steps, srcNodeId, evId, epId));
      }
    };

    events.forEach((ev) => {
      if (ev.pipelineSteps && ev.nodeId) searchSteps(ev.pipelineSteps as PipelineStep[], ev.nodeId, ev.id);
    });

    endpoints.forEach((ep) => {
      if (ep.pipelineSteps && ep.nodeId) searchSteps(ep.pipelineSteps as PipelineStep[], ep.nodeId, undefined, ep.id);
    });

    if (matchedStep && matchedSourceNodeId) {
      const sourceNode = nodes.find((n) => n.id === matchedSourceNodeId);
      return {
        step: matchedStep,
        sourceNode,
        sourceEventId: matchedEventId,
        sourceEndpointId: matchedEndpointId,
      };
    }
    return null;
  }, [id, nodeId, events, endpoints, nodes]);

  // Combine manual connection or derived connection data
  const conn: RealtimeConnection = useMemo(() => {
    if (manualConn) return manualConn;
    if (derivedInfo?.step) {
      const s = derivedInfo.step as PipelineStep;
      const ev = events.find((e) => e.id === derivedInfo.sourceEventId);
      const ep = endpoints.find((e) => e.id === derivedInfo.sourceEndpointId);
      const sourceItemName = ep ? (ep.name || "Endpoint") : ev ? ev.name : undefined;
      return {
        id,
        protocol: (s.clientDeliveryProtocol as ClientDeliveryProtocol) || "SSE",
        eventName: s.clientDeliveryEventName,
        room: s.clientDeliveryRoom,
        description: sourceItemName || s.name,
        sourceServiceNodeId: derivedInfo.sourceNode?.id,
        sourceServiceLabel: (derivedInfo.sourceNode?.data?.label as string) || derivedInfo.sourceNode?.type || "Service",
        sourceEventId: derivedInfo.sourceEventId || derivedInfo.sourceEndpointId || undefined,
        sourceItemName,
        sourceItemType: ep ? "endpoint" : ev ? "event" : undefined,
      };
    }
    return {
      id,
      protocol: "SSE",
      eventName: "message",
    };
  }, [manualConn, derivedInfo, id, events, endpoints]);

  const isDerived = Boolean(derivedInfo?.step);
  const isConnected = Boolean(isDerived || (conn.sourceServiceNodeId && nodes.some((n) => n.id === conn.sourceServiceNodeId)));

  const handleUpdateManual = (changes: Partial<RealtimeConnection>) => {
    if (isDerived || !pageNode) return; // derived rows configured from source service pipeline
    const existing = connections.map((c) => (c.id === id ? { ...c, ...changes } : c));
    updateNode(nodeId, {
      data: {
        ...pageNode.data,
        label: pageNode.data.label || "",
        realtimeConnections: existing,
      },
    });
  };

  const selectedProtoMeta = PROTOCOL_OPTIONS.find((p) => p.value === conn.protocol) || PROTOCOL_OPTIONS[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "p-2 rounded-xl border",
              isConnected
                ? "bg-violet-500/10 text-violet-500 border-violet-500/20"
                : "bg-destructive/10 text-destructive border-destructive/25",
            )}
          >
            {isConnected ? <Radio size={18} /> : <AlertCircle size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>{conn.sourceItemName || conn.eventName || "Real-Time Connection"}</span>
              <span className="text-[10px] font-mono font-normal px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase">
                {conn.protocol}
              </span>
              {conn.sourceItemType ? (
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase",
                    conn.sourceItemType === "endpoint"
                      ? "bg-blue-500/15 text-blue-500 border border-blue-500/30"
                      : "bg-amber-500/15 text-amber-500 border border-amber-500/30",
                  )}
                >
                  {conn.sourceItemType === "endpoint" ? "API" : "EVENT"}
                </span>
              ) : (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase bg-destructive/15 text-destructive border border-destructive/30">
                  DISCONNECTED
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Listening on WebPage:{" "}
              <span className="font-mono text-foreground font-medium">
                {pageNode?.data?.label || "Page"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Disconnected / Unlinked Warning Banner */}
      {!isConnected && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex flex-col gap-1.5 text-destructive">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertCircle size={15} className="shrink-0" />
            <span>Unlinked / Misconfigured Stream</span>
          </div>
          <p className="text-[11px] text-destructive/90 leading-relaxed">
            No backend service endpoint or event listener is currently pushing to this stream. To deliver real-time data to this page, add a <strong className="text-foreground font-semibold">Push to Client</strong> step inside a Service pipeline targeting this WebPage.
          </p>
        </div>
      )}

      {/* Derived Banner */}
      {isDerived && derivedInfo && (
        <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 font-medium">
              <Sparkles size={14} className="shrink-0" />
              <span>Pipeline Pushed Connection</span>
            </div>
            {derivedInfo.sourceNode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 gap-1 font-semibold"
                onClick={() => {
                  if (derivedInfo.sourceEventId) {
                    setActiveConfigItem({
                      type: "event",
                      id: derivedInfo.sourceEventId,
                      nodeId: derivedInfo.sourceNode!.id,
                    });
                  } else if (derivedInfo.sourceEndpointId) {
                    setActiveConfigItem({
                      type: "endpoint",
                      id: derivedInfo.sourceEndpointId,
                      nodeId: derivedInfo.sourceNode!.id,
                    });
                  }
                }}
              >
                <ExternalLink size={11} /> Edit in Pipeline
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This real-time stream is pushed by a <strong className="text-foreground">Push to Client</strong> pipeline step on{" "}
            <strong className="text-foreground">
              {derivedInfo.sourceNode?.data?.label || derivedInfo.sourceNode?.type || "Service"}
            </strong>.
          </p>
        </div>
      )}

      {/* Protocol Configuration Form */}
      <div className="flex flex-col gap-4">
        {/* Protocol Selector */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Delivery Protocol</Label>
          <Select
            value={conn.protocol}
            disabled={isDerived}
            onValueChange={(val) =>
              handleUpdateManual({ protocol: val as ClientDeliveryProtocol | "POLLING" })
            }
          >
            <SelectTrigger className="text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROTOCOL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            {selectedProtoMeta?.desc}
          </span>
        </div>

        {/* Event Name */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">
            {conn.protocol === "WEBRTC" ? "Data Channel Label" : "Event / Message Name"}
          </Label>
          <Input
            className="text-xs bg-background"
            disabled={isDerived}
            value={conn.eventName || ""}
            onChange={(e) => handleUpdateManual({ eventName: e.target.value })}
            onBlur={(e) => handleUpdateManual({ eventName: sanitizeEventName(e.target.value) })}
            placeholder={
              conn.protocol === "SSE"
                ? "e.g. order.updated"
                : conn.protocol === "WEBSOCKET"
                ? "e.g. chat.message"
                : "e.g. data-channel"
            }
          />
          <span className="text-[10px] text-muted-foreground/70">
            The client-side listener identifier (e.g. <code>eventSource.addEventListener(&quot;{conn.eventName || "event"}&quot;)</code> or WS message type).
          </span>
        </div>

        {/* WebSocket Room */}
        {conn.protocol === "WEBSOCKET" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Broadcast Room / Channel</Label>
            <Input
              className="text-xs bg-background"
              disabled={isDerived}
              value={conn.room || ""}
              onChange={(e) => handleUpdateManual({ room: e.target.value })}
              placeholder="e.g. global or user:${userId}"
            />
          </div>
        )}

        {/* Polling Interval */}
        {conn.protocol === "POLLING" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Polling Interval (ms)</Label>
            <Input
              type="number"
              className="text-xs bg-background"
              disabled={isDerived}
              value={conn.pollingIntervalMs || 5000}
              onChange={(e) =>
                handleUpdateManual({ pollingIntervalMs: parseInt(e.target.value, 10) || 5000 })
              }
              placeholder="5000"
            />
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Description</Label>
          <Textarea
            className="text-xs bg-background min-h-[60px]"
            disabled={isDerived}
            value={conn.description || ""}
            onChange={(e) => handleUpdateManual({ description: e.target.value })}
            placeholder="Explain what real-time data this connection receives and how it updates the UI..."
          />
        </div>
      </div>
    </div>
  );
};
