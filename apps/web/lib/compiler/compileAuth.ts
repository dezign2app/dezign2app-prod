import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import { CompiledServiceResult, Endpoint, AnyMessagingResource } from "@workspace/canvas/types";
import {
  DEFAULT_AUTH_FRAMEWORK,
  DEFAULT_BETTER_AUTH_VERSION,
  AUTH_FRAMEWORK_BETTER_AUTH,
} from "@workspace/canvas";
import { compileBetterAuthV16Service } from "./auth/better-auth/v1.6";

/**
 * Compiles a Canvas Auth Node into code based on the selected framework type (e.g. better_auth) and version (e.g. v1.6)
 */
export function compileAuth(
  node: BackendNode,
  _endpoints: (Endpoint & { nodeId: string })[] = [],
  _events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [],
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  _testCases: SimulationTestCase[] = []
): CompiledServiceResult {
  const framework = node.data?.framework || DEFAULT_AUTH_FRAMEWORK;
  const _version = node.data?.version || DEFAULT_BETTER_AUTH_VERSION;

  switch (framework) {
    case AUTH_FRAMEWORK_BETTER_AUTH:
    case "better_auth":
    default: {
      return compileBetterAuthV16Service(node, allNodes, allEdges);
    }
  }
}

export { compileAuth as compileAuthNodeRunner };
