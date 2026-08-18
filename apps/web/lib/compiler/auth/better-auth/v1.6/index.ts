import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledFile, CompiledServiceResult } from "@workspace/canvas/types";
import { BetterAuthV16NodeData } from "./types";
import {
  generateAuthConfig,
  generateNextJsRouteHandler,
  generateEnvExample,
  generateFastApiMiddleware,
} from "./generators";
import { generateAuthClient } from "../../../generators/auth-providers/better-auth/v1.6/generateAuthClient";

export * from "./types";
export * from "./adapters";
export * from "./providers";
export * from "./generators";

/**
 * Compiles a Canvas Auth Node into integrated monorepo auth artifacts (Better Auth config,
 * client SDK, Next.js route handler, FastAPI middleware, and environment variables).
 */
export function compileBetterAuthV16(
  node: BackendNode,
  _allNodes: BackendNode[] = [],
  _allEdges: BackendEdge[] = []
): CompiledServiceResult & { authNodeId: string } {
  const data = (node.data || {}) as BetterAuthV16NodeData;
  const serviceName = data.label || "Auth";
  const authPort = data.port || "3000";
  const authBaseUrl = data.baseUrl || `http://localhost:${authPort}`;
  const enabledPlugins = data.plugins || ["bearer", "admin", "organization", "jwt"];
  const clientPlugins: string[] = [];
  if (enabledPlugins.includes("admin")) clientPlugins.push("adminClient");
  if (enabledPlugins.includes("organization")) clientPlugins.push("organizationClient");
  if (clientPlugins.length === 0) {
    clientPlugins.push("adminClient", "organizationClient");
  }

  const files: CompiledFile[] = [
    {
      filename: "auth.ts",
      language: "typescript",
      content: generateAuthConfig(data),
    },
    {
      filename: "auth-client.ts",
      language: "typescript",
      content: generateAuthClient({
        baseURL: authBaseUrl,
        plugins: clientPlugins,
      }),
    },
    {
      filename: "route.ts",
      language: "typescript",
      content: generateNextJsRouteHandler(data),
    },
    {
      filename: ".env",
      language: "env",
      content: generateEnvExample(data),
    },
    {
      filename: ".env.example",
      language: "env",
      content: generateEnvExample(data),
    },
    {
      filename: "auth_middleware.py",
      language: "python",
      content: generateFastApiMiddleware(data),
    },
  ];

  return {
    authNodeId: node.id,
    serviceId: node.id,
    serviceName,
    files,
  };
}

export const compileBetterAuthV16Service = compileBetterAuthV16;

