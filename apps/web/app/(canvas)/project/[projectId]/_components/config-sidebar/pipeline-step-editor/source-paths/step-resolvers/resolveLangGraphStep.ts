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
      if (ch.key === "messages" || ch.type === "messages") {
        if (!stepPaths.some((p) => p.path === "content")) {
          stepPaths.push({
            path: "content",
            type: "string",
            description: "Latest assistant message text",
          });
        }
        if (!stepPaths.some((p) => p.path === "messages[last].content")) {
          stepPaths.push({
            path: "messages[last].content",
            type: "string",
            description: "Latest assistant message content",
          });
        }
      }
    });
  } else {
    if (!stepPaths.some((p) => p.path === "content")) {
      stepPaths.push({
        path: "content",
        type: "string",
        description: "Latest assistant message text",
      });
    }
    if (!stepPaths.some((p) => p.path === "messages")) {
      stepPaths.push({
        path: "messages",
        type: "BaseMessage[]",
        description: "Full chat messages history",
      });
    }
  }

  // Memory thread ID
  if (lgNode?.data?.memoryConfig?.enabled !== false) {
    if (!stepPaths.some((p) => p.path === "threadId")) {
      stepPaths.push({
        path: "threadId",
        type: "string",
        description: "Active session thread ID",
      });
    }
  }

  // Full state object
  if (!stepPaths.some((p) => p.path === "finalState")) {
    stepPaths.push({
      path: "finalState",
      type: "object",
      description: "Complete final graph state dictionary",
    });
  }
}
