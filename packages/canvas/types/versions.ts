import type { BackendNodeData } from "./nodes";
import type { EdgeData } from "./edges";
import type { Endpoint } from "../schemas/endpoints";
import type { AnyMessagingResource } from "./messaging";
import type { IdentityProvider } from "../schemas/identityProviders";
import type { SimulationTestCase } from "./simulation";

export interface VersionChangeSummary {
  nodesAdded: number;
  nodesModified: number;
  nodesDeleted: number;
  edgesAdded: number;
  edgesDeleted: number;
}

export type ChangeSummary = VersionChangeSummary;

export interface VersionNodeSnapshot {
  nodeId: string;
  type: string;
  position: { x: number; y: number };
  data?: BackendNodeData;
  fractionalIndex: string;
}

export interface VersionEdgeSnapshot {
  edgeId: string;
  source: string;
  target: string;
  type: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: EdgeData;
  fractionalIndex: string;
  rulesVersion?: number;
}

export interface VersionEndpointSnapshot {
  nodeId: string;
  endpointId: string;
  data: Endpoint;
}

export interface VersionEventSnapshot {
  nodeId: string;
  eventId: string;
  variant: "publish" | "consume";
  data: AnyMessagingResource;
}

export interface VersionIdentityProviderSnapshot {
  nodeId: string;
  providerId: string;
  data: IdentityProvider;
}

export interface VersionTestCaseSnapshot {
  testCaseId: string;
  data: SimulationTestCase;
}

export interface VersionSnapshot {
  nodes: VersionNodeSnapshot[];
  edges: VersionEdgeSnapshot[];
  endpoints: VersionEndpointSnapshot[];
  events: VersionEventSnapshot[];
  identityProviders: VersionIdentityProviderSnapshot[];
  testCases: VersionTestCaseSnapshot[];
}

export interface VersionListItem {
  _id: string;
  _creationTime: number;
  projectId: string;
  versionNumber: number;
  title: string;
  description?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  changeSummary: VersionChangeSummary;
  isAutoSave: boolean;
  createdAt: number;
}
