import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledFile, CompiledServiceResult } from "@workspace/canvas/types";
import { BetterAuthV16NodeData } from "./types";
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
 * Compiles a Canvas Auth Node into a complete `CompiledServiceResult` using Better Auth v1.6
 */
export function compileBetterAuthV16Service(
  node: BackendNode,
  _allNodes: BackendNode[] = [],
  _allEdges: BackendEdge[] = []
): CompiledServiceResult {
  const data = (node.data || {}) as BetterAuthV16NodeData;
  const serviceName = data.label || "Auth Server";

  const files: CompiledFile[] = [
    {
      filename: "src/auth.ts",
      language: "typescript",
      content: generateAuthConfig(data),
    },
    {
      filename: "src/index.ts",
      language: "typescript",
      content: generateAuthIndex(data),
    },
    {
      filename: "package.json",
      language: "json",
      content: generateAuthPackageJson(data),
    },
    {
      filename: "tsconfig.json",
      language: "json",
      content: JSON.stringify(
        {
          extends: "@workspace/typescript-config/base.json",
          compilerOptions: {
            outDir: "./dist",
            rootDir: "./src",
            declaration: false,
            declarationMap: false,
          },
          include: ["src/**/*"],
        },
        null,
        2,
      ),
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
      filename: "README.md",
      language: "markdown",
      content: generateReadme(data),
    },
    {
      filename: "auth_middleware.py",
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
