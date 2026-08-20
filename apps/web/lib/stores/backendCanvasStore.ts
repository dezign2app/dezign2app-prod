import { create } from "zustand";
import {
  BackendCanvasState,
  CanvasSnapshotState,
  EndpointWithNode,
  EventWithNode,
  IdentityProviderWithNode,
} from "./backendCanvas/types";
import { parseResourceHandle } from "./backendCanvas/utils";
import { createNodeSlice } from "./backendCanvas/slices/nodeSlice";
import { createEdgeSlice } from "./backendCanvas/slices/edgeSlice";
import { createEndpointSlice } from "./backendCanvas/slices/endpointSlice";
import { createEventSlice } from "./backendCanvas/slices/eventSlice";
import { createIdentityProviderSlice } from "./backendCanvas/slices/identityProviderSlice";
import { createSyncSlice } from "./backendCanvas/slices/syncSlice";
import { createHistorySlice } from "./backendCanvas/slices/historySlice";

export { parseResourceHandle };
export type {
  BackendCanvasState,
  CanvasSnapshotState,
  EndpointWithNode,
  EventWithNode,
  IdentityProviderWithNode,
};

export const useBackendCanvasStore = create<BackendCanvasState>((set, get) => ({
  ...createSyncSlice(set),
  ...createHistorySlice(set, get),
  ...createNodeSlice(set, get),
  ...createEdgeSlice(set, get),
  ...createEndpointSlice(set, get),
  ...createEventSlice(set, get),
  ...createIdentityProviderSlice(set, get),
}));
