import { CompiledFile, ReusableFunction } from "@workspace/canvas/types";

export function generateDefaultRoute(
  serviceName: string,
  _dbFunctions: ReusableFunction[] = [],
): { files: CompiledFile[]; routeImports: string[]; routeRegistrations: string[] } {
  const healthRouteCode = `import { Request, Response } from "express";
import { createLogger } from "@workspace/logger";

const logger = createLogger("${serviceName}:HealthRoute");

export type HealthRequest =
  | Request
  | {
      headers?: Record<string, string | string[] | undefined>;
    };

export type HealthResponseContext =
  | Response
  | {
      status: (code: number) => { json: (data: { status: string; service: string; timestamp: string }) => void };
      json: (data: { status: string; service: string; timestamp: string }) => void;
    };

export async function healthHandler(_req: HealthRequest, res: HealthResponseContext) {
  logger.info("Executing health check handler");
  return res.status(200).json({
    status: "ok",
    service: "${serviceName}",
    timestamp: new Date().toISOString(),
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
    routeRegistrations: [`router.get("/health", healthHandler);`],
  };
}
