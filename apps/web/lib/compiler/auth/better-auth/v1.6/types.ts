import { CanvasAuthNodeData } from "@workspace/canvas";

export type BetterAuthV16NodeData = CanvasAuthNodeData & {
  label?: string;
  port?: string;
  baseUrl?: string;
};

export interface AdapterConfig {
  importStatement: string;
  adapterCall: string;
}
