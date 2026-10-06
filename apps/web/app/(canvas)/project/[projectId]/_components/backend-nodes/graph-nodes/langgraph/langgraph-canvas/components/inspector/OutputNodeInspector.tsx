import React from "react";
import {
  Radio,
  Trash,
  Zap,
  Plug,
  Globe,
  Sparkles,
  Layers,
  Info,
  Cpu,
  Link2,
  CheckCircle2,
} from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type {
  OutputNodeData,
  LangGraphLLMNode,
  LangGraphLLMRefNode,
  LangGraphCanvasNode,
} from "@workspace/canvas";
import type { LangGraphStateChannel } from "@/types/canvas";
import type { ConnectedRouteInfo } from "../../../LangGraphNode";
import { LocalInput } from "../../../../common";

interface OutputNodeInspectorProps {
  selectedOutputData: OutputNodeData;
  onDeleteOutput: () => void;
  onUpdateOutput: (changes: Partial<OutputNodeData>) => void;
  stateChannels?: LangGraphStateChannel[];
  availableLLMNodes?: (LangGraphLLMNode | LangGraphLLMRefNode)[];
  connectedRoutes?: ConnectedRouteInfo[];
  nodes?: LangGraphCanvasNode[];
}

function isOutputTransportType(val: string): val is OutputNodeData["type"] {
  return (
    val === "sse" ||
    val === "websocket" ||
    val === "event" ||
    val === "webhook" ||
    val === "rest"
  );
}

function isStreamContentMode(
  val: string,
): val is
  | "ai_node_tokens"
  | "structured_output"
  | "step_output"
  | "full_state" {
  return (
    val === "ai_node_tokens" ||
    val === "structured_output" ||
    val === "step_output" ||
    val === "full_state"
  );
}

function getCanvasNodeLabel(node: LangGraphCanvasNode): string {
  const data = node.data;
  if (data && typeof data === "object") {
    if ("name" in data && typeof data.name === "string" && data.name.trim().length > 0) {
      return data.name;
    }
    if ("label" in data && typeof data.label === "string" && data.label.trim().length > 0) {
      return data.label;
    }
  }
  return node.id;
}

interface StepStreamInfo {
  hasStreamConfig: boolean;
  preset?: string;
  selectedEventsCount?: number;
}

function getStepStreamInfo(node?: LangGraphCanvasNode): StepStreamInfo {
  if (!node || typeof node.data !== "object" || node.data === null) {
    return { hasStreamConfig: false };
  }
  const data = node.data;
  if ("streamConfig" in data && data.streamConfig && typeof data.streamConfig === "object") {
    const sc = data.streamConfig;
    const isEnabled = !("enabled" in sc) || sc.enabled !== false;
    if (isEnabled) {
      const preset = "preset" in sc && typeof sc.preset === "string" ? sc.preset : "standard_sse";
      const presetLabels: Record<string, string> = {
        standard_sse: "Standard SSE",
        ai_sdk: "Vercel AI SDK",
        openai_chunk: "OpenAI Chunk",
        minimal: "Minimal",
        custom: "Custom",
      };
      let eventCount: number | undefined;
      if ("selectedEvents" in sc && Array.isArray(sc.selectedEvents)) {
        eventCount = sc.selectedEvents.length;
      }
      return {
        hasStreamConfig: true,
        preset: presetLabels[preset] || preset,
        selectedEventsCount: eventCount,
      };
    }
  }
  return { hasStreamConfig: false };
}

export function OutputNodeInspector({
  selectedOutputData,
  onDeleteOutput,
  onUpdateOutput,
  stateChannels = [],
  availableLLMNodes = [],
  connectedRoutes = [],
  nodes = [],
}: OutputNodeInspectorProps) {
  const channelType = selectedOutputData.type || "sse";
  const contentMode = selectedOutputData.streamContentMode || "ai_node_tokens";
  const boundRouteIds = selectedOutputData.boundRouteIds || [];

  const stepNodes = (nodes || []).filter(
    (n) =>
      n.type === "step" ||
      n.type === "langgraph_node" ||
      n.type === "langgraph_agent",
  );

  const connectedStep = (nodes || []).find(
    (n) => n.id === selectedOutputData.sourceStepId,
  );

  const activeStep =
    (nodes || []).find((n) => n.id === selectedOutputData.sourceStepId) ||
    connectedStep ||
    stepNodes[0];

  const activeStepStreamInfo = getStepStreamInfo(activeStep);

  const toggleRouteBinding = (edgeId: string) => {
    if (boundRouteIds.includes(edgeId)) {
      onUpdateOutput({
        boundRouteIds: boundRouteIds.filter((id) => id !== edgeId),
      });
    } else {
      onUpdateOutput({ boundRouteIds: [...boundRouteIds, edgeId] });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md border border-primary/30 bg-primary/10 text-primary">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-mono truncate max-w-[170px]">
                {selectedOutputData.name ||
                  selectedOutputData.label ||
                  "Output Channel"}
              </h2>
              <p className="text-[10px] font-mono text-muted-foreground opacity-70">
                {selectedOutputData.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            onClick={onDeleteOutput}
            title="Delete Output Node"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Settings */}
      <div className="flex flex-col gap-4 p-3 bg-secondary/10 rounded-xl border border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Stream Output Configuration
          </h3>
        </div>

        {/* Channel Name */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">Stream Label</Label>
          <LocalInput
            value={selectedOutputData.name || selectedOutputData.label || ""}
            onChange={(e) =>
              onUpdateOutput({ name: e.target.value, label: e.target.value })
            }
            placeholder="e.g. Response Stream"
            className="bg-background text-xs h-8"
          />
        </div>

        {/* Source Execution Node */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <span>Source Execution Node</span>
            </Label>
            {connectedStep && (
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> Canvas Edge Connected
              </span>
            )}
          </div>

          {stepNodes.length > 0 ? (
            <Select
              value={selectedOutputData.sourceStepId || "__first__"}
              onValueChange={(val) =>
                onUpdateOutput({
                  sourceStepId: val === "__first__" ? undefined : val,
                })
              }
            >
              <SelectTrigger className="bg-background text-xs h-8 font-mono">
                <SelectValue placeholder="First Step Node (Default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__first__" className="text-xs font-mono">
                  Default / First Step Node
                </SelectItem>
                {stepNodes.map((s) => (
                  <SelectItem
                    key={s.id}
                    value={s.id}
                    className="text-xs font-mono"
                  >
                    {getCanvasNodeLabel(s)}
                    {connectedStep && connectedStep.id === s.id
                      ? " (Wired via Edge)"
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded border border-border/40">
              Connect an arrow from your agent step to this Output Channel.
            </span>
          )}

          {/* Active Event Projections Badge from the selected node */}
          {activeStep && activeStepStreamInfo.hasStreamConfig && (
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-primary/10 border border-primary/20 mt-1">
              <div className="flex items-center gap-1.5 text-primary text-[11px] font-medium">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Using Event Projections from {getCanvasNodeLabel(activeStep)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground leading-relaxed">
                Inheriting {activeStepStreamInfo.preset} with{" "}
                {activeStepStreamInfo.selectedEventsCount !== undefined
                  ? `${activeStepStreamInfo.selectedEventsCount} active`
                  : "all"}{" "}
                projections and payload envelope configured directly on{" "}
                {getCanvasNodeLabel(activeStep)}.
              </span>
            </div>
          )}
        </div>

        {/* Stream Yield Explanation Banner */}
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <span>Yield Stream to Endpoint</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The graph yields chunks directly back to the invoking API route in <span className="text-foreground font-mono font-medium">PipelineStepEditor</span>, where you configure the delivery destination (Direct SSE, WebSocket, Kafka Topic, or Redis Stream).
          </p>
        </div>

        {/* Description / Notes */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold">
            Stream Notes / Description
          </Label>
          <LocalInput
            value={selectedOutputData.description || ""}
            onChange={(e) => onUpdateOutput({ description: e.target.value })}
            placeholder="e.g. Yields AI assistant tokens to caller"
            className="bg-background text-xs h-8"
          />
        </div>
      </div>

        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded-lg border border-border/40 mt-1">
          <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            Yields event stream chunks directly to the invoking API endpoint in PipelineStepEditor.
          </span>
        </div>
      </div>
  );
}
