import { Endpoint } from "@workspace/canvas/types";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { toPascalCase, toVarName } from "../../utils";

/**
 * Discriminated union representing the inferred response shape of an endpoint.
 * Used by typesGenerator, endpointHandlerGenerator, and pipelineRenderer to
 * produce fully typed interfaces instead of `any`-based fallbacks.
 */
export type EndpointTypeShape =
  | { kind: "health" }
  | { kind: "entity"; entity: string; cardinality: "one" | "many" }
  | { kind: "schema" }
  | { kind: "void" }
  | { kind: "unknown" };

/**
 * Classifies an endpoint into a TypeShape using a deterministic decision tree.
 *
 * Priority order:
 *  1. health — canonical health-check endpoints
 *  2. schema — explicit responseFields or responseBody schema on canvas
 *  3. entity — linked to a database node (entity type resolved from graph)
 *  4. void   — DELETE or 204 responses
 *  5. unknown — no information available; falls back to Record<string, …>
 *
 * None of these shapes produce `any` in generated code.
 */
export function classifyEndpointShape(
  ep: Endpoint & { nodeId?: string },
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
): EndpointTypeShape {
  const method = (ep.type || "GET").toLowerCase();
  const name = (ep.name || "").trim();
  const summary = (ep.summary || "").trim().toLowerCase();

  // ── 1. Health Check (canonical health-check endpoints without explicit CRUD operations) ─
  const isHealthName =
    name === "/" ||
    name === "/health" ||
    name.endsWith("/health") ||
    name === "health";
  const isHealthSummary =
    summary === "health check" ||
    summary.includes("health") ||
    summary === "test the health of the server";
  const hasCrudOps = ep.crudOperations && Object.keys(ep.crudOperations).length > 0;

  if (method === "get" && (isHealthName || isHealthSummary) && !hasCrudOps) {
    return { kind: "health" };
  }

  // ── 2. DB linkage ────────────────────────────────────────────────────────
  // Check entity linkage — only when explicitly linked to a database/entity node or pipeline step
  const entityName = resolveEntityName(ep, allNodes, allEdges);
  if (entityName) {
    const cardinality = inferCardinality(ep, name);
    return { kind: "entity", entity: entityName, cardinality };
  }

  // ── 3. Explicit Schema or Pipeline (responseFields / responseBody / pipelineSteps / output) ──
  const hasResponseFields =
    Array.isArray(ep.responseFields) && ep.responseFields.length > 0;
  const hasLegacySchema =
    Boolean(ep.responseBody?.rawJson?.trim()) ||
    (Array.isArray(ep.responseBody?.fields) &&
      (ep.responseBody?.fields?.length ?? 0) > 0);
  const hasPipelineSteps =
    Array.isArray(ep.pipelineSteps) && ep.pipelineSteps.length > 0;
  const hasOutput = Boolean(ep.output?.trim());

  if (hasResponseFields || hasLegacySchema || hasPipelineSteps || hasOutput) {
    return { kind: "schema" };
  }

  // ── 4. Void ───────────────────────────────────────────────────────────────
  if (method === "delete") {
    return { kind: "void" };
  }

  // ── 5. Unknown ────────────────────────────────────────────────────────────
  return { kind: "unknown" };
}

/**
 * Resolves the PascalCase entity name from the endpoint's db linkage, or null.
 */
function resolveEntityName(
  ep: Endpoint & { nodeId?: string },
  allNodes: BackendNode[],
  allEdges: BackendEdge[] = [],
): string | null {
  const edgeDbNodeIds: string[] = [];
  const epNodeId = ep.nodeId;

  if (epNodeId && allEdges.length > 0 && allNodes.length > 0) {
    allEdges.forEach((e) => {
      let candidateId: string | null = null;
      if (
        e.source === epNodeId ||
        e.source === ep.id ||
        (e.sourceHandle && (e.sourceHandle.includes(ep.id) || e.sourceHandle.includes(epNodeId)))
      ) {
        candidateId = e.target;
      } else if (
        e.target === epNodeId ||
        e.target === ep.id ||
        (e.targetHandle && (e.targetHandle.includes(ep.id) || e.targetHandle.includes(epNodeId)))
      ) {
        candidateId = e.source;
      }

      if (candidateId) {
        const candidateNode = allNodes.find((n) => n.id === candidateId);
        if (
          candidateNode &&
          (candidateNode.type === "entity" ||
            candidateNode.type === "db_ref" ||
            candidateNode.type === "database")
        ) {
          edgeDbNodeIds.push(candidateId);
        }
      }
    });
  }

  const pipelineDbNodeIds: string[] = [];
  if (Array.isArray(ep.pipelineSteps)) {
    for (const step of ep.pipelineSteps) {
      if (step.type === "db_operation") {
        const stepTarget =
          step.tableNodeId ||
          step.databaseId ||
          (step as { databaseNodeId?: string }).databaseNodeId;
        if (stepTarget) pipelineDbNodeIds.push(stepTarget);
      }
    }
  }

  const targetIds = [
    ...(ep.databaseNodeIds || []),
    ...(ep.databaseNodeId && ep.databaseNodeId !== "none"
      ? [ep.databaseNodeId]
      : []),
    ...Object.keys(ep.crudOperations || {}),
    ...edgeDbNodeIds,
    ...pipelineDbNodeIds,
  ];

  if (targetIds.length === 0) {
    return null;
  }

  const candidateEntityNodes: BackendNode[] = [];
  for (const nodeId of targetIds) {
    const tableNode = allNodes.find((n) => n.id === nodeId);
    if (!tableNode) continue;
    const entityNode =
      tableNode.type === "db_ref" && tableNode.data?.tableRef
        ? allNodes.find((n) => n.id === tableNode.data?.tableRef)
        : tableNode;
    if (entityNode && !candidateEntityNodes.some((c) => c.id === entityNode.id)) {
      candidateEntityNodes.push(entityNode);
    }
  }

  if (candidateEntityNodes.length === 0) {
    return null;
  }

  // Prioritize matching candidate entity against words in endpoint name or path
  const epText = (ep.name || "").toLowerCase().replace(/[^a-z0-9]/g, " ");
  const epWords = epText.split(/\s+/).filter(Boolean);

  for (const entityNode of candidateEntityNodes) {
    if (entityNode.type === "database") {
      const tables = entityNode.data?.tables || [];
      for (const t of tables) {
        const tName = (t.name || t.label || "").toLowerCase();
        if (tName && (epText.includes(tName) || epWords.some((w) => tName.includes(w) || w.includes(tName)))) {
          return toPascalCase(t.name || t.label || "");
        }
      }
    }
    const rawName = entityNode.data?.label || entityNode.data?.tableRef || "";
    const cleanName = rawName.toLowerCase();
    if (cleanName && (epText.includes(cleanName) || epWords.some((w) => cleanName.includes(w) || w.includes(cleanName)))) {
      return toPascalCase(rawName);
    }
  }

  // If no word match, use first candidate from targetIds (if any)
  if (targetIds.length > 0 && candidateEntityNodes.length > 0) {
    const first = candidateEntityNodes[0];
    if (first && first.type === "database") {
      const tables = first.data?.tables || [];
      if (tables.length > 0 && tables[0]?.name) {
        return toPascalCase(tables[0].name);
      }
    }
    const rawName = first?.data?.label || first?.data?.tableRef;
    if (rawName) return toPascalCase(rawName);
  }

  return null;
}

/**
 * Infers whether an endpoint returns a single entity or a collection.
 * - Path ends with /:id or /{id} → "one"
 * - POST → "one" (creates a single record)
 * - Otherwise → "many"
 */
function inferCardinality(
  ep: Endpoint,
  path: string,
): "one" | "many" {
  const method = (ep.type || "GET").toLowerCase();
  const hasIdParam =
    path.includes(":id") ||
    path.includes("{id}") ||
    /:\w+$/.test(path);

  if (method === "post" || method === "put" || method === "patch") {
    return "one";
  }
  if (hasIdParam) {
    return "one";
  }
  return "many";
}

/**
 * Returns the TypeScript type string for the `data` field of a response
 * given a resolved TypeShape. Never returns `any`.
 */
export function responseDataType(shape: EndpointTypeShape): string {
  switch (shape.kind) {
    case "health":
      // Inline literal — no import needed
      return "{ status: string; service: string; timestamp: string }";
    case "entity":
      if (shape.cardinality === "one") {
        return shape.entity;
      }
      return `${shape.entity}[]`;
    case "schema":
      // Caller references the generated ${pascalName}Response type
      return "__SCHEMA__";
    case "void":
      return "undefined";
    case "unknown":
      return "Record<string, string | number | boolean | null>";
  }
}

/**
 * Returns the TypeScript type string for the whole response interface body.
 * Used by typesGenerator.ts when generating the fallback (no responseFields).
 */
export function buildResponseInterfaceBody(
  interfaceName: string,
  shape: EndpointTypeShape,
  entityImports: Set<string>,
): string {
  switch (shape.kind) {
    case "health":
    case "void":
      return (
        `export interface ${interfaceName} {\n` +
        `  message: string;\n` +
        `}\n`
      );
    case "entity": {
      entityImports.add(shape.entity);
      const dataType =
        shape.cardinality === "one"
          ? shape.entity
          : `${shape.entity}[]`;
      return (
        `export interface ${interfaceName} {\n` +
        `  message: string;\n` +
        `  data: ${dataType};\n` +
        (shape.cardinality === "many" ? `  total?: number;\n` : "") +
        `}\n`
      );
    }
    case "schema":
    case "unknown":
      return (
        `export interface ${interfaceName} {\n` +
        `  message?: string;\n` +
        `  data?: Record<string, string | number | boolean | null>;\n` +
        `}\n`
      );
  }
}
