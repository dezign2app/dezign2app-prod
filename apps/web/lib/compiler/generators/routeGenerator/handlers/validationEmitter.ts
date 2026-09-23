// ═══════════════════════════════════════════════════════════════
// MODULE: ValidationEmitter
// LAYER:  generators / routeGenerator / handlers
// EMITS:  Request body & query Zod validation blocks inside route handler
// ═══════════════════════════════════════════════════════════════

export interface ValidationEmitterParams {
  schemaVarPrefix: string;
  hasValidatedBody: boolean;
  hasQueryParams: boolean;
  isBodyMethod?: boolean;
}

/**
 * Generates Zod validation code for incoming HTTP request body and query parameters.
 */
export function emitValidationBlocks(params: ValidationEmitterParams): string {
  const { schemaVarPrefix, hasValidatedBody, hasQueryParams, isBodyMethod } = params;
  let code = "";

  if (hasValidatedBody) {
    code += `    // Validate Body Payload\n`;
    code += `    const bodyParsed = ${schemaVarPrefix}BodySchema.safeParse(req.body);\n`;
    code += `    if (!bodyParsed.success) {\n`;
    code += `      logger.warn("Request body validation failed", bodyParsed.error.flatten());\n`;
    code += `      return res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.flatten() });\n`;
    code += `    }\n`;
    code += `    const body = bodyParsed.data;\n\n`;
  } else if (isBodyMethod) {
    code += `    // Guard Body Payload\n`;
    code += `    if (!req.body) {\n`;
    code += `      return res.status(400).json({ error: "Invalid request body", details: "Request body is required" });\n`;
    code += `    }\n`;
    code += `    const body = req.body;\n\n`;
  }

  if (hasQueryParams) {
    code += `    // Validate Query Parameters\n`;
    code += `    const queryParsed = ${schemaVarPrefix}QuerySchema.safeParse(req.query);\n`;
    code += `    if (!queryParsed.success) {\n`;
    code += `      logger.warn("Query parameters validation failed", queryParsed.error.flatten());\n`;
    code += `      return res.status(400).json({ error: "Invalid query parameters", details: queryParsed.error.flatten() });\n`;
    code += `    }\n`;
    code += `    const query = queryParsed.data;\n\n`;
  }

  return code;
}
