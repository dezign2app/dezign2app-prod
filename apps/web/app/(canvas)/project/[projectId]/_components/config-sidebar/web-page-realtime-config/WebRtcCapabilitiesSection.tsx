"use client";

import React from "react";
import { RealtimeConnection } from "@workspace/canvas/types";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Radio, Mic, Volume2, Video, Monitor, Tv } from "lucide-react";
import { WEBRTC_CAPABILITIES_DEBOUNCE_MS, isWebRtcPeerRole } from "@workspace/canvas/constants";
import { computeMediaMode } from "../pipeline-step-editor/PushToClientStepSection";

export interface WebRtcCapabilitiesSectionProps {
  id: string;
  conn: RealtimeConnection;
  isDerived: boolean;
  onUpdate: (changes: Partial<RealtimeConnection>) => void;
}

export const WebRtcCapabilitiesSection: React.FC<WebRtcCapabilitiesSectionProps> = ({
  id,
  conn,
  isDerived,
  onUpdate,
}) => {
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
      : conn.enableAudio !== undefined
      ? Boolean(conn.enableAudio)
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

  const commitCaps = React.useCallback(
    (values: typeof localCaps) => {
      const computedMediaMode = computeMediaMode(values);

      onUpdate({
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
    [onUpdate],
  );

  const handleToggleCapability = (
    capKey: keyof typeof localCaps,
    checked: boolean,
  ) => {
    if (isDerived) return;
    setLocalCaps((prev) => {
      const next = { ...prev, [capKey]: checked };
      latestLocalCapsRef.current = next;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        commitCaps(next);
      }, WEBRTC_CAPABILITIES_DEBOUNCE_MS);
      return next;
    });
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        commitCaps(latestLocalCapsRef.current);
      }
    };
  }, [commitCaps]);

  return (
    <div className="flex flex-col gap-4">
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
          onChange={(e) => onUpdate({ iceServerUrl: e.target.value })}
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
              onUpdate({ peerRole: val });
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
    </div>
  );
};
