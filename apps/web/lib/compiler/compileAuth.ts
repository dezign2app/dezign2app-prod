import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import { CompiledServiceResult, Endpoint, AnyMessagingResource } from "@workspace/canvas/types";
import {
  DEFAULT_AUTH_FRAMEWORK,
  DEFAULT_BETTER_AUTH_VERSION,
  AUTH_FRAMEWORK_BETTER_AUTH,
} from "@workspace/canvas";
import { compileBetterAuthV17Service } from "./auth/better-auth/v1.7";

/**
 * Compiles a Canvas Auth Node into code based on the selected framework type (e.g. better_auth) and version (e.g. v1.7)
 */
export function compileAuth(
  node: BackendNode,
  endpoints: (Endpoint & { nodeId: string })[] = [],
  events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [],
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  testCases: SimulationTestCase[] = []
): CompiledServiceResult {
  const framework = node.data?.framework || DEFAULT_AUTH_FRAMEWORK;
  const version = node.data?.version || DEFAULT_BETTER_AUTH_VERSION;

  switch (framework) {
    case AUTH_FRAMEWORK_BETTER_AUTH:
    case "better_auth":
    default: {
      // Version-specific routing for Better Auth
      if (version === "v1.7" || version === "1.7" || version.startsWith("v1") || version.startsWith("1")) {
        return compileBetterAuthV17Service(node, allNodes, allEdges);
      }
      return compileBetterAuthV17Service(node, allNodes, allEdges);
    }
  }
}

export { compileAuth as compileAuthNodeRunner };
