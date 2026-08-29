import { ResolvedEventParameters } from "./types";

export function generateTypeDefinitions(
  componentName: string,
  params: ResolvedEventParameters,
): string[] {
  const {
    mergedPathParams,
    mergedQueryParams,
    mergedHeaders,
    bodyFields,
    inferredJsonFields,
    isBodyAllowedMethod,
    hasPathParams,
    hasQueryParams,
    hasHeaders,
    hasBodyFields,
    hasRawJson,
  } = params;

  const typeDefs: string[] = [];

  // PathParams Interface
  if (hasPathParams) {
    const fieldsTs = mergedPathParams
      .map((p) => {
        const tsType = p.type === "number" ? "number" : "string";
        const opt = p.required ? "" : "?";
        return `  ${p.name}${opt}: ${tsType};`;
      })
      .join("\n");
    typeDefs.push(`export interface ${componentName}PathParams {\n${fieldsTs}\n}`);
  }

  // QueryParams Interface
  if (hasQueryParams) {
    const fieldsTs = mergedQueryParams
      .map((q) => {
        let tsType = "string";
        if (q.type === "number") tsType = "number";
        else if (q.type === "boolean") tsType = "boolean";
        const opt = q.required ? "" : "?";
        return `  ${q.name}${opt}: ${tsType};`;
      })
      .join("\n");
    typeDefs.push(`export interface ${componentName}QueryParams {\n${fieldsTs}\n}`);
  }

  // Headers Interface
  if (hasHeaders) {
    const fieldsTs = mergedHeaders
      .map((h) => {
        const opt = h.required ? "" : "?";
        return `  "${h.name}"${opt}: string;`;
      })
      .join("\n");
    typeDefs.push(`export interface ${componentName}Headers {\n${fieldsTs}\n}`);
  }

  // RequestBody Interface
  if (isBodyAllowedMethod && (hasBodyFields || hasRawJson)) {
    if (hasBodyFields) {
      const fieldsTs = bodyFields
        .map((f) => {
          let tsType = "string";
          if (f.type === "number") tsType = "number";
          else if (f.type === "boolean") tsType = "boolean";
          else if (f.type === "object") tsType = "Record<string, unknown>";
          else if (f.type === "array") tsType = "unknown[]";
          const opt = f.required ? "" : "?";
          return `  ${f.name}${opt}: ${tsType};`;
        })
        .join("\n");
      typeDefs.push(`export interface ${componentName}RequestBody {\n${fieldsTs}\n}`);
    } else if (inferredJsonFields.length > 0) {
      const fieldsTs = inferredJsonFields
        .map(([k, t]) => `  ${k}?: ${t};`)
        .join("\n");
      typeDefs.push(`export interface ${componentName}RequestBody {\n${fieldsTs}\n}`);
    } else {
      typeDefs.push(`export type ${componentName}RequestBody = Record<string, unknown>;`);
    }
  }

  // Combined RequestPayload Interface
  typeDefs.push(`export interface ${componentName}RequestPayload {
${hasPathParams ? `  pathParams?: ${componentName}PathParams;\n` : ""}${hasQueryParams ? `  queryParams?: ${componentName}QueryParams;\n` : ""}${hasHeaders ? `  headers?: ${componentName}Headers;\n` : ""}${isBodyAllowedMethod && (hasBodyFields || hasRawJson) ? `  body?: ${componentName}RequestBody;\n` : ""}}`);

  // Props Interface
  typeDefs.push(`export interface ${componentName}Props {
  onTrigger?: (
    eventName: string,
    eventType: string,
    url: string,
    method: string,
    requireAuth?: boolean,
    customHeaders?: Record<string, string>,
    queryParams?: Record<string, string>,
    requestBody?: unknown,
  ) => void;
}`);

  return typeDefs;
}
