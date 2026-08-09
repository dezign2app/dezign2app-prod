import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledFile, CompiledServiceResult } from "@workspace/canvas/types";
import { BetterAuthV17NodeData } from "./types";
import {
  generateAuthConfig,
  generateNextJsRouteHandler,
  generateAuthIndex,
  generateAuthPackageJson,
  generateEnvExample,
  generateReadme,
  generateFastApiMiddleware,
} from "./generators";

export * from "./types";
export * from "./adapters";
export * from "./providers";
export * from "./generators";

/**
 * Compiles a Canvas Auth Node into a complete `CompiledServiceResult` using Better Auth v1.7
 */
export function compileBetterAuthV17Service(
  node: BackendNode,
  _allNodes: BackendNode[] = [],
  _allEdges: BackendEdge[] = []
): CompiledServiceResult {
  const data = (node.data || {}) as BetterAuthV17NodeData;
  const serviceName = data.label || "Auth Server";

  const files: CompiledFile[] = [
    {
      filename: "auth-server/src/auth.ts",
      language: "typescript",
      content: generateAuthConfig(data),
    },
    {
      filename: "auth-server/src/lib/auth.ts",
      language: "typescript",
      content: `export { auth } from "../auth";\n`,
    },
    {
      filename: "auth-server/src/app/api/auth/[...all]/route.ts",
      language: "typescript",
      content: generateNextJsRouteHandler(data),
    },
    {
      filename: "auth-server/src/index.ts",
      language: "typescript",
      content: generateAuthIndex(data),
    },
    {
      filename: "auth-server/package.json",
      language: "json",
      content: generateAuthPackageJson(data),
    },
    {
      filename: "auth-server/.env",
      language: "env",
      content: generateEnvExample(data),
    },
    {
      filename: "auth-server/.env.example",
      language: "env",
      content: generateEnvExample(data),
    },
    {
      filename: "auth-server/README.md",
      language: "markdown",
      content: generateReadme(data),
    },
    {
      filename: "fastapi-service/auth_middleware.py",
      language: "python",
      content: generateFastApiMiddleware(data),
    },
  ];

  return {
    serviceId: node.id,
    serviceName,
    files,
  };
}
