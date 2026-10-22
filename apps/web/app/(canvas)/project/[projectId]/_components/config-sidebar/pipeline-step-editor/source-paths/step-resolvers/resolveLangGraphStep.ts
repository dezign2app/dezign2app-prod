import { BackendNode } from "@workspace/canvas/types";
import { AvailablePath, PipelineStepDraft } from "../../types";

interface ChannelInfo {
  key: string;
  type?: string;
}

export function resolveLangGraphStepPaths(
  step: PipelineStepDraft,
  allNodes: BackendNode[],
  stepPaths: AvailablePath[],
): void {
  const isLangGraphStep =
    step.type === "langgraph_invoke" || Boolean(step.langGraphTargetNodeId);
  if (!isLangGraphStep) return;

  const lgNode =
    allNodes.find((n) => n.id === step.langGraphTargetNodeId && n.type === "langgraph") ||
    allNodes.find((n) => n.type === "langgraph");

  const rawChannels = lgNode?.data?.stateChannels;
  const channels: ChannelInfo[] = [];

  if (Array.isArray(rawChannels)) {
    for (const ch of rawChannels) {
      if (
        ch &&
        typeof ch === "object" &&
        "key" in ch &&
        typeof ch.key === "string" &&
        ch.key.length > 0
      ) {
        const chType =
          "type" in ch && typeof ch.type === "string" ? ch.type : undefined;
        channels.push({ key: ch.key, type: chType });
      }
    }
  }

  // 1. Assistant text response (primary field)
  if (!stepPaths.some((p) => p.path === "response")) {
    stepPaths.push({
      path: "response",
      type: "string",
      description: "Latest assistant message text response",
    });
  }

  // 2. Custom state channels from the LangGraph node
  if (channels.length > 0) {
    channels.forEach((ch) => {
      if (!ch.key) return;
      if (!stepPaths.some((p) => p.path === ch.key)) {
        stepPaths.push({
          path: ch.key,
          type: ch.type || "string",
          description: `State channel: ${ch.key}`,
        });
      }
    });
  } else {
    if (!stepPaths.some((p) => p.path === "messages")) {
      stepPaths.push({
        path: "messages",
        type: "BaseMessage[]",
        description: "Full chat messages history",
      });
    }
  }

  // 3. Memory thread ID
  if (lgNode?.data?.memoryConfig?.enabled !== false) {
    if (!stepPaths.some((p) => p.path === "threadId")) {
      stepPaths.push({
        path: "threadId",
        type: "string",
        description: "Active session thread ID",
      });
    }
  }

  // 4. Full state object
  if (!stepPaths.some((p) => p.path === "state")) {
    stepPaths.push({
      path: "state",
      type: "object",
      description: "Complete final graph state dictionary",
    });
  }

  // Streaming transport metadata
  if (step.langGraphStreamingEnabled) {
    if (!stepPaths.some((p) => p.path === "streamed")) {
      stepPaths.push({
        path: "streamed",
        type: "boolean",
        description: "Indicates real-time token stream was active",
      });
    }
    if (!stepPaths.some((p) => p.path === "protocol")) {
      stepPaths.push({
        path: "protocol",
        type: "string",
        description: `Streaming transport protocol (${step.langGraphStreamingProtocol || "sse"})`,
      });
    }
    if (step.langGraphStreamingProtocol === "websocket" && !stepPaths.some((p) => p.path === "room")) {
      stepPaths.push({
        path: "room",
        type: "string",
        description: "Target WebSocket broadcast room",
      });
    }
    if (step.langGraphStreamingProtocol === "kafka" && !stepPaths.some((p) => p.path === "topic")) {
      stepPaths.push({
        path: "topic",
        type: "string",
        description: "Target Kafka topic for streaming tokens",
      });
    }
    if (step.langGraphStreamingProtocol === "redis_stream" && !stepPaths.some((p) => p.path === "streamKey")) {
      stepPaths.push({
        path: "streamKey",
        type: "string",
        description: "Target Redis stream key for streaming tokens",
      });
    }
  }
}
