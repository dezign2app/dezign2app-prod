import { BackendNode, Endpoint } from "@workspace/canvas/types";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { extractNestedPaths, parseRawJsonSafe } from "@/lib/utils/nestedJsonSchema";
import { AvailablePath, PipelineStepDraft } from "../../types";
import { isSchemaField } from "../pathUtils";

export function resolveCallStepPaths(
  step: PipelineStepDraft,
  allNodes: BackendNode[],
  stepPaths: AvailablePath[],
  allEndpoints: readonly Endpoint[] = useBackendCanvasStore.getState().endpoints,
): void {
  const isCallStep = step.type === "external_call" || step.type === "service_call";
  if (!isCallStep) return;

  const targetEp = allEndpoints.find(
    (ep) =>
      ep.id === step.externalEndpointId ||
      ep.id === step.tableNodeId ||
      ep.id === step.operationId ||
      ep.name === step.tableNodeId,
  );

  if (targetEp?.responseBody) {
    if (Array.isArray(targetEp.responseBody.fields)) {
      targetEp.responseBody.fields.forEach((f) => {
        if (f.name && !stepPaths.some((p) => p.path === f.name)) {
          stepPaths.push({ path: f.name, type: f.type || "string" });
        }
      });
    }
    if (targetEp.responseBody.rawJson) {
      const { parsed, error } = parseRawJsonSafe(targetEp.responseBody.rawJson);
      if (!error && parsed !== null) {
        const nested = extractNestedPaths(parsed);
        nested.forEach((item) => {
          if (item.path && !stepPaths.some((p) => p.path === item.path)) {
            stepPaths.push({ path: item.path, type: item.type });
          }
        });
      }
    }
  }

  // Check target external node error response schema
  const targetExtNode = allNodes.find(
    (n) => n.id === step.externalNodeId || n.id === step.databaseId,
  );
  if (targetExtNode?.data?.errorResponseSchema) {
    const errSchema = targetExtNode.data.errorResponseSchema;
    if (typeof errSchema === "object" && errSchema !== null) {
      if (Array.isArray(errSchema.fields)) {
        errSchema.fields.forEach((f) => {
          if (isSchemaField(f)) {
            const fieldType = typeof f.type === "string" ? f.type : "string";
            if (!stepPaths.some((p) => p.path === `error.${f.name}`)) {
              stepPaths.push({ path: `error.${f.name}`, type: fieldType });
            }
          }
        });
      } else {
        const nestedErr = extractNestedPaths(errSchema);
        nestedErr.forEach((item) => {
          if (item.path && !stepPaths.some((p) => p.path === `error.${item.path}`)) {
            stepPaths.push({ path: `error.${item.path}`, type: item.type });
          }
        });
      }
    }
  }

  if (targetEp?.errorResponseBody) {
    if (Array.isArray(targetEp.errorResponseBody.fields)) {
      targetEp.errorResponseBody.fields.forEach((f) => {
        if (f.name && !stepPaths.some((p) => p.path === `error.${f.name}`)) {
          stepPaths.push({ path: `error.${f.name}`, type: f.type || "string" });
        }
      });
    }
    if (targetEp.errorResponseBody.rawJson) {
      const { parsed, error } = parseRawJsonSafe(targetEp.errorResponseBody.rawJson);
      if (!error && parsed !== null) {
        const nested = extractNestedPaths(parsed);
        nested.forEach((item) => {
          if (item.path && !stepPaths.some((p) => p.path === `error.${item.path}`)) {
            stepPaths.push({ path: `error.${item.path}`, type: item.type });
          }
        });
      }
    }
  }

  // Add standard error, success, and status paths
  if (!stepPaths.some((p) => p.path.startsWith("error"))) {
    stepPaths.push({ path: "error.message", type: "string" });
    stepPaths.push({ path: "error.error", type: "string" });
    stepPaths.push({ path: "error.statusCode", type: "number" });
  }
  if (!stepPaths.some((p) => p.path === "success")) {
    stepPaths.push({ path: "success", type: "boolean" });
  }
  if (!stepPaths.some((p) => p.path === "status")) {
    stepPaths.push({ path: "status", type: "number" });
  }
}
