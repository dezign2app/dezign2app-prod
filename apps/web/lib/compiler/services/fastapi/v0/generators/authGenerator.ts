import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledFile, CompiledServiceResult } from "@workspace/canvas/types";
import { generateAuthConfig, AuthNodeData } from "./auth/generateAuthConfig";
import { generateAuthIndex } from "./auth/generateAuthServer";
import { generateFastApiMiddleware } from "./auth/generateFastApiMiddleware";
import {
  generatePackageJson,
  generateEnvExample,
  generateReadme,
  generateNextJsRouteHandler,
} from "./auth/generateAuthManifests";

export type { AuthNodeData };
export {
  generateAuthConfig,
  generateAuthIndex,
  generateFastApiMiddleware,
  generatePackageJson,
  generateEnvExample,
  generateReadme,
  generateNextJsRouteHandler,
};

/**
 * Compiles a Canvas Auth Node into a complete `CompiledServiceResult`
 */
export function compileAuthNode(
  node: BackendNode,
  _allNodes: BackendNode[] = [],
  _allEdges: BackendEdge[] = []
): CompiledServiceResult {
  const data: AuthNodeData = node.data || {};
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
      content: generatePackageJson(data),
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
