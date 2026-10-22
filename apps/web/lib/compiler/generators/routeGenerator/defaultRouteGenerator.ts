import { CompiledFile, ReusableFunction } from "@workspace/canvas/types";

export function generateDefaultRoute(
  serviceName: string,
  _dbFunctions: ReusableFunction[] = [],
  requiresAuth: boolean = false,
): { files: CompiledFile[]; routeImports: string[]; routeRegistrations: string[] } {
  const healthRouteCode = `import { Request, Response } from "express";
import { createLogger } from "@workspace/logger";
${requiresAuth ? 'import type { AuthUser } from "@workspace/types";\n' : ""}
const logger = createLogger("${serviceName}:HealthRoute");

${
  requiresAuth
    ? `export type HealthRequest = Request & {
  user?: AuthUser;
};`
    : `export type HealthRequest = Request;`
}

export type HealthResponseContext =
  | Response
  | {
      status: (code: number) => {
        json: (data: {
          status: string;
          service: string;
          timestamp: string;${requiresAuth ? "\n          user?: AuthUser | null;" : ""}
        }) => void;
      };
      json: (data: {
        status: string;
        service: string;
        timestamp: string;${requiresAuth ? "\n        user?: AuthUser | null;" : ""}
      }) => void;
      setHeader?: (name: string, value: string | number | readonly string[]) => void | Response;
      header?: (name: string, value?: string | number | readonly string[]) => void | Response;
    };

export async function healthHandler(${requiresAuth ? "req: HealthRequest" : "_req: HealthRequest"}, res: HealthResponseContext) {
  logger.info("Executing health check handler");
  return res.status(200).json({
    status: "ok",
    service: "${serviceName}",
    timestamp: new Date().toISOString(),${requiresAuth ? "\n    user: req.user || null," : ""}
  });
}

export const defaultHandler = healthHandler;
`;

  return {
    files: [
      {
        filename: "src/routes/healthRoute.ts",
        language: "typescript",
        content: healthRouteCode,
      },
    ],
    routeImports: [`import { healthHandler } from "./healthRoute";`],
    routeRegistrations: [
      requiresAuth
        ? `router.get("/health", requireAuth(), healthHandler);`
        : `router.get("/health", healthHandler);`,
    ],
  };
}
