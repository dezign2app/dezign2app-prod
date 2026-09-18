import { BackendNode } from "@/types/canvas";
import { CanvasEntityColumn } from "@workspace/canvas/types";

export type LogicMode = "natural_language" | "code";

export type CrudOperation = "create" | "read" | "update" | "delete" | string;

export interface TableCrudConfig {
  tableNodeId?: string;
  tableName?: string;
  operations?: CrudOperation[];
  explanations?: Record<string, string>;
}

export interface PublishedEventInfo {
  id?: string;
  name?: string;
  topic?: string;
}

export interface TableSchemaInfo {
  id?: string;
  name: string;
  dbType?: string;
  columns?: CanvasEntityColumn[];
  indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
}

export interface DbOperationParamInfo {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
}

export interface BusinessLogicBlockProps {
  mode?: LogicMode;
  onModeChange?: (mode: LogicMode) => void;
  prompt?: string;
  onPromptChange?: (val: string) => void;
  code?: string;
  onCodeChange?: (val: string) => void;
  onGenerateCode?: () => Promise<void> | void;
  onResetContext?: () => void;
  isGenerating?: boolean;
  title?: string;
  description?: string;
  promptPlaceholder?: string;
  codePlaceholder?: string;
  codeLanguageLabel?: string;
  className?: string;

  // CRUD Operations Props
  crudConfig?: TableCrudConfig[];
  onCrudConfigChange?: (config: TableCrudConfig[]) => void;
  availableTableNodes?: { id: string; label: string }[];
  allNodes?: BackendNode[];
  serviceNodeId?: string;
  endpointId?: string;

  // Messaging & Endpoint Context Props
  publishedEvents?: PublishedEventInfo[];
  endpointMethod?: string;
  endpointPath?: string;

  // Function Signature & Type Framing Props
  functionName?: string;
  inputTypeName?: string;
  outputTypeName?: string;
  isAsync?: boolean;
  inputSchema?: Array<{ name: string; type: string; required?: boolean }>;
  returnSchema?: Array<{ name: string; type: string; required?: boolean }>;

  // Database Operation Context Props
  contextType?: "endpoint" | "db_operation" | "transformer" | "langgraph";
  dbType?: string;
  tableName?: string;
  tableSchema?: {
    name: string;
    columns?: CanvasEntityColumn[];
    indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  };
  allTableSchemas?: TableSchemaInfo[];
  operationKind?: string;
  operationParams?: DbOperationParamInfo[];
  operationReturnType?: string;
  pagination?: {
    enabled?: boolean;
    defaultLimit?: number;
    maxLimit?: number;
    mode?: "offset" | "cursor";
  };
}
