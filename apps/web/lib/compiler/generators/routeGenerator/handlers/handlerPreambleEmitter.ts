// ═══════════════════════════════════════════════════════════════
// MODULE: HandlerPreambleEmitter
// LAYER:  generators / routeGenerator / handlers
// EMITS:  Imports, error response types, request & response context types, handler declaration
// ═══════════════════════════════════════════════════════════════

import { ReusableFunction, TargetDbOperation } from "@workspace/canvas/types";
import { Endpoint } from "@workspace/canvas/types";
import { collectPipelineImports } from "../pipelineRenderer";

export interface HandlerPreambleParams {
  serviceName: string;
  routeFileName: string;
  handlerName: string;
  pascalName: string;
  schemaVarPrefix: string;
  method: string;
  path: string;
  summary: string;
  pickedDbOps: TargetDbOperation[];
  dbFunctions: ReusableFunction[];
  redisFunctions: ReusableFunction[];
  kafkaFunctions: ReusableFunction[];
  pickedKafka: ReusableFunction | null;
  codeBlockText: string;
  hasStreamingStep: boolean;
  queryTypeResHasContent: boolean;
  isBodyMethod: boolean;
  bodyTypeResHasContent: boolean;
  pipelineSteps?: Endpoint["pipelineSteps"];
}

export interface HandlerPreambleResult {
  preambleCode: string;
  extraImports: Map<string, Set<string>>;
}

/**
 * Builds the import lines, type aliases, and function header for an Express route handler.
 */
export function emitHandlerPreamble(params: HandlerPreambleParams): HandlerPreambleResult {
  const {
    serviceName,
    routeFileName,
    handlerName,
    pascalName,
    schemaVarPrefix,
    method,
    path,
    summary,
    pickedDbOps,
    dbFunctions,
    redisFunctions,
    kafkaFunctions,
    pickedKafka,
    codeBlockText,
    hasStreamingStep,
    queryTypeResHasContent,
    isBodyMethod,
    bodyTypeResHasContent,
    pipelineSteps,
  } = params;

  // Build the extra import lines (de-duped by importPath)
  const extraImports: Map<string, Set<string>> = new Map();

  pickedDbOps.forEach((op) => {
    let importSet = extraImports.get(op.fn.importPath);
    if (!importSet) {
      importSet = new Set();
      extraImports.set(op.fn.importPath, importSet);
    }
    importSet.add(op.fn.name);
  });

  // Scan user's manual codeBlock for DB and Redis function references
  [...dbFunctions, ...redisFunctions].forEach((f) => {
    if (codeBlockText.includes(f.name)) {
      let importSet = extraImports.get(f.importPath);
      if (!importSet) {
        importSet = new Set();
        extraImports.set(f.importPath, importSet);
      }
      importSet.add(f.name);
    }
  });

  // Scan for Kafka publisher references or configured published events
  if (
    pickedKafka ||
    codeBlockText.includes("publishKafkaEvent") ||
    codeBlockText.includes("KAFKA_TOPICS")
  ) {
    const publishFn =
      pickedKafka ||
      kafkaFunctions.find((f) => f.name === "publishKafkaEvent");
    if (publishFn) {
      if (!extraImports.has(publishFn.importPath)) {
        extraImports.set(publishFn.importPath, new Set());
      }
      extraImports.get(publishFn.importPath)!.add("publishKafkaEvent");
    }
    const topicsConst = kafkaFunctions.find((f) => f.name === "KAFKA_TOPICS");
    if (topicsConst) {
      const importPath = topicsConst.importPath;
      if (!extraImports.has(importPath)) {
        extraImports.set(importPath, new Set());
      }
      extraImports.get(importPath)!.add("KAFKA_TOPICS");
    }
  }

  // Pre-collect pipeline step imports so they land in the file's import block
  if (Array.isArray(pipelineSteps) && pipelineSteps.length > 0) {
    const pipelineImports = collectPipelineImports(pipelineSteps);
    pipelineImports.forEach((names, importPath) => {
      if (!extraImports.has(importPath)) {
        extraImports.set(importPath, new Set());
      }
      names.forEach((n) => extraImports.get(importPath)!.add(n));
    });
  }

  const allExtraImportLines = Array.from(extraImports.entries())
    .map(([pkg, names]) => `import { ${Array.from(names).join(", ")} } from "${pkg}";`)
    .join("\n");

  // Build imports from @workspace/types
  const typeImportsList = [
    `${pascalName}Params`,
    `${pascalName}Query`,
    `${pascalName}Body`,
    `${pascalName}Response`,
  ];
  if (queryTypeResHasContent) {
    typeImportsList.push(`${schemaVarPrefix}QuerySchema`);
  }
  if (bodyTypeResHasContent) {
    typeImportsList.push(`${schemaVarPrefix}BodySchema`);
  }

  let code = `import { Request, Response } from "express";
import { createLogger } from "@workspace/logger";
import {
  ${typeImportsList.join(",\n  ")}
} from "@workspace/types";
${allExtraImportLines ? `${allExtraImportLines}\n` : ""}\nconst logger = createLogger("${serviceName}:${routeFileName}");

type ${pascalName}ErrorResponse = {
  error: string;
  details?: string | { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> } | Record<string, unknown>;
};

export type ${pascalName}Request =
  | Request<${pascalName}Params, ${pascalName}Response | ${pascalName}ErrorResponse, ${pascalName}Body, ${pascalName}Query>
  | {
      headers?: Record<string, string | string[] | undefined>;
      params: ${pascalName}Params;
      query: ${pascalName}Query;
      body?: ${pascalName}Body;
    };

${hasStreamingStep ? `export type ${pascalName}ResponseContext = Response;\n` : `export type ${pascalName}ResponseContext =
  | Response<${pascalName}Response | ${pascalName}ErrorResponse | Record<string, unknown> | unknown[] | string | number | boolean | null | undefined>
  | {
      status: (code: number) => {
        json: (data?: ${pascalName}Response | ${pascalName}ErrorResponse | Record<string, unknown> | unknown[] | string | number | boolean | null) => void | Response;
      };
      json: (data?: ${pascalName}Response | ${pascalName}ErrorResponse | Record<string, unknown> | unknown[] | string | number | boolean | null) => void | Response;
    };
`}

/**
 * ${method.toUpperCase()} ${path}
 * ${summary}
 */
export async function ${handlerName}(
  req: ${pascalName}Request,
  res: ${pascalName}ResponseContext
) {
  try {
    logger.info("Handling ${method.toUpperCase()} ${path}");
    logger.debug("Request details", { params: req.params, query: req.query, body: req.body });

`;

  return {
    preambleCode: code,
    extraImports,
  };
}
