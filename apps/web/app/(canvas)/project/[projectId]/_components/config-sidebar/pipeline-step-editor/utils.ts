import {
  Endpoint,
  TransformerHelperNodeData,
  JSONValue,
  JSONObject,
  BackendNode,
  BackendEdge,
} from "@workspace/canvas/types";

import { toVarName, parseSchemaJson } from "@/lib/compiler/utils";
import {
  Shuffle,
  Database,
  Zap,
  Radio,
  Cloud,
  Terminal,
  Send,
} from "lucide-react";
import {
  StepType,
  PipelineStepDraft,
  AvailablePath,
  AvailableSource,
  AvailableTransformer,
} from "./types";
import React from "react";

// ---------------------------------------------------------------------------
// Constants & Metadata
// ---------------------------------------------------------------------------

export const STEP_TYPE_META: Record<
  StepType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  transform: {
    label: "Transform",
    icon: React.createElement(Shuffle, { size: 13 }),
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  db_operation: {
    label: "DB Operation",
    icon: React.createElement(Database, { size: 13 }),
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  redis_operation: {
    label: "Redis",
    icon: React.createElement(Zap, { size: 13 }),
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  kafka_publish: {
    label: "Kafka Publish",
    icon: React.createElement(Radio, { size: 13 }),
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  service_call: {
    label: "Service Call",
    icon: React.createElement(Cloud, { size: 13 }),
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  custom_code: {
    label: "Custom Code",
    icon: React.createElement(Terminal, { size: 13 }),
    color: "text-green-400 bg-green-500/10 border-green-500/20",
  },
  return_response: {
    label: "Return Response",
    icon: React.createElement(Send, { size: 13 }),
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
};

export const ADDABLE_STEP_TYPES: readonly StepType[] = [
  "transform",
  "db_operation",
  "redis_operation",
  "kafka_publish",
  "service_call",
  "custom_code",
];

export const TS_TYPES: readonly string[] = [
  "string",
  "number",
  "boolean",
  "string[]",
  "number[]",
  "Record<string, string>",
  "Date",
];

export interface HttpStatusOption {
  code: number;
  label: string;
}

export const HTTP_STATUS_OPTIONS: readonly HttpStatusOption[] = [
  { code: 200, label: "200 OK" },
  { code: 201, label: "201 Created" },
  { code: 204, label: "204 No Content" },
  { code: 400, label: "400 Bad Request" },
  { code: 401, label: "401 Unauthorized" },
  { code: 403, label: "403 Forbidden" },
  { code: 404, label: "404 Not Found" },
  { code: 500, label: "500 Internal Error" },
];

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Path Introspection Helpers
// ---------------------------------------------------------------------------

export function extractPathsFromObject(
  obj: JSONValue | JSONObject | undefined | null,
  prefix = "",
  depth = 0,
): AvailablePath[] {
  if (depth > 6 || obj === null || obj === undefined) return [];
  const results: AvailablePath[] = [];

  if (Array.isArray(obj)) {
    if (prefix) {
      results.push({ path: prefix, type: "array" });
    }
    if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
      results.push(
        ...extractPathsFromObject(
          obj[0],
          prefix ? `${prefix}[0]` : "[0]",
          depth + 1,
        ),
      );
    }
    return results;
  }

  if (typeof obj === "object") {
    if (prefix) {
      results.push({ path: prefix, type: "object" });
    }
    const entries = Object.entries(obj);
    for (const [key, val] of entries) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const valType = Array.isArray(val) ? "array" : typeof val;
      if (val !== null && typeof val === "object") {
        results.push(
          ...extractPathsFromObject(val, fullPath, depth + 1),
        );
      } else {
        results.push({ path: fullPath, type: valType });
      }
    }
  }
  return results;
}

export function getAvailableSources(
  endpoint?: Endpoint,
  priorSteps: PipelineStepDraft[] = [],
  allNodes: BackendNode[] = [],
): AvailableSource[] {
  const sources: AvailableSource[] = [];

  // 1. Request Body
  const bodyPaths: AvailablePath[] = [];
  if (endpoint?.requestBody) {
    if (Array.isArray(endpoint.requestBody.fields) && endpoint.requestBody.fields.length > 0) {
      endpoint.requestBody.fields.forEach((f) => {
        if (f.name) {
          bodyPaths.push({ path: f.name, type: f.type, description: f.description });
        }
      });
    }
    if (endpoint.requestBody.rawJson) {
      const parsed = parseSchemaJson(endpoint.requestBody.rawJson);
      if (parsed && typeof parsed === "object") {
        const jsonPaths = extractPathsFromObject(parsed);
        jsonPaths.forEach((jp) => {
          if (!bodyPaths.some((bp) => bp.path === jp.path)) {
            bodyPaths.push(jp);
          }
        });
      }
    }
  }
  sources.push({
    id: "req_body",
    label: "Request Body (body)",
    kind: "req_body",
    rootVariableName: "body",
    paths: bodyPaths,
  });

  // 2. Path Params
  const pathParams: AvailablePath[] = [];
  if (Array.isArray(endpoint?.pathParams)) {
    endpoint.pathParams.forEach((p) => {
      if (p.name) pathParams.push({ path: p.name, type: p.type, description: p.description });
    });
  }
  sources.push({
    id: "req_params",
    label: "Path Params (req.params)",
    kind: "req_params",
    rootVariableName: "req.params",
    paths: pathParams,
  });

  // 3. Query Params
  const queryParams: AvailablePath[] = [];
  if (Array.isArray(endpoint?.queryParams)) {
    endpoint.queryParams.forEach((p) => {
      if (p.name) queryParams.push({ path: p.name, type: p.type, description: p.description });
    });
  }
  sources.push({
    id: "req_query",
    label: "Query Params (req.query)",
    kind: "req_query",
    rootVariableName: "req.query",
    paths: queryParams,
  });

  // 4. Headers
  const headerPaths: AvailablePath[] = [];
  if (Array.isArray(endpoint?.headers)) {
    endpoint.headers.forEach((h) => {
      if (h.name) headerPaths.push({ path: h.name, type: h.type, description: h.description });
    });
  }
  sources.push({
    id: "req_headers",
    label: "Request Headers",
    kind: "req_headers",
    rootVariableName: "req.headers",
    paths: headerPaths,
  });

  // 5. Prior Steps (Variable-centric output paths)
  priorSteps.forEach((s, idx) => {
    const varName = s.outputVariable || s.name || `step${idx + 1}Result`;
    const stepPaths: AvailablePath[] = [];

    if (Array.isArray(s.outputSchema) && s.outputSchema.length > 0) {
      s.outputSchema.forEach((os) => {
        if (os.name) stepPaths.push({ path: os.name, type: os.type });
      });
    }

    if (s.tableNodeId) {
      const tableNode = allNodes.find((n) => n.id === s.tableNodeId);
      if (tableNode?.data?.columns) {
        tableNode.data.columns.forEach((col) => {
          if (col.name && !stepPaths.some((p) => p.path === col.name)) {
            stepPaths.push({ path: col.name, type: col.type });
          }
        });
      }
    }

    sources.push({
      id: `step:${s.id}`,
      label: `Step ${idx + 1}: ${varName} (const ${varName})`,
      kind: "step_output",
      stepId: s.id,
      variableName: varName,
      rootVariableName: varName,
      paths: stepPaths,
    });
  });

  // 6. Literal Value
  sources.push({
    id: "literal",
    label: "Literal Value",
    kind: "literal",
    rootVariableName: "literal",
    paths: [],
  });

  return sources;
}

/**
 * Gathers all transformer helpers and standalone transformer nodes in the project.
 */
export function getAvailableTransformers(
  allNodes: BackendNode[],
  serviceNodeId?: string,
  allEdges: BackendEdge[] = [],
): AvailableTransformer[] {
  const transformers: AvailableTransformer[] = [];
  const seenNames = new Set<string>();

  // 1. Service Helpers from the current service
  const currentService = allNodes.find((n) => n.id === serviceNodeId);
  const currentHelpers = currentService?.data?.transformerHelpers;
  if (Array.isArray(currentHelpers)) {
    currentHelpers.forEach((h: TransformerHelperNodeData) => {
      if (!h.name) return;
      const isLocal = h.scope !== "global";
      const importPath = isLocal ? `./transformers/${h.name}` : "@workspace/transformers";
      transformers.push({
        id: h.id || `helper-${h.name}`,
        name: h.name,
        description: h.description,
        scope: h.scope === "global" ? "global" : "local",
        targetServiceId: serviceNodeId,
        targetEndpointId: h.targetEndpointId,
        sourceType: "service_helper",
        importPath,
        inputSchema: h.inputSchema || [],
        returnSchema: h.returnSchema || [],
        logicMode: h.logicMode,
        code: h.code,
        prompt: h.prompt,
        isAsync: h.isAsync,
      });
      seenNames.add(h.name);
    });
  }

  // 2. Global helpers from other services
  allNodes
    .filter((n) => n.type === "service" && n.id !== serviceNodeId)
    .forEach((svc) => {
      const otherHelpers = svc.data?.transformerHelpers;
      if (Array.isArray(otherHelpers)) {
        otherHelpers.forEach((h: TransformerHelperNodeData) => {
          if (h.name && h.scope === "global" && !seenNames.has(h.name)) {
            transformers.push({
              id: h.id || `helper-${h.name}`,
              name: h.name,
              description: h.description,
              scope: "global",
              targetServiceId: svc.id,
              targetEndpointId: h.targetEndpointId,
              sourceType: "service_helper",
              importPath: "@workspace/transformers",
              inputSchema: h.inputSchema || [],
              returnSchema: h.returnSchema || [],
              logicMode: h.logicMode,
              code: h.code,
              prompt: h.prompt,
              isAsync: h.isAsync,
            });
            seenNames.add(h.name);
          }
        });
      }
    });

  // 3. Standalone Transformer Nodes from Canvas
  allNodes
    .filter((n) => n.type === "transformer")
    .forEach((tNode) => {
      const nodeData = tNode.data;
      const rawName = nodeData?.functionName || nodeData?.label || "transformData";
      const fnName = toVarName(rawName);
      if (!fnName || seenNames.has(fnName)) return;

      let targetServiceId = nodeData?.targetServiceId;
      if (!targetServiceId) {
        const edge = allEdges.find(
          (e) => e.source === tNode.id || e.target === tNode.id,
        );
        if (edge) {
          const otherId = edge.source === tNode.id ? edge.target : edge.source;
          const other = allNodes.find(
            (n) => n.id === otherId && n.type === "service",
          );
          if (other) targetServiceId = other.id;
        }
      }

      const scope = nodeData?.scope === "local" ? "local" : "global";
      const isLocalToCurrent =
        scope === "local" &&
        (!targetServiceId || targetServiceId === serviceNodeId);
      const importPath = isLocalToCurrent
        ? `./transformers/${fnName}`
        : "@workspace/transformers";

      transformers.push({
        id: tNode.id,
        name: fnName,
        description: nodeData?.description,
        scope,
        targetServiceId,
        targetEndpointId: nodeData?.targetEndpointId,
        sourceType: "canvas_node",
        nodeId: tNode.id,
        importPath,
        inputSchema: nodeData?.inputSchema || [],
        returnSchema: nodeData?.returnSchema || [],
        logicMode: nodeData?.logicMode,
        code: nodeData?.code,
        prompt: nodeData?.prompt,
        isAsync: nodeData?.isAsync,
      });
      seenNames.add(fnName);
    });


  return transformers;
}
