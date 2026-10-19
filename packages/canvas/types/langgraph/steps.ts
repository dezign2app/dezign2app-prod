import type {
  PipelineStep,
  PipelineStepInputBinding,
} from "../pipeline";

export type LangGraphRouterBranchOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "is_not_null"
  | "has_tool_calls"
  | "expression";

export type LangGraphRouterBranchCondition = {
  field?: string;
  operator?: LangGraphRouterBranchOperator | string;
  value?: string;
};

export type LangGraphRouterBranch = {
  id: string;
  label: string;
  field: string;
  operator: LangGraphRouterBranchOperator;
  value?: string;
  isDefault?: boolean;
  conditions?: LangGraphRouterBranchCondition[];
  targetId?: string;
};

export type LangGraphRouterConfig = {
  branches: LangGraphRouterBranch[];
  defaultBranchId?: string;
};

export type LangGraphStepConfig = {
  id: string;
  name: string;
  type:
    | "llm_call"
    | "tool_node"
    | "evaluator"
    | "summarizer"
    | "custom_code"
    | "transformer"
    | "transform"
    | "human_gate"
    | "interrupt"
    | "vector_search"
    | "router";
  modelConfig?: {
    provider?:
      | "groq"
      | "openai"
      | "anthropic"
      | "google"
      | "other"
      | (string & {});
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    baseUrl?: string;
    url?: string;
    method?: string;
    headersJson?: string;
    bodyJson?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    customLlmNodeId?: string;
  };
  humanGateConfig?: {
    approvalPrompt: string;
    timeoutMs?: number;
    requiredRole?: string;
  };
  interruptConfig?: {
    callbackKey: string;
    timeoutMs?: number;
  };
  customCode?: {
    body: string;
    timeoutMs?: number;
    memoryLimitMb?: number;
  };
  routerConfig?: LangGraphRouterConfig;
  tools?: string[];
  transformers?: string[];
  retryPolicy?: {
    maxAttempts: number;
    backoffFactor: number;
  };
  transformerNodeId?: string;
  transformerRef?: string;
  functionRef?: {
    name: string;
    importPath?: string;
  };
  inputBindings?: PipelineStepInputBinding[];
  outputVariable?: string;
  outputSchema?: Array<{ name: string; type: string; required?: boolean }>;
  pipelineSteps?: PipelineStep[];
  stateUpdates?: {
    channelKey: string;
    value?: string;
    mode?: "set" | "append" | "expression";
  }[];
  position?: { x: number; y: number };
};

export type LangGraphEdgeConfig = {
  id: string;
  source: string;
  sourceHandle?: string;
  targetHandle?: string;
  targets: {
    id: string;
    kind: "step" | "port" | "end";
    targetHandle?: string;
  }[];
  condition?: {
    field?: string;
    operator?: string;
    value?: unknown;
  };
  isDefault?: boolean;
  sendConfig?: {
    enabled?: boolean;
    itemsField?: string;
    itemTarget?: { id: string; kind: "step" | "port" | "end" };
    joinStepId?: string;
    batchErrorPolicy?: string;
  };
};
