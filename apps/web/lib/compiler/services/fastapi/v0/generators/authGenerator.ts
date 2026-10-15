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
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = []
): CompiledServiceResult {
  const rawData: AuthNodeData = node.data || {};
  const serviceName = rawData.label || "Auth Server";

  // Resolve connected DB node if any to infer dbEngine / dbAdapter
  const connectedDbEdge = allEdges.find(
    (e) =>
      ((e.target === node.id || e.target === (node as any).nodeId) &&
        allNodes.some((n) => (n.id === e.source || (n as any).nodeId === e.source) && n.type === "database")) ||
      ((e.source === node.id || e.source === (node as any).nodeId) &&
        allNodes.some((n) => (n.id === e.target || (n as any).nodeId === e.target) && n.type === "database"))
  );
  const connectedEdgeDbNode = connectedDbEdge
    ? allNodes.find(
        (n) =>
          (n.id === (connectedDbEdge.target === node.id ? connectedDbEdge.source : connectedDbEdge.target) ||
            (n as any).nodeId === (connectedDbEdge.target === node.id ? connectedDbEdge.source : connectedDbEdge.target)) &&
          n.type === "database"
      )
    : undefined;

  const connectedDbNode =
    allNodes.find((n) => n.id === rawData.databaseId) ||
    connectedEdgeDbNode ||
    allNodes.find((n) => n.type === "database" && n.data?.dbEngine !== "redis");

  const resolvedDbEngine = (
    rawData.dbEngine ||
    connectedDbNode?.data?.dbEngine ||
    ""
  ).toLowerCase();

  const resolvedDbAdapter =
    rawData.dbAdapter ||
    (resolvedDbEngine.includes("postgres") || resolvedDbEngine.includes("pg")
      ? "postgres"
      : resolvedDbEngine.includes("mysql")
      ? "mysql"
      : "sqlite-raw");

  const data: AuthNodeData = {
    ...rawData,
    dbEngine: resolvedDbEngine || rawData.dbEngine,
    dbAdapter: resolvedDbAdapter,
  };

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
