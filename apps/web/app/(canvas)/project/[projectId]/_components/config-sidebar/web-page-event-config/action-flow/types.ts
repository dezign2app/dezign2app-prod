import type {
  FrontendActionStepType,
  FrontendFieldSource,
  FrontendRequestFieldBinding,
  FrontendActionStepDraft,
  BackendNode,
  Endpoint,
  UIEventItem,
} from "@workspace/canvas";
import type { ActionStepItem } from "../TargetEndpointSection";

export type {
  FrontendActionStepType,
  FrontendFieldSource,
  FrontendRequestFieldBinding,
  FrontendActionStepDraft,
};

export interface ActionFlowEditorProps {
  item?: UIEventItem;
  canvasSteps: ActionStepItem[];
  serviceNodes: BackendNode[];
  allNodes: BackendNode[];
  endpoints: (Endpoint & { nodeId: string })[];
  webPageNodeId?: string;
  actionId?: string;
  onSave: (drafts: FrontendActionStepDraft[]) => void;
  onDeleteStep?: (edgeId: string) => void;
}

export interface ActionFlowStepProps {
  stepDraft: FrontendActionStepDraft;
  canvasStep?: ActionStepItem;
  stepIndex: number;
  allSteps: FrontendActionStepDraft[];
  allCanvasSteps: ActionStepItem[];
  allNodes: BackendNode[];
  serviceNodes: BackendNode[];
  endpoints: (Endpoint & { nodeId: string })[];
  webPageNodeId?: string;
  actionId?: string;
  onChange: (updated: FrontendActionStepDraft) => void;
  onDelete: () => void;
}

export interface ApiCallStepProps {
  draft: FrontendActionStepDraft;
  canvasStep?: ActionStepItem;
  stepIndex: number;
  allSteps: FrontendActionStepDraft[];
  allCanvasSteps: ActionStepItem[];
  serviceNodes?: BackendNode[];
  allNodes?: BackendNode[];
  endpoints?: (Endpoint & { nodeId: string })[];
  webPageNodeId?: string;
  actionId?: string;
  onChange: (updated: FrontendActionStepDraft) => void;
}

export interface StoragePutStepProps {
  draft: FrontendActionStepDraft;
  canvasStep?: ActionStepItem;
  stepIndex: number;
  allSteps: FrontendActionStepDraft[];
  allCanvasSteps: ActionStepItem[];
  allNodes?: BackendNode[];
  endpoints?: (Endpoint & { nodeId: string })[];
  webPageNodeId?: string;
  actionId?: string;
  onChange: (updated: FrontendActionStepDraft) => void;
}

export interface ResponseFieldPickerProps {
  value: string;
  onChange: (val: string) => void;
  endpoint?: Endpoint;
  placeholder?: string;
  disabled?: boolean;
}
