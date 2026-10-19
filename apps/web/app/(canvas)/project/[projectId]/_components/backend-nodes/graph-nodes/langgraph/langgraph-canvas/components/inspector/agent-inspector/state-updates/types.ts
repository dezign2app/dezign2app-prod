import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
  AgentNodeData,
  LangGraphCanvasNode,
  CustomTypeItem,
} from "@workspace/canvas";

export interface TransformerStepFieldLike {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
}

export interface TransformerStepLike {
  id: string;
  outputVariable?: string;
  outputSchema?: TransformerStepFieldLike[];
  functionRef?: { returnSchema?: TransformerStepFieldLike[] };
}

export interface SchemaFieldLike {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
}

export interface AgentStateUpdatesSectionProps {
  selectedAgentData: AgentNodeData;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  stateChannels?: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  embedded?: boolean;
  nodes?: LangGraphCanvasNode[];
}

export interface ReferenceStepField {
  path: string;
  label: string;
  short: string;
  type?: string;
}

export interface ReferenceStep {
  id: string;
  label: string;
  fields: ReferenceStepField[];
}

export interface ChannelMeta {
  channel: LangGraphStateChannel | undefined;
  type: string;
  customTypeName?: string;
  customTypeSchema?: CustomTypeItem;
  customTypeId?: string;
  displayType: string;
  reducer: string;
  isCustom: boolean;
  customCode: string;
  description?: string;
}

export type DispatchFieldValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>;
