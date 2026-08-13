import { ConditionPrimitive, SessionClaimConfig } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";

export interface AccessConditionsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  leaves: ConditionPrimitive[];
  connectedPages: BackendNode[];
  authClaims?: SessionClaimConfig[];
  authNodeLabel?: string;
  isAuthConnected?: boolean;
  allNodes?: BackendNode[];
  onAddCondition: (type: ConditionPrimitive["type"], customKey?: string) => void;
  onRemoveCondition: (index: number) => void;
  onUpdateCondition?: (index: number, condition: ConditionPrimitive) => void;
}

export interface ClaimColumnInfo {
  dataType: "enum" | "boolean" | "number" | "string";
  enumValues?: string[];
  entityName?: string;
  columnName?: string;
}
