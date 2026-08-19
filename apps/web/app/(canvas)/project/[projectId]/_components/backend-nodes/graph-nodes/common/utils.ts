import { useSimulationStore } from "@/lib/stores/simulationStore";
import { Endpoint, Parameter, JSONValue, JSONObject } from "@/types/canvas";

export const generateId = () => Math.random().toString(36).substring(2, 9);

export function useSimulationNodeState(nodeId: string) {
  const status = useSimulationStore((s) => s.status);
  const activeNodeIds = useSimulationStore((s) => s.activeNodeIds);
  const currentNodeId = useSimulationStore((s) => s.currentNodeId);
  const trace = useSimulationStore((s) => s.trace);
  const activeIndex = useSimulationStore((s) => s.activeIndex);

  const hasRun = status !== "idle";
  const isVisited = activeNodeIds.includes(nodeId);
  const isCurrent = currentNodeId === nodeId;

  const visitedTrace = trace.slice(
    0,
    activeIndex >= 0 ? activeIndex + 1 : trace.length,
  );
  const nodeEntries = visitedTrace.filter((t) => t.nodeId === nodeId);
  const hasFailed =
    nodeEntries.some((t) => t.status === "failed") ||
    (isCurrent && status === "failed");

  return { hasRun, isVisited, isCurrent, hasFailed, overallStatus: status };
}

export function getSimulationNodeBorderClass(
  simulation: ReturnType<typeof useSimulationNodeState>,
  selected: boolean,
  defaultBorder = "border-border",
) {
  if (!simulation.hasRun) {
    return selected ? "border-primary shadow-sm" : defaultBorder;
  }
  if (simulation.hasFailed) {
    return "border-destructive ring-2 ring-destructive ring-offset-2 ring-offset-background shadow-lg shadow-destructive/40 animate-pulse";
  }
  if (simulation.isCurrent) {
    return "border-sky-500 ring-2 ring-sky-500 ring-offset-2 ring-offset-background shadow-lg shadow-sky-500/40 animate-pulse";
  }
  if (simulation.isVisited) {
    return selected
      ? "border-emerald-500 ring-2 ring-emerald-500/50"
      : "border-emerald-500/80 shadow-md shadow-emerald-500/20";
  }
  return selected ? "border-primary opacity-50" : "border-border/40 opacity-40";
}

export function endpointInputParams(endpoint: Endpoint): Parameter[] {
  if (endpoint.params?.length)
    return endpoint.params.map((param) => ({
      ...param,
      value: param.value ?? param.defaultValue ?? "",
    }));
  return [...(endpoint.pathParams ?? []), ...(endpoint.queryParams ?? [])].map(
    (param) => ({
      ...param,
      key: param.name,
      value: param.value ?? param.defaultValue ?? "",
    }),
  );
}

export function endpointBodyTemplate(endpoint: Endpoint): string {
  if (endpoint.body) return endpoint.body;
  if (endpoint.requestBody?.rawJson) return endpoint.requestBody.rawJson;
  return "";
}

export function getInitialBody(endpoint: Endpoint): JSONValue | undefined {
  if (endpoint.requestBody?.fields && endpoint.requestBody.fields.length > 0) {
    const obj: JSONObject = {};
    endpoint.requestBody.fields.forEach((f) => {
      const fieldKey = f.key || f.name;
      if (!fieldKey) return;
      if (f.defaultValue !== undefined && f.defaultValue !== "") {
        try {
          const parsedDefault: JSONValue = JSON.parse(f.defaultValue);
          obj[fieldKey] = parsedDefault;
          return;
        } catch {
          obj[fieldKey] = f.defaultValue;
          return;
        }
      }
      const type = (f.type || "string").toLowerCase();
      const name = fieldKey.toLowerCase();
      if (name.includes("email")) {
        obj[fieldKey] = "alice@example.com";
      } else if (name.includes("price") || name.includes("amount") || name.includes("cost")) {
        obj[fieldKey] = 49.99;
      } else if (name.includes("count") || name.includes("quantity") || name.includes("qty") || name.includes("age")) {
        obj[fieldKey] = 10;
      } else if (name.includes("title") || name.includes("name")) {
        obj[fieldKey] = `Sample ${fieldKey}`;
      } else if (name.includes("description") || name.includes("bio")) {
        obj[fieldKey] = "Sample description for testing";
      } else if (type === "number" || type === "int" || type === "integer" || type === "float") {
        obj[fieldKey] = 42;
      } else if (type === "boolean" || type === "bool") {
        obj[fieldKey] = true;
      } else if (type === "array" || type === "list") {
        obj[fieldKey] = ["item_1", "item_2"];
      } else if (type === "object" || type === "json") {
        obj[fieldKey] = { sampleKey: "sample_value" };
      } else {
        obj[fieldKey] = `Sample ${fieldKey}`;
      }
    });
    return obj;
  }

  const template = endpointBodyTemplate(endpoint);
  if (!template) return undefined;
  try {
    const parsed: JSONValue = JSON.parse(template);
    return parsed;
  } catch {
    return undefined;
  }
}
