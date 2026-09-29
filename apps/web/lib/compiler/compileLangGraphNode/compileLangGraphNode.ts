import {
  BackendNode,
  BackendEdge,
  Endpoint,
  SimulationTestCase,
} from "@/types/canvas";
import { CompiledServiceResult } from "@workspace/canvas/types";
import { compileLangGraph } from "../langgraph/typescript/v1";
import { extractLangGraphInput } from "./extractLangGraphInput";
import { resolveRouteEndpoints } from "./resolveRouteEndpoints";

export function compileLangGraphNode(
  node: BackendNode,
  context?: {
    edges?: BackendEdge[];
    nodes?: BackendNode[];
    endpoints?: Endpoint[];
    events?: Array<{ id: string; name?: string; variant?: string }>;
    testCases?: SimulationTestCase[];
    outputMode?: "app" | "package";
    packageName?: string;
  },
): CompiledServiceResult {
  const serviceName = node.data?.label || "LangGraph Service";
  const input = extractLangGraphInput(node);
  input.targetNodeId = node.id;

  if (context?.outputMode) {
    input.outputMode = context.outputMode;
  }
  if (context?.packageName) {
    input.packageName = context.packageName;
  }

  // Resolve connected route callers from the main canvas edge graph
  if (context) {
    const routeEndpoints = resolveRouteEndpoints(
      node.id,
      context.edges ?? [],
      context.nodes ?? [],
      context.endpoints ?? [],
      context.events ?? [],
    );
    input.routeEndpoints = routeEndpoints;
    input.testCases = context.testCases?.filter(
      (testCase) => testCase.targetNodeId === node.id,
    );
  }

  const files = compileLangGraph(input);

  return {
    serviceId: node.id,
    serviceName,
    files,
  };
}
