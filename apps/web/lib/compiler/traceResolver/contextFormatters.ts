import { BackendNode } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";

/**
 * Formats configured database columns into a human-readable dataContext string
 */
export function formatDatabaseColumnsContext(
  node: BackendNode,
  allNodes: BackendNode[] = [],
): string {
  let targetNode = node;

  // If this is a Table Ref node, resolve the target Entity node
  if (node.type === "db_ref" && node.data?.tableRef) {
    const refEntity = allNodes.find((n) => n.id === node.data?.tableRef);
    if (refEntity) {
      targetNode = refEntity;
    }
  }

  const columns = targetNode.data?.columns;

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return "Schema Fields: (No columns configured)";
  }

  const fieldDefs = columns
    .filter((col) => col && col.name && col.name.trim() !== "")
    .map((col) => {
      const typeStr = col.type ? `: ${col.type}` : "";
      const flags: string[] = [];
      if (col.isPrimaryKey) flags.push("PK");
      if (col.isForeignKey) flags.push("FK");
      if (col.isNotNull) flags.push("REQUIRED");
      if (col.isUnique) flags.push("UNIQUE");
      const flagsStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
      return `${col.name}${typeStr}${flagsStr}`;
    });

  if (fieldDefs.length === 0) {
    return "Schema Fields: (No columns configured)";
  }

  return `Schema Fields: { ${fieldDefs.join(", ")} }`;
}

/**
 * Formats configured Redis cache schema details into a human-readable dataContext string
 */
export function formatRedisSchemaContext(
  node: BackendNode,
  allNodes: BackendNode[] = [],
): string {
  let targetNode = node;
  if (node.type === "redis-cache" && node.data?.schemaRef) {
    const refSchema = allNodes.find((n) => n.id === node.data?.schemaRef);
    if (refSchema) {
      targetNode = refSchema;
    }
  }

  const ds = targetNode.data?.redisDataStructure || "HASH";
  const keyTemplate = targetNode.data?.keyTemplate || "key:{id}";
  const ttlVal =
    typeof targetNode.data?.ttl === "object"
      ? targetNode.data.ttl.value
      : targetNode.data?.ttl;
  const ttl = ttlVal ? `${ttlVal}s` : "3600s";

  const columns = targetNode.data?.columns;
  if (columns && Array.isArray(columns) && columns.length > 0) {
    const fieldsStr = columns
      .filter((c) => c && c.name)
      .map((c) => `${c.name}: ${c.type || "string"}`)
      .join(", ");
    return `Structure: ${ds.toUpperCase()}, Key: "${keyTemplate}", TTL: ${ttl}, Fields: { ${fieldsStr} }`;
  }

  return `Structure: ${ds.toUpperCase()}, Key: "${keyTemplate}", TTL: ${ttl}`;
}

/**
 * Formats endpoint request payload/query/path params into a human-readable dataContext string
 */
export function formatEndpointPayloadContext(endpoint: Endpoint): string {
  const parts: string[] = [];

  // Headers
  if (Array.isArray(endpoint.headers) && endpoint.headers.length > 0) {
    const headersStr = endpoint.headers
      .filter((h) => h && h.name)
      .map(
        (h) =>
          `${h.name}${h.required === false ? "?" : ""}: ${h.type || "string"}`,
      )
      .join(", ");
    if (headersStr) parts.push(`Headers: { ${headersStr} }`);
  }

  // Path params
  if (Array.isArray(endpoint.pathParams) && endpoint.pathParams.length > 0) {
    const pathStr = endpoint.pathParams
      .filter((p) => p && p.name)
      .map(
        (p) =>
          `${p.name}${p.required === false ? "?" : ""}: ${p.type || "string"}`,
      )
      .join(", ");
    if (pathStr) parts.push(`Path Params: { ${pathStr} }`);
  }

  // Query params
  if (Array.isArray(endpoint.queryParams) && endpoint.queryParams.length > 0) {
    const queryStr = endpoint.queryParams
      .filter((q) => q && q.name)
      .map(
        (q) =>
          `${q.name}${q.required === false ? "?" : ""}: ${q.type || "string"}`,
      )
      .join(", ");
    if (queryStr) parts.push(`Query Params: { ${queryStr} }`);
  }

  // Request body fields or rawJson
  const reqBody = endpoint.requestBody;
  if (reqBody) {
    if (Array.isArray(reqBody.fields) && reqBody.fields.length > 0) {
      const fieldsStr = reqBody.fields
        .filter((f) => f && f.name)
        .map(
          (f) =>
            `${f.name}${f.required === false ? "?" : ""}: ${f.type || "string"}`,
        )
        .join(", ");
      if (fieldsStr) parts.push(`Body: { ${fieldsStr} }`);
    } else if (
      reqBody.rawJson &&
      typeof reqBody.rawJson === "string" &&
      reqBody.rawJson.trim()
    ) {
      parts.push(`Body: ${reqBody.rawJson.replace(/\s+/g, " ").trim()}`);
    }
  }

  // Response body fields or rawJson
  const resBody = endpoint.responseBody;
  if (resBody) {
    if (Array.isArray(resBody.fields) && resBody.fields.length > 0) {
      const resFieldsStr = resBody.fields
        .filter((f) => f && f.name)
        .map((f) => `${f.name}: ${f.type || "string"}`)
        .join(", ");
      if (resFieldsStr) parts.push(`Response: { ${resFieldsStr} }`);
    } else if (
      resBody.rawJson &&
      typeof resBody.rawJson === "string" &&
      resBody.rawJson.trim()
    ) {
      parts.push(`Response: ${resBody.rawJson.replace(/\s+/g, " ").trim()}`);
    }
  }

  // Legacy body string fallback (only if JSON format, not TypeScript code)
  if (parts.length === 0 && endpoint.body && endpoint.body.trim()) {
    const text = endpoint.body.trim();
    if (
      text.startsWith("{") &&
      text.endsWith("}") &&
      !text.includes("return ") &&
      !text.includes("await ") &&
      !text.includes("const ")
    ) {
      parts.push(`Payload: ${text}`);
    }
  }

  if (parts.length > 0) {
    return parts.join(" | ");
  }

  return "Payload: Request params/body (No specific fields defined)";
}
