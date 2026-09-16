import { PipelineStep } from "@workspace/canvas/types";
import { toVarName } from "../../../utils";

/**
 * Builds an import map from pipeline steps (including recursive nested branches).
 * Returns a map of { importPath -> Set<functionName> }.
 */
export function collectPipelineImports(
  steps: PipelineStep[],
): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();

  function addStepImports(s: PipelineStep): void {
    if (s.functionRef && s.enabled !== false) {
      const name = toVarName(s.functionRef.name || "fn");
      let importPath = s.functionRef.importPath || "";

      if (s.type === "transform" || importPath.includes("transformers")) {
        if (s.functionRef.isGlobal || importPath.startsWith("@workspace/transformers")) {
          importPath = "@workspace/transformers";
        } else if (
          importPath.startsWith("@/services/") ||
          importPath.startsWith("@workspace/services/") ||
          importPath.startsWith("@/")
        ) {
          importPath = `../transformers/${name}`;
        }
      }

      const existing = imports.get(importPath);
      if (existing) {
        existing.add(name);
      } else {
        imports.set(importPath, new Set([name]));
      }
    } else if (s.type === "langgraph_invoke" && s.enabled !== false) {
      const graphName = s.langGraphTargetNodeId
        ? `${s.langGraphTargetNodeId.replace(/[^a-zA-Z0-9]/g, "")}Graph`
        : "agentGraph";
      const importPath = `../graphs/${graphName}`;
      const existing = imports.get(importPath);
      if (existing) {
        existing.add(graphName);
      } else {
        imports.set(importPath, new Set([graphName]));
      }
    } else if (s.type === "push_to_client" && s.enabled !== false) {
      const protocol = s.clientDeliveryProtocol || "SSE";
      let fnName: string | null = null;
      if (protocol === "SSE") {
        fnName = "sseBroadcast";
      } else if (protocol === "WEBSOCKET") {
        fnName = "wsBroadcast";
      } else if (protocol === "WEBRTC") {
        fnName = "webrtcBroadcast";
      }
      if (fnName) {
        const importPath = "../lib";
        const existing = imports.get(importPath);
        if (existing) {
          existing.add(fnName);
        } else {
          imports.set(importPath, new Set([fnName]));
        }
      }
    }

    // Cache Miss imports for Redis operations
    if (
      s.type === "redis_operation" &&
      s.cacheMiss?.enabled &&
      s.enabled !== false
    ) {
      if (s.cacheMiss.action === "fallback_db" && s.cacheMiss.functionRef?.name) {
        const dbName = toVarName(s.cacheMiss.functionRef.name);
        const dbPath = s.cacheMiss.functionRef.importPath || "@workspace/db";
        const existing = imports.get(dbPath);
        if (existing) {
          existing.add(dbName);
        } else {
          imports.set(dbPath, new Set([dbName]));
        }
      }

      if (
        s.cacheMiss.writeBackToCache &&
        s.cacheMiss.writeBackFunctionRef?.name
      ) {
        const writeBackFn = toVarName(s.cacheMiss.writeBackFunctionRef.name);
        const redisPath =
          s.cacheMiss.writeBackFunctionRef.importPath ||
          s.functionRef?.importPath ||
          "@workspace/redis";
        const existing = imports.get(redisPath);
        if (existing) {
          existing.add(writeBackFn);
        } else {
          imports.set(redisPath, new Set([writeBackFn]));
        }
      }
    }
    if (s.thenSteps) s.thenSteps.forEach(addStepImports);
    if (s.elseSteps) s.elseSteps.forEach(addStepImports);
    if (s.trySteps) s.trySteps.forEach(addStepImports);
    if (s.catchSteps) s.catchSteps.forEach(addStepImports);
    if (s.cacheMissSteps) s.cacheMissSteps.forEach(addStepImports);
    if (s.switchCases) s.switchCases.forEach((c) => c.steps?.forEach(addStepImports));
    if (s.switchDefault) s.switchDefault.forEach(addStepImports);
    if (s.parallelBranches) s.parallelBranches.forEach((b) => b.steps?.forEach(addStepImports));
    if (s.loopBody) s.loopBody.forEach(addStepImports);
  }

  for (const step of steps) {
    addStepImports(step);
  }

  return imports;
}
