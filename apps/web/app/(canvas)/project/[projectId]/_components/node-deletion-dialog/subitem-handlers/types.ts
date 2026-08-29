import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, AnyMessagingResource } from "@workspace/canvas/types";
import {
  NodeArchitectureImpact,
  SeveredConnectionInfo,
  CascadeElementInfo,
  BrokenReferenceInfo,
} from "../types";

export interface SubItemSimulationContext {
  nodes: BackendNode[];
  endpoints: (Endpoint & { nodeId: string })[];
  events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[];
  edges: BackendEdge[];
}

export interface SubItemSimulationResult {
  nextNodes: BackendNode[];
  nextEndpoints: (Endpoint & { nodeId: string })[];
  nextEvents: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[];
  nextEdges: BackendEdge[];
  targetNodes: NodeArchitectureImpact["targetNodes"];
  severedConnections: SeveredConnectionInfo[];
  cascadeElements: CascadeElementInfo[];
  brokenReferences: BrokenReferenceInfo[];
}
