import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphStateChannel,
  LangGraphInputChannel,
  LangGraphMemoryConfig,
  LangGraphLLMNodeData,
  LangGraphAgentResponseFormatConfig,
} from "@workspace/canvas";
import type { SimulationTraceEntry, SimulationStepLogEntry } from "../types";
import type { BrowserCheckpoint } from "../indexedDBCheckpointer";

export type LangGraphSimulationProvider = NonNullable<LangGraphLLMNodeData["provider"]>;

export interface BrowserExecutionParams {
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  stateChannels: LangGraphStateChannel[];
  inputChannels: LangGraphInputChannel[];
  memoryConfig?: LangGraphMemoryConfig;
  inputValues: Record<string, unknown>;
  threadId: string;
  provider?: LangGraphSimulationProvider;
  apiKey?: string;
  modelName?: string;
  onStepStart?: (nodeId: string, nodeName: string, state: Record<string, unknown>) => void;
  onStepEnd?: (
    nodeId: string,
    nodeName: string,
    outputDelta: Record<string, unknown>,
    durationMs: number,
  ) => void;
  onCheckpoint?: (checkpoint: BrowserCheckpoint) => void;
}

export interface BrowserLLMStreamBatch {
  index: number;
  delta: string;
  content: string;
  timestamp: string;
  raw?: unknown;
}

export interface BrowserLLMResult {
  text: string;
  streamBatches: BrowserLLMStreamBatch[];
}

export interface BrowserExecutionResult {
  finalState: Record<string, unknown>;
  trace: SimulationTraceEntry[];
  logs?: SimulationStepLogEntry[];
  totalDurationMs: number;
  visitedNodes: string[];
  latestAssistantResponse?: string;
  error?: string;
}

export interface GraphChatMessage {
  role: string;
  content: string;
  name?: string;
  tool_calls?: unknown[];
}

export interface CallBrowserLLMArgs {
  provider: LangGraphSimulationProvider;
  apiKey?: string;
  modelName: string;
  systemPrompt: string;
  messages: GraphChatMessage[];
  customUrl?: string;
  responseFormat?: LangGraphAgentResponseFormatConfig;
  streamEnabled?: boolean;
}

export interface ConnectedToolInfo {
  id: string;
  name: string;
  source?: string;
}

export interface ConnectedMiddlewareInfo {
  id: string;
  name: string;
  type?: string;
}

export interface AppliedStateUpdateRecord {
  channelKey: string;
  previousValue: unknown;
  newValue: unknown;
  reducer: string;
  action?: string;
  source: string;
  sourceField?: string;
}

export type BrowserAddLogFn = (
  level: SimulationStepLogEntry["level"],
  message: string,
  details?: unknown,
) => void;

export interface ExecuteBrowserAgentParams {
  node: LangGraphCanvasNode;
  nodeName: string;
  state: Record<string, unknown> & { messages: GraphChatMessage[] };
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  stateChannels: LangGraphStateChannel[];
  threadId: string;
  provider?: LangGraphSimulationProvider;
  apiKey?: string;
  modelName?: string;
  latestAssistantResponse?: string;
  latestStructuredResponse?: Record<string, unknown>;
  addLog: BrowserAddLogFn;
}

export interface ExecuteBrowserAgentResult {
  outputDelta: Record<string, unknown>;
  latestAssistantResponse?: string;
  latestStructuredResponse?: Record<string, unknown>;
}

export interface ExecuteBrowserStepParams {
  node: LangGraphCanvasNode;
  nodeName: string;
  currentNodeId: string;
  state: Record<string, unknown> & { messages: GraphChatMessage[] };
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  flowEdges: LangGraphCanvasEdge[];
  stateChannels: LangGraphStateChannel[];
  threadId: string;
  provider?: LangGraphSimulationProvider;
  apiKey?: string;
  modelName?: string;
  latestAssistantResponse?: string;
  latestStructuredResponse?: Record<string, unknown>;
  addLog: BrowserAddLogFn;
}

export interface ExecuteBrowserStepResult {
  outputDelta: Record<string, unknown>;
  latestAssistantResponse?: string;
}

