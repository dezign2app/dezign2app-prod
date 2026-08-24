import { BackendEdge, BackendNode } from "@/types/canvas";
import { Connection } from "@xyflow/react";
import { BackendCanvasState } from "../types";

export type CanvasStoreSet = (
  partial:
    | Partial<BackendCanvasState>
    | ((state: BackendCanvasState) => Partial<BackendCanvasState>),
) => void;

export type CanvasStoreGet = () => BackendCanvasState;

export interface ConnectionContext {
  set: CanvasStoreSet;
  get: CanvasStoreGet;
  connection: Connection;
  sourceNode: BackendNode;
  targetNode: BackendNode;
  newEdge: BackendEdge;
}
