"use client";

import React from "react";
import { RealtimeConnection } from "@workspace/canvas/types";
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
import { isRealtimeProtocol } from "@workspace/canvas/constants";
import { sanitizeEventName } from "../pipeline-step-editor/PushToClientStepSection";
import { PROTOCOL_OPTIONS } from "./types";

export interface RealtimeProtocolSectionProps {
  conn: RealtimeConnection;
  isDerived: boolean;
  onUpdate: (changes: Partial<RealtimeConnection>) => void;
}

export const RealtimeProtocolSection: React.FC<RealtimeProtocolSectionProps> = ({
  conn,
  isDerived,
  onUpdate,
}) => {
  const selectedProtoMeta =
    PROTOCOL_OPTIONS.find((p) => p.value === conn.protocol) || PROTOCOL_OPTIONS[0];

  return (
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
              onUpdate({
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
              onUpdate({ protocol: val });
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
          onChange={(e) => onUpdate({ eventName: e.target.value })}
          onBlur={(e) => onUpdate({ eventName: sanitizeEventName(e.target.value) })}
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
            onChange={(e) => onUpdate({ room: e.target.value })}
            placeholder={
              conn.protocol === "WEBRTC"
                ? "e.g. room:conference or lobby"
                : "e.g. global or user:${userId}"
            }
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
              onUpdate({ pollingIntervalMs: parseInt(e.target.value, 10) || 5000 })
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
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Explain what real-time data this connection receives and how it updates the UI..."
        />
      </div>
    </div>
  );
};
