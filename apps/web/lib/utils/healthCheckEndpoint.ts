import type {
  Endpoint,
  PipelineStep,
  PipelineStepInputBinding,
} from "@workspace/canvas/types";
import type { EndpointWithNode } from "@/lib/stores/backendCanvas/types";

/**
 * Checks if an endpoint represents a service health check endpoint.
 */
export function isHealthEndpoint(ep?: Partial<Endpoint> | null): boolean {
  if (!ep) return false;
  const method = (ep.type || "GET").toLowerCase();
  const name = (ep.name || "").trim();
  const summary = (ep.summary || "").trim().toLowerCase();
  const businessLogic = (ep.businessLogic || "").trim().toLowerCase();

  const isHealthName =
    name === "/health" ||
    name === "health" ||
    name.endsWith("/health") ||
    (name === "/" && (summary.includes("health") || businessLogic.includes("health")));

  const isHealthSummary =
    summary === "health check" ||
    summary.includes("health") ||
    businessLogic.includes("health of the server") ||
    businessLogic.includes("health check");

  return method === "get" && (isHealthName || isHealthSummary);
}

/**
 * Returns the 4 default input bindings for the health check return response step:
 * {
 *   "status": "UP",
 *   "service": "<service name>",
 *   "port": "8080",
 *   "timestamp": "${new Date().toISOString()}"
 * }
 */
export function getHealthCheckResponseBindings(
  serviceName: string = "service",
  port: string = "8080",
): PipelineStepInputBinding[] {
  return [
    {
      argName: "status",
      source: { kind: "inline", value: "UP" },
    },
    {
      argName: "service",
      source: { kind: "inline", value: serviceName },
    },
    {
      argName: "port",
      source: { kind: "inline", value: String(port) },
    },
    {
      argName: "timestamp",
      source: { kind: "inline", value: "${new Date().toISOString()}" },
    },
  ];
}

/**
 * Returns the default return_response step for a health check endpoint.
 */
export function getHealthCheckPipelineSteps(
  serviceName: string = "service",
  port: string = "8080",
): PipelineStep[] {
  return [
    {
      id: "return-response-step",
      name: "Return Response",
      type: "return_response",
      enabled: true,
      statusCode: 200,
      inputBindings: getHealthCheckResponseBindings(serviceName, port),
      outputVariable: "",
    },
  ];
}

/**
 * Returns the SchemaModel for the health check endpoint response payload.
 */
export function getHealthCheckResponseBody(
  endpointId: string,
  serviceName: string = "service",
  port: string = "8080",
): NonNullable<Endpoint["responseBody"]> {
  return {
    id: `res_${endpointId}`,
    fields: [
      { id: "f_status", name: "status", type: "string", required: true, key: "status", value: "UP" },
      { id: "f_service", name: "service", type: "string", required: true, key: "service", value: serviceName },
      { id: "f_port", name: "port", type: "string", required: true, key: "port", value: String(port) },
      { id: "f_timestamp", name: "timestamp", type: "string", required: true, key: "timestamp", value: "" },
    ],
  };
}

/**
 * Constructs a fully configured default health check endpoint for a service node.
 */
export function createDefaultHealthEndpoint(
  nodeId: string,
  serviceName: string = "service",
  port: string = "8080",
  id: string = crypto.randomUUID(),
): EndpointWithNode {
  return {
    id,
    nodeId,
    name: "/health",
    type: "GET",
    summary: "Health check",
    businessLogic: "Test the health of the server",
    responseFields: [],
    responseBody: getHealthCheckResponseBody(id, serviceName, port),
    pipelineSteps: getHealthCheckPipelineSteps(serviceName, port),
  };
}
