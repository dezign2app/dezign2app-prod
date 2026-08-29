import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, AnyMessagingResource } from "@workspace/canvas/types";

export interface DeletionColumnTarget {
  type: "column";
  nodeId: string;
  column: {
    name: string;
    type?: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    isUnique?: boolean;
    isNotNull?: boolean;
    references?: { table?: string; column?: string };
  };
  onConfirm: () => void;
}

export interface DeletionIndexTarget {
  type: "index";
  nodeId: string;
  indexItem: {
    name: string;
    columns?: string;
    isUnique?: boolean;
  };
  onConfirm: () => void;
}

export interface DeletionSectionTarget {
  type: "section";
  nodeId: string;
  section: {
    id: string;
    name?: string;
    type?: string;
    title?: string;
  };
  onConfirm: () => void;
}

export interface DeletionZoneTarget {
  type: "zone";
  nodeId: string;
  zone: {
    id: string;
    name?: string;
    route?: string;
  };
  onConfirm: () => void;
}

export interface DeletionEndpointTarget {
  type: "endpoint";
  nodeId: string;
  endpoint: {
    id: string;
    name?: string;
    type?: string;
  };
  onConfirm: () => void;
}

export interface DeletionActionTarget {
  type: "action";
  nodeId: string;
  sectionId?: string;
  action: {
    id: string;
    name?: string;
    event?: string;
  };
  onConfirm: () => void;
}

export interface DeletionPageRenameTarget {
  type: "pageRename";
  nodeId: string;
  oldLabel: string;
  newLabel: string;
  onConfirm: () => void;
}

export interface DeletionGenericTarget {
  type: "custom";
  title?: string;
  description?: string;
  nodeId?: string;
  itemLabel?: string;
  itemType?: string;
  onConfirm: () => void;
}

export type DeletionTarget =
  | {
      type: "nodes";
      nodes: BackendNode[];
    }
  | DeletionColumnTarget
  | DeletionIndexTarget
  | DeletionSectionTarget
  | DeletionActionTarget
  | DeletionZoneTarget
  | DeletionEndpointTarget
  | DeletionPageRenameTarget
  | DeletionGenericTarget;

export interface NodeDeletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodesPendingDeletion?: BackendNode[];
  deletionTarget?: DeletionTarget;
  projectId?: string;
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
