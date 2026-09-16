import { ReusableFunction } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";

/**
 * Context available while rendering a pipeline step sequence.
 * Tracks which output variables are declared by prior steps so
 * subsequent steps can reference them safely.
 */
export interface PipelineRenderContext {
  /** Map of stepId -> outputVariable name for all prior steps */
  priorOutputs: Map<string, string>;
  /** The validated body variable name (e.g. "body" or "req.body") */
  bodyVar: string;
  /** Set of outputVariable names that have been null-narrowed by an upstream guard */
  narrowedOutputs?: Set<string>;
  /** Metadata about step outputs (e.g. whether the return type is an array) */
  stepOutputMeta?: Map<string, { isArray: boolean }>;
  /** Available reusable functions to inspect return type signatures */
  reusableFunctions?: ReusableFunction[];
  /** Canvas nodes for schema and data structure lookup */
  allNodes?: BackendNode[];
}

