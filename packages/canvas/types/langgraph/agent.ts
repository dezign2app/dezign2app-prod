import type {
  LangGraphInputChannel,
  LangGraphStateChannel,
  LangGraphOutputPort,
  OutputChannelConfig,
  LangGraphCustomReducer,
} from "./channels";
import type {
  McpServerConnection,
  StateUpdateMode,
  LangGraphStateUpdateItem,
  LangGraphToolDefinition,
} from "./tools";
import type { LangGraphStepConfig, LangGraphEdgeConfig } from "./steps";
import type {
  LangGraphMemoryConfig,
  LangGraphMemoryDefinition,
} from "./memory";
import type { LangGraphMiddlewareDefinition } from "./middleware";
import type { PipelineStepInputBinding } from "../pipeline";

export type LangGraphEventStreamType =
  | "stream.messages"
  | "message.text"
  | "message.reasoning"
  | "message.toolCalls"
  | "stream.toolCalls"
  | "stream.values"
  | "stream.output"
  | "stream.subagents"
  | "stream.extensions";

export type LangGraphStreamTransformerMode =
  | "standard_sse"
  | "ai_sdk"
  | "openai_chunk"
  | "minimal"
  | "full_trace"
  | "custom";

export interface LangGraphStreamEnvelopeConfig {
  includeEvent?: boolean;
  includeAgent?: boolean;
  includeRunId?: boolean;
  includeTimestamp?: boolean;
  includeDelta?: boolean;
  includeContent?: boolean;
  includeTool?: boolean;
  includeInputs?: boolean;
  includeOutput?: boolean;
  includeUsage?: boolean;
  flattenPayload?: boolean;
  stripEmptyDeltas?: boolean;
}

export interface LangGraphStreamTransformerConfig {
  mode?: LangGraphStreamTransformerMode;
  customCode?: string;
}

export interface LangGraphAgentStreamConfig {
  enabled?: boolean;
  version?: "v3" | "v2" | string;
  selectedEvents?: (LangGraphEventStreamType | string)[];
  envelope?: LangGraphStreamEnvelopeConfig;
  transformer?: LangGraphStreamTransformerConfig;
}

export interface LangGraphAgentResponseFormatConfig {
  enabled?: boolean;
  strategy?: "auto" | "provider" | "tool";
  schemaType?: "json_schema" | "zod" | "standard_schema";
  schemaName?: string;
  schemaJson?: string;
  toolMessageContent?: string;
  handleErrorMode?: "default" | "custom_message" | "disabled";
  customErrorMessage?: string;
}

export interface LangGraphAgentMemoryConfig {
  enabled?: boolean;
  checkpointer?: string;
  threadIdKey?: string;
  threadScope?: "session" | "user" | "global";
  autoSummarize?: boolean;
  maxWindowMessages?: number;
  saveMessages?: boolean;
}

export type LangGraphNodeStepType =
  | "state_updates"
  | "llm_call"
  | "custom_code"
  | "transformer"
  | "transform"
  | "tools"
  | "structured_output"
  | "middleware"
  | "streaming";

export interface LangGraphNodePipelineStep {
  id: string;
  type: LangGraphNodeStepType;
  label?: string;
  customCode?: {
    body?: string;
  };
  llmConfig?: {
    enabled?: boolean;
    provider?: string;
    model?: string;
    temperature?: number;
  };
  systemPrompt?: string;
  transformerNodeId?: string;
  transformerRef?: string;
  functionRef?: {
    name?: string;
    importPath?: string;
    inputSchema?: Array<{ name: string; type: string; required?: boolean; description?: string }>;
    returnSchema?: Array<{ name: string; type: string; required?: boolean; description?: string }>;
  };
  outputVariable?: string;
  outputSchema?: Array<{ name: string; type: string; required?: boolean; description?: string }>;
  inputBindings?: PipelineStepInputBinding[];
}

export interface LangGraphAgentDefinition {
  id?: string;
  agentId?: string;
  name: string;
  systemPrompt?: string;
  llmNodeId?: string;
  modelConfig?: LangGraphStepConfig["modelConfig"];
  llmConfig?: {
    enabled?: boolean;
    provider?: string;
    model?: string;
    temperature?: number;
  };
  stateUpdatesConfig?: {
    enabled?: boolean;
  };
  middlewareConfig?: {
    enabled?: boolean;
  };
  streamConfig?: LangGraphAgentStreamConfig;
  responseFormat?: LangGraphAgentResponseFormatConfig;
  memoryConfig?: LangGraphAgentMemoryConfig;
  stateUpdates?: LangGraphStateUpdateItem[];
  customCode?: {
    body?: string;
  };
  nodeSteps?: LangGraphNodeStepType[];
  pipelineSteps?: LangGraphNodePipelineStep[];
  tools?: string[]; // Bound tool IDs
  middleware?: string[]; // Bound middleware IDs
  transformers?: string[]; // Bound transformer IDs
  memory?: string[]; // Bound memory / checkpointer / db_ref IDs
  position?: { x: number; y: number };
}

export interface CustomLLMRefNodeDefinition {
  id: string;
  label?: string;
  llmRef?: string;
  position?: { x: number; y: number };
}

export interface CustomToolRefNodeDefinition {
  id: string;
  label?: string;
  toolRef?: string;
  position?: { x: number; y: number };
}

export interface CustomMiddlewareRefNodeDefinition {
  id: string;
  label?: string;
  middlewareRef?: string;
  position?: { x: number; y: number };
}

export interface CustomMemoryRefNodeDefinition {
  id: string;
  label?: string;
  memoryRef?: string;
  position?: { x: number; y: number };
}

export interface CustomAgentRefNodeDefinition {
  id: string;
  label?: string;
  agentRef?: string;
  nodeRef?: string;
  position?: { x: number; y: number };
}

export interface CustomTransformerNodeDefinition {
  id: string;
  label?: string;
  functionName?: string;
  scope?: "global" | "local";
  isGlobal?: boolean;
  code?: string;
  inputSchema?: {
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }[];
  returnSchema?: {
    id: string;
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
  position?: { x: number; y: number };
}

export interface CustomTransformerRefNodeDefinition {
  id: string;
  label?: string;
  transformerRef?: string;
  position?: { x: number; y: number };
}

/** LangGraph Agent node fields — the parent graph node (canvas type). */
export interface CanvasLangGraphNodeData {
  label?: string;
  description?: string;
  inputChannels?: LangGraphInputChannel[];
  stateChannels?: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  graphSteps?: LangGraphStepConfig[];
  graphEdges?: LangGraphEdgeConfig[];
  outputPorts?: LangGraphOutputPort[];
  outputChannels?: OutputChannelConfig[];
  memoryConfig?: LangGraphMemoryConfig;
  customLlmNodes?: {
    id: string;
    label: string;
    provider?: string;
    url?: string;
    baseUrl?: string;
    method?: string;
    headersJson?: string;
    bodyJson?: string;
    model?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    temperature?: number;
    maxTokens?: number;
    position?: { x: number; y: number };
  }[];
  customLlmRefNodes?: CustomLLMRefNodeDefinition[];
  customToolRefNodes?: CustomToolRefNodeDefinition[];
  customMiddlewareRefNodes?: CustomMiddlewareRefNodeDefinition[];
  customMemoryRefNodes?: CustomMemoryRefNodeDefinition[];
  customAgentRefNodes?: CustomAgentRefNodeDefinition[];
  customTransformerNodes?: CustomTransformerNodeDefinition[];
  customTransformerRefNodes?: CustomTransformerRefNodeDefinition[];
  transformerDefinitions?: CustomTransformerNodeDefinition[];
  toolDefinitions?: LangGraphToolDefinition[];
  middlewareDefinitions?: LangGraphMiddlewareDefinition[];
  agentDefinitions?: LangGraphAgentDefinition[];
  memoryDefinitions?: LangGraphMemoryDefinition[];
  mcpServerConnections?: McpServerConnection[];
  startNodePosition?: { x: number; y: number };
  stateNodePosition?: { x: number; y: number };
  checkpointerNodePosition?: { x: number; y: number };
  endNodePosition?: { x: number; y: number };
  endNodes?: {
    id: string;
    label?: string;
    position?: { x: number; y: number };
  }[];
}
