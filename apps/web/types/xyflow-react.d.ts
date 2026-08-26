declare module "@xyflow/react" {
  import * as React from "react";

  export interface XYPosition {
    x: number;
    y: number;
  }

  export interface Node<TData = any, TType extends string = string> {
    id: string;
    type?: TType;
    position: XYPosition;
    data: TData;
    deletable?: boolean;
    selected?: boolean;
  }

  export interface Edge<TData = any> {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    type?: string;
    data?: TData;
    label?: React.ReactNode;
    style?: React.CSSProperties;
    markerEnd?: Record<string, unknown>;
    labelStyle?: React.CSSProperties;
    labelShowBg?: boolean;
    labelBgStyle?: React.CSSProperties;
    labelBgPadding?: [number, number];
    labelBgBorderRadius?: number;
    animated?: boolean;
  }

  export interface Connection {
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }

  export interface NodeProps<TNode = Node> {
    id: string;
    data: TNode extends Node<infer TData, string> ? TData : never;
    selected?: boolean;
    width?: number;
    height?: number;
  }

  export interface EdgeProps<TEdge = Edge> {
    id: string;
    source: string;
    target: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: string;
    targetPosition: string;
    data?: Record<string, unknown>;
    markerEnd?: string;
    markerStart?: string;
    style?: React.CSSProperties;
    selected?: boolean;
  }

  export type NodeChange<TNode = Node> =
    | {
        id: string;
        type: "add" | "remove" | "replace" | "select" | "dimensions";
        selected?: boolean;
      }
    | {
        id: string;
        type: "position";
        position?: XYPosition;
        dragging?: boolean;
      };

  export type EdgeChange<TEdge = Edge> = {
    id: string;
    type: "add" | "remove" | "replace" | "select";
    selected?: boolean;
  };

  export type OnNodesChange<TNode = Node> = (
    changes: NodeChange<TNode>[],
  ) => void;
  export type OnEdgesChange<TEdge = Edge> = (
    changes: EdgeChange<TEdge>[],
  ) => void;
  export type OnConnect = (connection: Connection) => void;

  export const Position: {
    Left: "left";
    Right: "right";
    Top: "top";
    Bottom: "bottom";
  };

  export const MarkerType: {
    ArrowClosed: "arrowclosed";
  };

  export const BackgroundVariant: {
    Dots: "dots";
    Lines: "lines";
  };

  export const Handle: React.ComponentType<Record<string, unknown>>;
  export const Background: React.ComponentType<Record<string, unknown>>;
  export const Controls: React.ComponentType<Record<string, unknown>>;
  export const MiniMap: React.ComponentType<Record<string, unknown>>;
  export const BaseEdge: React.ComponentType<Record<string, unknown>>;
  export const EdgeLabelRenderer: React.ComponentType<{
    children?: React.ReactNode;
  }>;
  export const NodeResizer: React.ComponentType<Record<string, unknown>>;
  export const Panel: React.ComponentType<Record<string, unknown>>;
  export const ReactFlowProvider: React.ComponentType<{
    children?: React.ReactNode;
  }>;

  export function ReactFlow<TNode = Node, TEdge = Edge>(
    props: Record<string, unknown> & {
      children?: React.ReactNode;
      nodes?: TNode[];
      edges?: TEdge[];
    },
  ): React.ReactElement;

  export interface Viewport {
    x: number;
    y: number;
    zoom: number;
  }

  export function useReactFlow<TNode = Node, TEdge = Edge>(): {
    fitView: (options?: Record<string, unknown>) => void;
    screenToFlowPosition: (position: XYPosition) => XYPosition;
    setViewport: (
      viewport: Viewport,
      options?: Record<string, unknown>,
    ) => void;
    getViewport: () => Viewport;
    setNodes: (nodes: TNode[] | ((nodes: TNode[]) => TNode[])) => void;
    setEdges: (edges: TEdge[] | ((edges: TEdge[]) => TEdge[])) => void;
    getNodes: () => TNode[];
    getEdges: () => TEdge[];
    deleteElements: (params: {
      nodes?: { id: string }[];
      edges?: { id: string }[];
    }) => void;
  };

  export function applyNodeChanges<TNode = Node>(
    changes: NodeChange<TNode>[],
    nodes: TNode[],
  ): TNode[];

  export function applyEdgeChanges<TEdge = Edge>(
    changes: EdgeChange<TEdge>[],
    edges: TEdge[],
  ): TEdge[];

  export interface GetPathParams {
    sourceX: number;
    sourceY: number;
    sourcePosition?: string;
    targetX: number;
    targetY: number;
    targetPosition?: string;
    borderRadius?: number;
    offset?: number;
  }

  export function getSmoothStepPath(
    params: GetPathParams,
  ): [string, number, number, number, number];
  export function getBezierPath(
    params: GetPathParams,
  ): [string, number, number, number, number];

  export function addEdge<TEdge = Edge>(edgeParams: TEdge | Connection, edges: TEdge[]): TEdge[];
}
