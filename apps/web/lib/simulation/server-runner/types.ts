import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphStateChannel,
  LangGraphInputChannel,
  LangGraphMemoryConfig,
  BackendNode,
  TransformerCanvasNode,
  TransformerRefCanvasNode,
  PipelineStepInputBinding,
  PipelineStepInputSource,
} from "@workspace/canvas";
import type {
  SimulationTraceEntry,
  SimulationStepLogEntry,
  SimulationStepLogLevel,
} from "../types";

export type ServerLLMProvider = "groq" | "openai" | "anthropic" | "custom";

export type StepStateValue =
  | string
  | number
  | boolean
  | object
  | null
  | undefined;

export type StepStateRecord = Record<string, StepStateValue>;

export type StepExecutionNode = LangGraphCanvasNode | BackendNode;

export type TransformerCapableNode =
  | TransformerCanvasNode
  | TransformerRefCanvasNode
  | BackendNode;

export interface TransformerExecutionConfig {
  id?: string;
  stepId?: string;
  name?: string;
  label?: string;
  code?: string;
  transformerNodeId?: string;
  transformerRef?: string;
  functionRef?: {
    name?: string;
    importPath?: string;
  };
  customCode?: { body?: string } | string;
  inputBindings?: PipelineStepInputBinding[];
  outputVariable?: string;
  stateUpdates?: Array<{ channelKey: string; value?: string | number | boolean }>;
}

export type StepExecutionInputSource =
  | PipelineStepInputSource
  | { kind: "state"; field?: string; stepId?: string; value?: string | number | boolean };

export interface CheckpointerConnectionConfig {
  host?: string;
  port?: number | string;
  database?: string;
  user?: string;
  username?: string;
  password?: string;
  connectionString?: string;
  connectionStringEnv?: string;
}

export interface ServerExecutionParams {
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  stateChannels: LangGraphStateChannel[];
  inputChannels: LangGraphInputChannel[];
  memoryConfig?: LangGraphMemoryConfig;
  checkpointerConnection?: CheckpointerConnectionConfig;
  inputValues: Record<string, unknown>;
  threadId: string;
  provider?: ServerLLMProvider;
  apiKey?: string;
  modelName?: string;
}

export interface ServerExecutionCheckpoint {
  id: string;
  threadId: string;
  stepName: string;
  state: Record<string, unknown>;
  timestamp: number;
}

export interface ServerLLMStreamBatch {
  index: number;
  delta: string;
  content: string;
  timestamp: string;
  raw?: unknown;
}

export interface ServerLLMResult {
  text: string;
  streamBatches: ServerLLMStreamBatch[];
}

export interface ServerExecutionResult {
  finalState: Record<string, unknown>;
  trace: SimulationTraceEntry[];
  logs?: SimulationStepLogEntry[];
  totalDurationMs: number;
  visitedNodes: string[];
  latestAssistantResponse?: string;
  checkpoints?: ServerExecutionCheckpoint[];
  error?: string;
}

export type NodeLogEmitter = (
  level: SimulationStepLogLevel,
  message: string,
  details?: unknown,
) => void;

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

export interface AppliedStateUpdate {
  channelKey: string;
  previousValue: unknown;
  newValue: unknown;
  reducer: string;
  source: string;
  sourceField?: string;
}
