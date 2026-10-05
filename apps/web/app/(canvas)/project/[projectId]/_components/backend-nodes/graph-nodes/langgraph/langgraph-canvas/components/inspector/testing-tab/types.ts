import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphStateChannel,
  LangGraphInputChannel,
  LangGraphMemoryConfig,
} from "@workspace/canvas";
import type { SimulationStepLogEntry, SimulationStepLogLevel } from "@/lib/simulation/types";
import {
  Activity,
  AlertCircle,
  Sparkles,
  Terminal,
  GitBranch,
  Wrench,
  Shield,
  Layers,
  Settings,
  Zap,
} from "lucide-react";

export interface StartNodeTestingTabProps {
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  stateChannels: LangGraphStateChannel[];
  inputChannels: LangGraphInputChannel[];
  memoryConfig?: LangGraphMemoryConfig;
  graphLabel?: string;
}

export type ExecutionMode = "server" | "browser";
export type LLMProvider = "groq" | "openai" | "anthropic";
export type ActiveSubTab = "trace" | "logs" | "state" | "checkpoints" | "db";
export type TraceViewMode = "output" | "logs" | "batches" | "req" | "raw" | "state" | "config";
export type BatchFormatMode = "event" | "delta" | "raw";

export interface AppliedStateUpdate {
  channelKey: string;
  previousValue: unknown;
  newValue: unknown;
  reducer: string;
  source: string;
  sourceField?: string;
}

export const PROVIDER_MODELS: Record<string, Array<{ id: string; label: string }>> = {
  groq: [
    { id: "openai/gpt-oss-120b", label: "OpenAI GPT-OSS 120B (Groq LPU)" },
    { id: "openai/gpt-oss-20b", label: "OpenAI GPT-OSS 20B (Groq Fast)" },
    { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B (Groq)" },
    { id: "allam-2-7b", label: "Allam 2 7B (Groq)" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "gpt-4o", label: "GPT-4o" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  ],
};

export interface RouterBranchEval {
  id?: string;
  label?: string;
  field?: string;
  operator?: string;
  value?: unknown;
  isDefault?: boolean;
  actualValue?: unknown;
  matched?: boolean;
  targetId?: string;
  targetLabel?: string;
}

export interface RouterDecisionState {
  selectedRoute?: string;
  selectedBranchId?: string;
  condition?: string;
  targetNodeId?: string;
  targetNodeLabel?: string;
  evaluatedBranches?: RouterBranchEval[];
}

export interface StreamBatchItem {
  index: number;
  delta: string;
  content: string;
  timestamp: string;
  formatted?: unknown;
  raw?: unknown;
}

export interface ConnectedTool {
  id: string;
  name: string;
  source?: string;
}

export interface ConnectedMiddleware {
  id: string;
  name: string;
  type?: string;
}

export function getLogLevelStyle(level: SimulationStepLogLevel | string) {
  switch (level) {
    case "step":
      return {
        label: "STEP",
        badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        text: "text-blue-300 font-semibold",
        dot: "bg-blue-400 shadow-blue-400/40",
        icon: Activity,
      };
    case "llm":
      return {
        label: "LLM",
        badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
        text: "text-purple-300",
        dot: "bg-purple-400 shadow-purple-400/40",
        icon: Sparkles,
      };
    case "tool":
      return {
        label: "TOOL",
        badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        text: "text-amber-300",
        dot: "bg-amber-400 shadow-amber-400/40",
        icon: Wrench,
      };
    case "middleware":
      return {
        label: "MIDDLEWARE",
        badge: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
        text: "text-fuchsia-300",
        dot: "bg-fuchsia-400 shadow-fuchsia-400/40",
        icon: Shield,
      };
    case "router":
      return {
        label: "ROUTER",
        badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
        text: "text-sky-300",
        dot: "bg-sky-400 shadow-sky-400/40",
        icon: GitBranch,
      };
    case "config":
      return {
        label: "CONFIG",
        badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        text: "text-indigo-300",
        dot: "bg-indigo-400 shadow-indigo-400/40",
        icon: Settings,
      };
    case "state":
      return {
        label: "STATE",
        badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        text: "text-emerald-300",
        dot: "bg-emerald-400 shadow-emerald-400/40",
        icon: Layers,
      };
    case "warn":
      return {
        label: "WARN",
        badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
        text: "text-yellow-300",
        dot: "bg-yellow-400 shadow-yellow-400/40",
        icon: AlertCircle,
      };
    case "error":
      return {
        label: "ERROR",
        badge: "bg-red-500/15 text-red-400 border-red-500/30",
        text: "text-red-300 font-semibold",
        dot: "bg-red-500 shadow-red-500/40",
        icon: AlertCircle,
      };
    case "info":
    default:
      return {
        label: "INFO",
        badge: "bg-muted text-muted-foreground border-border/50",
        text: "text-foreground",
        dot: "bg-muted-foreground/60",
        icon: Terminal,
      };
  }
}
