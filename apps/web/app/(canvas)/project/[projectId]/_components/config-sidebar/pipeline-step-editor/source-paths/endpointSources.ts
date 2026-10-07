import {
  Endpoint,
  BackendNode,
  AnyMessagingResource,
} from "@workspace/canvas/types";
import { parseSchemaJson } from "@/lib/compiler/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { cleanEnvVarName } from "@/lib/utils/localEnvSync";
import { AvailablePath, AvailableSource } from "../types";
import { extractPathsFromObject } from "./pathUtils";

/**
 * Creates an AvailableSource representation for environment variables (.env)
 * strictly displaying the envVars configured on this node.
 */
export function createEnvExtraSource(
  allNodes: BackendNode[] = [],
  serviceNodeId?: string,
): AvailableSource {
  const envPaths: AvailablePath[] = [];
  const seenEnv = new Set<string>();

  const nodesToScan =
    allNodes && allNodes.length > 0
      ? allNodes
      : useBackendCanvasStore.getState().nodes || [];

  const addEnvVar = (name?: string, desc?: string): void => {
    if (!name || typeof name !== "string") return;
    const clean = cleanEnvVarName(name);
    if (!clean || seenEnv.has(clean)) return;
    seenEnv.add(clean);
    envPaths.push({
      path: clean,
      type: "string",
      description: desc || "Environment variable (.env)",
    });
  };

  // Resolve target node (matching EnvVarCombobox logic)
  const targetNode = serviceNodeId
    ? nodesToScan.find((n) => n.id === serviceNodeId) ||
      nodesToScan.find((n) => n.data?.buckets?.some((b: { id?: string }) => b?.id === serviceNodeId))
    : nodesToScan.find((n) => n.type === "service");

  const configuredNodeVars = targetNode?.data?.envVars;

  if (Array.isArray(configuredNodeVars) && configuredNodeVars.length > 0) {
    configuredNodeVars.forEach((v: { id?: string; name?: string; description?: string }) => {
      if (v?.name && v.name.trim()) {
        addEnvVar(v.name, v.description);
      }
    });
  } else if (!serviceNodeId) {
    nodesToScan.forEach((n) => {
      const vars = n.data?.envVars;
      if (Array.isArray(vars)) {
        vars.forEach((v: { name?: string; description?: string }) => {
          if (v?.name && v.name.trim()) {
            addEnvVar(v.name, v.description);
          }
        });
      }
    });
  }

  return {
    id: "env",
    label: "Environment (.env)",
    kind: "env",
    rootVariableName: "process.env",
    paths: envPaths,
  };
}

/**
 * Collects inbound endpoint / event payload sources (body, params, query, headers, event payload).
 */
export function getEndpointSources(
  endpoint?: Endpoint,
  consumedEvent?: AnyMessagingResource,
): AvailableSource[] {
  const sources: AvailableSource[] = [];

  if (consumedEvent) {
    // 1. Event Payload
    const eventPayloadPaths: AvailablePath[] = [];
    if (consumedEvent.payloadSchema) {
      if (
        Array.isArray(consumedEvent.payloadSchema.fields) &&
        consumedEvent.payloadSchema.fields.length > 0
      ) {
        consumedEvent.payloadSchema.fields.forEach((f) => {
          if (f.name) {
            eventPayloadPaths.push({
              path: f.name,
              type: f.type,
              description: f.description,
            });
          }
        });
      }
      if (consumedEvent.payloadSchema.rawJson) {
        const parsed = parseSchemaJson(consumedEvent.payloadSchema.rawJson);
        if (parsed && typeof parsed === "object") {
          const jsonPaths = extractPathsFromObject(parsed);
          jsonPaths.forEach((jp) => {
            if (!eventPayloadPaths.some((bp) => bp.path === jp.path)) {
              eventPayloadPaths.push(jp);
            }
          });
        }
      }
    }
    sources.push({
      id: "event_payload",
      label: "Event Payload (payload)",
      kind: "req_body",
      rootVariableName: "payload",
      paths: eventPayloadPaths,
    });

    // 2. Event Metadata
    sources.push({
      id: "event_metadata",
      label: "Event Metadata (event)",
      kind: "req_headers",
      rootVariableName: "event",
      paths: [
        { path: "key", type: "string", description: "Message partition key" },
        { path: "topic", type: "string", description: "Broker topic name" },
        {
          path: "headers",
          type: "Record<string, string>",
          description: "Message transport headers",
        },
        {
          path: "offset",
          type: "string",
          description: "Stream offset / message ID",
        },
        {
          path: "timestamp",
          type: "number",
          description: "Timestamp of emission",
        },
      ],
    });
  } else {
    // 1. Request Body
    const bodyPaths: AvailablePath[] = [];
    if (endpoint?.requestBody) {
      if (
        Array.isArray(endpoint.requestBody.fields) &&
        endpoint.requestBody.fields.length > 0
      ) {
        endpoint.requestBody.fields.forEach((f) => {
          if (f.name) {
            bodyPaths.push({
              path: f.name,
              type: f.type,
              description: f.description,
            });
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
      rootVariableName: "req.body",
      paths: bodyPaths,
    });

    // 2. Route Path Parameters
    const pathParams: AvailablePath[] = [];
    if (Array.isArray(endpoint?.pathParams)) {
      endpoint.pathParams.forEach((p) => {
        if (p.name && !pathParams.some((pp) => pp.path === p.name)) {
          pathParams.push({
            path: p.name,
            type: p.type,
            description: p.description,
          });
        }
      });
    }
    sources.push({
      id: "req_params",
      label: "Path Parameters (req.params)",
      kind: "req_params",
      rootVariableName: "req.params",
      paths: pathParams,
    });

    // 3. Query Params
    const queryParams: AvailablePath[] = [];
    if (Array.isArray(endpoint?.queryParams)) {
      endpoint.queryParams.forEach((p) => {
        if (p.name) {
          queryParams.push({
            path: p.name,
            type: p.type,
            description: p.description,
          });
        }
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
        if (h.name) {
          headerPaths.push({
            path: h.name,
            type: h.type,
            description: h.description,
          });
        }
      });
    }
    sources.push({
      id: "req_headers",
      label: "Request Headers",
      kind: "req_headers",
      rootVariableName: "req.headers",
      paths: headerPaths,
    });
  }

  return sources;
}
