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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Badge } from "@workspace/ui/components/badge";
import { Radio, ArrowLeft, ExternalLink, Globe, Sparkles, AlertCircle, Mic, Volume2, Video, Monitor, Tv, Database, CheckCircle2, Zap, Sliders, Info } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { WEBRTC_CAPABILITIES_DEBOUNCE_MS, isRealtimeProtocol, isWebRtcPeerRole } from "@workspace/canvas/constants";
import { sanitizeEventName, computeMediaMode } from "./pipeline-step-editor/PushToClientStepSection";
import { cn } from "@workspace/ui/lib/utils";

function toPascalCase(str: string): string {
  const clean = str.trim();
  if (!clean) return "";
  if (/[\s\-_]/.test(clean)) {
    return clean
      .split(/[\s\-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

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
  const edges = useBackendCanvasStore((s) => s.edges);
  const events = useBackendCanvasStore((s) => s.events);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);

  const pageNode = nodes.find((n) => n.id === nodeId);
  const connections = pageNode?.data?.realtimeConnections ?? [];
  const manualConn = connections.find((c) => c.id === id);

  // Check if derived from a push_to_client step in any service pipeline
  const derivedInfo = useMemo(() => {
    const findInSteps = (steps: PipelineStep[] | undefined): PipelineStep | null => {
      if (!steps) return null;
      for (const step of steps) {
        if (
          step.id === id ||
          (step.type === "push_to_client" &&
            step.clientDeliveryTargetPageId === nodeId &&
            step.id === id)
        ) {
          return step;
        }
        const found =
          findInSteps(step.thenSteps) ||
          findInSteps(step.elseSteps) ||
          findInSteps(step.trySteps) ||
          findInSteps(step.catchSteps) ||
          findInSteps(step.loopBody);
        if (found) return found;
        if (step.switchCases) {
          for (const sc of step.switchCases) {
            const scFound = findInSteps(sc.steps);
            if (scFound) return scFound;
          }
        }
        if (step.switchDefault) {
          const sdFound = findInSteps(step.switchDefault);
          if (sdFound) return sdFound;
        }
        if (step.parallelBranches) {
          for (const pb of step.parallelBranches) {
            const pbFound = findInSteps(pb.steps);
            if (pbFound) return pbFound;
          }
        }
      }
      return null;
    };

    for (const ev of events) {
      if (ev.pipelineSteps && ev.nodeId) {
        const step = findInSteps(ev.pipelineSteps);
        if (step) {
          return {
            step,
            sourceNode: nodes.find((n) => n.id === ev.nodeId),
            sourceEventId: ev.id,
            sourceEndpointId: null,
          };
        }
      }
    }

    for (const ep of endpoints) {
      if (ep.pipelineSteps && ep.nodeId) {
        const step = findInSteps(ep.pipelineSteps);
        if (step) {
          return {
            step,
            sourceNode: nodes.find((n) => n.id === ep.nodeId),
            sourceEventId: null,
            sourceEndpointId: ep.id,
          };
        }
      }
    }

    return null;
  }, [id, nodeId, events, endpoints, nodes]);

  // Combine manual connection or derived connection data
  const conn: RealtimeConnection = useMemo(() => {
    if (derivedInfo?.step) {
      const s = derivedInfo.step;
      const ev = events.find((e) => e.id === derivedInfo.sourceEventId);
      const ep = endpoints.find((e) => e.id === derivedInfo.sourceEndpointId);
      const sourceItemName = ep ? (ep.name || "Endpoint") : ev ? ev.name : undefined;
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

  const isDataChannelEnabled = conn.enableDataChannel !== false;
  const isMicEnabled =
    conn.enableMic !== undefined
      ? Boolean(conn.enableMic)
      : conn.enableAudio !== undefined
      ? Boolean(conn.enableAudio)
      : Boolean(conn.mediaMode === "audio" || conn.mediaMode === "audio-video");
  const isSpeakerEnabled =
    conn.enableSpeaker !== undefined
      ? Boolean(conn.enableSpeaker)
      : Boolean(conn.mediaMode === "audio" || conn.mediaMode === "audio-video");
  const isCameraEnabled =
    conn.enableCamera !== undefined
      ? Boolean(conn.enableCamera)
      : conn.enableVideo !== undefined
      ? Boolean(conn.enableVideo)
      : Boolean(conn.mediaMode === "video" || conn.mediaMode === "audio-video");
  const isScreenShareEnabled = Boolean(conn.enableScreenShare);
  const isRemoteVideoEnabled =
    conn.enableRemoteVideo !== undefined
      ? Boolean(conn.enableRemoteVideo)
      : conn.enableVideo !== undefined
      ? Boolean(conn.enableVideo)
      : Boolean(conn.mediaMode === "video" || conn.mediaMode === "audio-video");

  const [localCaps, setLocalCaps] = React.useState({
    enableDataChannel: isDataChannelEnabled,
    enableMic: isMicEnabled,
    enableSpeaker: isSpeakerEnabled,
    enableCamera: isCameraEnabled,
    enableScreenShare: isScreenShareEnabled,
    enableRemoteVideo: isRemoteVideoEnabled,
  });
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const latestLocalCapsRef = React.useRef(localCaps);
  latestLocalCapsRef.current = localCaps;

  React.useEffect(() => {
    if (!timeoutRef.current) {
      setLocalCaps({
        enableDataChannel: isDataChannelEnabled,
        enableMic: isMicEnabled,
        enableSpeaker: isSpeakerEnabled,
        enableCamera: isCameraEnabled,
        enableScreenShare: isScreenShareEnabled,
        enableRemoteVideo: isRemoteVideoEnabled,
      });
    }
  }, [
    isDataChannelEnabled,
    isMicEnabled,
    isSpeakerEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    isRemoteVideoEnabled,
  ]);

  const commitManualCaps = React.useCallback(
    (values: typeof localCaps) => {
      const computedMediaMode = computeMediaMode(values);

      handleUpdateManual({
        enableDataChannel: values.enableDataChannel,
        enableMic: values.enableMic,
        enableSpeaker: values.enableSpeaker,
        enableCamera: values.enableCamera,
        enableScreenShare: values.enableScreenShare,
        enableRemoteVideo: values.enableRemoteVideo,
        enableAudio: values.enableMic,
        enableVideo: values.enableCamera,
        mediaMode: computedMediaMode,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connections, id, isDerived, nodeId, pageNode],
  );

  const handleToggleCapability = (
    capKey: keyof typeof localCaps,
    checked: boolean,
  ) => {
    setLocalCaps((prev) => {
      const next = { ...prev, [capKey]: checked };
      latestLocalCapsRef.current = next;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        commitManualCaps(next);
      }, WEBRTC_CAPABILITIES_DEBOUNCE_MS);
      return next;
    });
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        commitManualCaps(latestLocalCapsRef.current);
      }
    };
  }, [commitManualCaps]);

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
            onValueChange={(val) => {
              if (!isRealtimeProtocol(val)) return;
              if (val !== "WEBRTC") {
                handleUpdateManual({
                  protocol: val,
                  mediaMode: undefined,
                  enableDataChannel: undefined,
                  enableMic: undefined,
                  enableSpeaker: undefined,
                  enableCamera: undefined,
                  enableScreenShare: undefined,
                  enableRemoteVideo: undefined,
                  iceServerUrl: undefined,
                  peerRole: undefined,
                });
              } else {
                handleUpdateManual({ protocol: val });
              }
            }}
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

        {/* Broadcast / Signaling Room */}
        {(conn.protocol === "WEBSOCKET" || conn.protocol === "WEBRTC") && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">
              {conn.protocol === "WEBRTC" ? "Signaling Room / Peer Channel" : "Broadcast Room / Channel"}
            </Label>
            <Input
              className="text-xs bg-background"
              disabled={isDerived}
              value={conn.room || ""}
              onChange={(e) => handleUpdateManual({ room: e.target.value })}
              placeholder={
                conn.protocol === "WEBRTC"
                  ? "e.g. room:conference or lobby"
                  : "e.g. global or user:${userId}"
              }
            />
          </div>
        )}

        {/* WebRTC Specific Configuration */}
        {conn.protocol === "WEBRTC" && (
          <>
            {/* Granular Media & Data Capabilities */}
            <div className="flex flex-col gap-2">
              <div>
                <Label className="text-xs font-semibold">WebRTC Channels &amp; Media Capabilities</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Select which audio, video, and data channels this peer connection establishes.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
                {/* Data Channel */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`${id}-dc`}
                    checked={localCaps.enableDataChannel}
                    disabled={isDerived}
                    onCheckedChange={(val) => handleToggleCapability("enableDataChannel", Boolean(val))}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <label
                      htmlFor={`${id}-dc`}
                      className="text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                    >
                      <Radio size={13} className="text-violet-500" />
                      <span>Data Channel (JSON &amp; Events)</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Low-latency peer-to-peer data channel for events, state, and structured messaging.
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border/40 my-0.5" />

                {/* Audio: Mic & Speaker */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Audio Streaming
                  </span>

                  {/* Microphone (Send) */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`${id}-mic`}
                      checked={localCaps.enableMic}
                      disabled={isDerived}
                      onCheckedChange={(val) => handleToggleCapability("enableMic", Boolean(val))}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <label
                        htmlFor={`${id}-mic`}
                        className="text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                      >
                        <Mic size={13} className="text-emerald-500" />
                        <span>Microphone (Send Audio)</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        Captures user microphone audio stream via getUserMedia and transmits to peer.
                      </span>
                    </div>
                  </div>

                  {/* Speaker (Receive) */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`${id}-speaker`}
                      checked={localCaps.enableSpeaker}
                      disabled={isDerived}
                      onCheckedChange={(val) => handleToggleCapability("enableSpeaker", Boolean(val))}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <label
                        htmlFor={`${id}-speaker`}
                        className="text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                      >
                        <Volume2 size={13} className="text-teal-500" />
                        <span>Speaker (Receive Audio)</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        Receives and plays back incoming peer audio streams via browser audio output.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border/40 my-0.5" />

                {/* Video: Camera, Screen Share, Remote Video */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Video Streaming
                  </span>

                  {/* Camera (Send) */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`${id}-camera`}
                      checked={localCaps.enableCamera}
                      disabled={isDerived}
                      onCheckedChange={(val) => handleToggleCapability("enableCamera", Boolean(val))}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <label
                        htmlFor={`${id}-camera`}
                        className="text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                      >
                        <Video size={13} className="text-blue-500" />
                        <span>Camera (Send Video)</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        Captures local webcam video via getUserMedia and streams to remote peers.
                      </span>
                    </div>
                  </div>

                  {/* Screen Share (Send) */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`${id}-screen`}
                      checked={localCaps.enableScreenShare}
                      disabled={isDerived}
                      onCheckedChange={(val) => handleToggleCapability("enableScreenShare", Boolean(val))}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <label
                        htmlFor={`${id}-screen`}
                        className="text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                      >
                        <Monitor size={13} className="text-indigo-500" />
                        <span>Screen Share (Send Display)</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        Prompts user for screen / window capture via getDisplayMedia and streams display.
                      </span>
                    </div>
                  </div>

                  {/* Remote Video (Receive) */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`${id}-remote-vid`}
                      checked={localCaps.enableRemoteVideo}
                      disabled={isDerived}
                      onCheckedChange={(val) => handleToggleCapability("enableRemoteVideo", Boolean(val))}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5">
                      <label
                        htmlFor={`${id}-remote-vid`}
                        className="text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                      >
                        <Tv size={13} className="text-purple-500" />
                        <span>Remote Video (Receive Video)</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        Renders incoming video streams from remote peers in video playback frame.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STUN / TURN Server */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">STUN / TURN Server URL (Optional)</Label>
              <Input
                className="text-xs bg-background font-mono"
                disabled={isDerived}
                value={conn.iceServerUrl || ""}
                onChange={(e) => handleUpdateManual({ iceServerUrl: e.target.value })}
                placeholder="stun:stun.l.google.com:19302"
              />
              <span className="text-[10px] text-muted-foreground/70">
                Leave empty to use the default public Google STUN server.
              </span>
            </div>

            {/* Peer Role */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Peer Role</Label>
              <Select
                value={conn.peerRole || "peer"}
                disabled={isDerived}
                onValueChange={(val) => {
                  if (isWebRtcPeerRole(val)) {
                    handleUpdateManual({ peerRole: val });
                  }
                }}
              >
                <SelectTrigger className="text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peer" className="text-xs">
                    Bidirectional Peer (Default)
                  </SelectItem>
                  <SelectItem value="initiator" className="text-xs">
                    Initiator (Creates Offer)
                  </SelectItem>
                  <SelectItem value="responder" className="text-xs">
                    Responder (Waits for Offer &amp; Answers)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
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

        {/* State Store Update & Message Handler */}
        <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-indigo-500" />
              <Label className="text-xs font-semibold text-foreground">
                State Store Update &amp; Message Handler
              </Label>
            </div>
            {conn.storeActionBinding && (
              <Badge
                variant="secondary"
                className="text-[10px] font-mono font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
              >
                {conn.storeActionBinding.storeName}.{conn.storeActionBinding.actionName}()
              </Badge>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground leading-normal">
            Automatically update a reactive State Store whenever a real-time message or event is received over this connection.
          </p>

          {/* Target State Store dropdown */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Database size={10} />
              Target State Store
            </Label>
            <Select
              value={conn.storeActionBinding?.storeNodeId || "none"}
              disabled={isDerived}
              onValueChange={(storeId) => {
                if (storeId === "none" || !storeId) {
                  // Remove existing edge
                  const existingEdges = edges.filter(
                    (e) =>
                      e.source === nodeId &&
                      e.sourceHandle === `rtc-in-${id}` &&
                      nodes.some((sn) => sn.id === e.target && sn.type === "state_store"),
                  );
                  existingEdges.forEach((e) => deleteEdge(e.id));
                  handleUpdateManual({ storeActionBinding: undefined });
                  return;
                }

                const sn = nodes.find((n) => n.id === storeId && n.type === "state_store");
                if (!sn) return;
                const storeName = sn.data?.storeName || sn.data?.label || "App";
                const fields = sn.data?.fields || [];
                const actions = sn.data?.actions || [];

                let defaultActionId = "builtin-populate";
                let defaultActionName = "populate";
                let defaultActionType: any = "populate";
                let defaultTargetFieldId: string | undefined = undefined;
                let defaultTargetFieldName: string | undefined = undefined;
                let targetHandle = "populate-in-left";

                if (fields.length > 0) {
                  const firstF = fields[0]!;
                  defaultActionId = `setter-${firstF.id}`;
                  defaultActionName = `set${toPascalCase(firstF.name)}`;
                  defaultActionType = "set";
                  defaultTargetFieldId = firstF.id;
                  defaultTargetFieldName = firstF.name;
                  targetHandle = "mutate-in-left";
                } else if (actions.length > 0) {
                  const firstA = actions[0]!;
                  defaultActionId = firstA.id;
                  defaultActionName = firstA.name;
                  defaultActionType = firstA.actionType || "custom";
                  targetHandle = `store-action-in-left-${firstA.id}`;
                }

                // Auto-sync canvas edge
                const existingEdges = edges.filter(
                  (e) =>
                    e.source === nodeId &&
                    e.sourceHandle === `rtc-in-${id}` &&
                    nodes.some((sn) => sn.id === e.target && sn.type === "state_store"),
                );
                existingEdges.forEach((e) => deleteEdge(e.id));
                addEdge({
                  id: `edge-rtc-store-${nodeId}-${id}-${storeId}`,
                  source: nodeId,
                  target: storeId,
                  sourceHandle: `rtc-in-${id}`,
                  targetHandle,
                  type: "connection",
                  data: {
                    isStoreActionBinding: true,
                    storeName,
                    actionName: defaultActionName,
                  },
                });

                handleUpdateManual({
                  storeActionBinding: {
                    storeNodeId: storeId,
                    storeName,
                    actionId: defaultActionId,
                    actionName: defaultActionName,
                    actionType: defaultActionType,
                    targetFieldId: defaultTargetFieldId,
                    targetFieldName: defaultTargetFieldName,
                    updateSource: "full_message",
                  },
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select State Store to update..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs text-muted-foreground">
                  None (No Store Mutation)
                </SelectItem>
                {nodes
                  .filter((n) => n.type === "state_store")
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                            s.data?.scope === "global"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-sky-500/15 text-sky-500",
                          )}
                        >
                          {s.data?.scope || "GLOBAL"}
                        </span>
                        <span className="font-semibold text-foreground">
                          {s.data?.storeName || s.data?.label || "Store"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({(s.data?.fields || []).length} fields, {(s.data?.actions || []).length} actions)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action / Mutation Selector */}
          {conn.storeActionBinding?.storeNodeId && (() => {
            const sn = nodes.find((n) => n.id === conn.storeActionBinding?.storeNodeId && n.type === "state_store");
            const fields = sn?.data?.fields || [];
            const actions = sn?.data?.actions || [];
            const currentBinding = conn.storeActionBinding;

            return (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Zap size={10} />
                    Store Mutation / Action to Call
                  </Label>
                  <Select
                    value={currentBinding.actionId || "builtin-populate"}
                    disabled={isDerived}
                    onValueChange={(actionKey) => {
                      if (!sn) return;
                      const storeName = sn.data?.storeName || sn.data?.label || "App";
                      let targetHandle = "mutate-in-left";
                      let updated: NonNullable<RealtimeConnection["storeActionBinding"]>;

                      if (actionKey === "builtin-populate") {
                        targetHandle = "populate-in-left";
                        updated = {
                          ...currentBinding,
                          actionId: "builtin-populate",
                          actionName: "populate",
                          actionType: "populate",
                          targetFieldId: undefined,
                          targetFieldName: undefined,
                        };
                      } else if (actionKey === "builtin-reset") {
                        targetHandle = "reset-in-left";
                        updated = {
                          ...currentBinding,
                          actionId: "builtin-reset",
                          actionName: "reset",
                          actionType: "reset",
                          targetFieldId: undefined,
                          targetFieldName: undefined,
                        };
                      } else if (actionKey.startsWith("setter-")) {
                        targetHandle = "mutate-in-left";
                        const fieldId = actionKey.replace("setter-", "");
                        const matchedField = fields.find((f: any) => f.id === fieldId);
                        const fieldName = matchedField?.name || "field";
                        const setterName = `set${toPascalCase(fieldName)}`;
                        updated = {
                          ...currentBinding,
                          actionId: actionKey,
                          actionName: setterName,
                          actionType: "set",
                          targetFieldId: fieldId,
                          targetFieldName: fieldName,
                        };
                      } else {
                        const matchedAct = actions.find((a: any) => a.id === actionKey);
                        targetHandle = `store-action-in-left-${actionKey}`;
                        updated = {
                          ...currentBinding,
                          actionId: actionKey,
                          actionName: matchedAct?.name || "action",
                          actionType: matchedAct?.actionType || "custom",
                          targetFieldId: matchedAct?.targetFieldId,
                          targetFieldName: undefined,
                        };
                      }

                      // Re-sync canvas edge
                      const existingEdges = edges.filter(
                        (e) =>
                          e.source === nodeId &&
                          e.sourceHandle === `rtc-in-${id}` &&
                          nodes.some((s) => s.id === e.target && s.type === "state_store"),
                      );
                      existingEdges.forEach((e) => deleteEdge(e.id));
                      addEdge({
                        id: `edge-rtc-store-${nodeId}-${id}-${sn.id}`,
                        source: nodeId,
                        target: sn.id,
                        sourceHandle: `rtc-in-${id}`,
                        targetHandle,
                        type: "connection",
                        data: {
                          isStoreActionBinding: true,
                          storeName,
                          actionName: updated.actionName,
                        },
                      });

                      handleUpdateManual({ storeActionBinding: updated });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background font-mono">
                      <SelectValue placeholder="Select mutation or action..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                          Standard Manipulators
                        </SelectLabel>
                        <SelectItem value="builtin-populate" className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-semibold">populate(data)</span>
                            <span className="text-[10px] text-muted-foreground font-sans">
                              - Bulk update store state
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="builtin-reset" className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            <span className="font-semibold">reset()</span>
                            <span className="text-[10px] text-muted-foreground font-sans">
                              - Reset to default state
                            </span>
                          </div>
                        </SelectItem>
                      </SelectGroup>

                      {fields.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                            Field Setters (Mutate State)
                          </SelectLabel>
                          {fields.map((f: any) => {
                            const setterName = `set${toPascalCase(f.name)}`;
                            return (
                              <SelectItem key={`setter-${f.id}`} value={`setter-${f.id}`} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                  <span className="font-semibold font-mono">{setterName}(value)</span>
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                    {f.type}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      )}

                      {actions.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                            Custom Actions
                          </SelectLabel>
                          {actions.map((act: any) => (
                            <SelectItem key={act.id} value={act.id} className="text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                                <span className="font-semibold font-mono">{act.name}()</span>
                                <Badge variant="secondary" className="text-[9px] py-0 px-1 uppercase font-mono">
                                  {act.actionType || "action"}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Input Values & Payload Extraction */}
                {currentBinding.actionType !== "reset" && (
                  <div className="flex flex-col gap-2.5 p-2.5 rounded-lg bg-background/60 border border-border/60">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Sliders size={10} className="text-indigo-500" />
                      Incoming Message Input Mapping
                    </Label>
                    <Select
                      value={currentBinding.updateSource || "full_message"}
                      disabled={isDerived}
                      onValueChange={(val: any) =>
                        handleUpdateManual({
                          storeActionBinding: {
                            ...currentBinding,
                            updateSource: val,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_message" className="text-xs">
                          <span className="font-semibold">Full Message Payload</span>
                          <span className="text-muted-foreground font-mono text-[10px] ml-1.5">(parsed event.data)</span>
                        </SelectItem>
                        <SelectItem value="nested_property" className="text-xs">
                          <span className="font-semibold">Nested Property / Key</span>
                          <span className="text-muted-foreground font-mono text-[10px] ml-1.5">(parsed[property])</span>
                        </SelectItem>
                        <SelectItem value="static" className="text-xs">
                          <span className="font-semibold">Static Constant Value</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {currentBinding.updateSource === "nested_property" && (
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] font-medium">Message Property Path</Label>
                        <Input
                          className="h-7 text-xs bg-background font-mono"
                          disabled={isDerived}
                          placeholder="e.g. data, items, message, user"
                          value={currentBinding.valuePath || ""}
                          onChange={(e) =>
                            handleUpdateManual({
                              storeActionBinding: {
                                ...currentBinding,
                                valuePath: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="text-[10px] text-muted-foreground">
                          Extracts the specified key from the parsed message object to pass into <code className="font-mono">{currentBinding.actionName}()</code>.
                        </span>
                      </div>
                    )}

                    {currentBinding.updateSource === "static" && (
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] font-medium">Static Value</Label>
                        <Input
                          className="h-7 text-xs bg-background font-mono"
                          disabled={isDerived}
                          placeholder="e.g. true, 1, 'received'"
                          value={currentBinding.customValue || ""}
                          onChange={(e) =>
                            handleUpdateManual({
                              storeActionBinding: {
                                ...currentBinding,
                                customValue: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Active Connection Badge Card */}
                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <CheckCircle2 size={11} />
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      Live Stream → Store Bound
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-semibold bg-indigo-500/20 text-indigo-500 border border-indigo-500/30">
                      {currentBinding.storeName}
                    </Badge>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono border-indigo-500/40">
                      <span className="font-bold text-indigo-500">{currentBinding.actionName}()</span>
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

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
