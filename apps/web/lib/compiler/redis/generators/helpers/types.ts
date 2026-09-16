// ═══════════════════════════════════════════════════════════════
// MODULE: RedisHelperTypes
// LAYER:  redis / generators / helpers
// ═══════════════════════════════════════════════════════════════

import { CompiledFile, ReusableFunction } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { GeneratedSchemaResult } from "../schemaFiles";

export interface HelperFilesResult {
  files: CompiledFile[];
  reusableFunctions: ReusableFunction[];
  helperBarrelExport: string;
}

export interface HelperEmitResult {
  files: CompiledFile[];
  barrelExports: string[];
}

export interface HelperContext {
  schema: GeneratedSchemaResult;
  schemaNode: BackendNode;
  allNodes: BackendNode[];
  packageName: string;
}
