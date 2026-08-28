import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, AnyMessagingResource } from "@workspace/canvas/types";

export interface NodeDeletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodesPendingDeletion: BackendNode[];
  projectId: string;
  projectName?: string;
}

export type AffectedItemType = "deleted" | "modified" | "added";

export interface AffectedItem {
  path: string;
  type: AffectedItemType;
}

export interface AffectedFileTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  type?: AffectedItemType;
  deletedCount?: number;
  modifiedCount?: number;
  children?: AffectedFileTreeNode[];
}

export interface ActiveFileDetails {
  path: string;
  isDeleted: boolean;
  isModified: boolean;
  content: string;
  lines: string[];
  hasAfterVersion: boolean;
}

/** Information about a connection severed by node deletion */
export interface SeveredConnectionInfo {
  edgeId: string;
  edgeType?: string;
  sourceNodeId: string;
  sourceNodeLabel: string;
  sourceNodeType: string;
  targetNodeId: string;
  targetNodeLabel: string;
  targetNodeType: string;
  otherNodeId: string;
  otherNodeLabel: string;
  otherNodeType: string;
  direction: "incoming" | "outgoing";
  description: string;
}

/** Information about a child / cascade deleted element */
export interface CascadeElementInfo {
  id: string;
  label: string;
  type: string;
  category: "schema" | "page" | "endpoint" | "event" | "step" | "hook" | "ref";
  description: string;
}

/** Information about an orphaned reference */
export interface BrokenReferenceInfo {
  referencingNodeId: string;
  referencingNodeLabel: string;
  referencingNodeType: string;
  referenceType: string;
  description: string;
}

/** Complete architecture impact summary */
export interface NodeArchitectureImpact {
  targetNodes: Array<{
    id: string;
    label: string;
    type: string;
    techStack?: string;
    dbEngine?: string;
    parentGroupLabel?: string;
  }>;
  severedConnections: SeveredConnectionInfo[];
  cascadeElements: CascadeElementInfo[];
  brokenReferences: BrokenReferenceInfo[];
  totalCanvasImpactCount: number;
}
