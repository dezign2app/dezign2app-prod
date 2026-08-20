import { BackendNode, BackendEdge } from "@/types/canvas";
import {
  EndpointWithNode,
  EventWithNode,
  IdentityProviderWithNode,
} from "../types";

export interface GraphSnapshot {
  nodes: BackendNode[];
  edges: BackendEdge[];
  endpoints: EndpointWithNode[];
  events: EventWithNode[];
  identityProviders: IdentityProviderWithNode[];
}

export interface SchemaSnapshot {
  nodes: BackendNode[];
  edges: BackendEdge[];
}
