// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  external/externalFunctionEmitter
// LAYER:   generators
// PURPOSE: Generates a single TypeScript async function file for one external
//          API node. Handles headers, auth, query params, request body, and
//          timeout/abort signal wiring.
//
// EMITS:
//   packages/external-apis/src/<fnName>.ts
// ═══════════════════════════════════════════════════════════════════════════

import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";
import { toPascalCase, toVarName } from "../utils";
import {
  mapExternalTypeToTs,
  isExternalField,
  compileJsonBodyExpression,
} from "./httpBodyCompiler";

/**
 * Generates an async TypeScript function file for a single external API node.
 *
 * The generated function:
 * - Accepts a typed `input` object (from `node.data.inputVariables`)
 * - Builds the URL, headers, and query params at runtime
 * - Handles auth (bearer, apiKey header, apiKey query param, basic)
 * - Uses a configurable timeout with `AbortController`
 * - Returns a typed union `{ success, status, data?, error? }`
 *
 * @param node - The canvas "external" type node.
 * @returns    - A {@link CompiledFile} with `filename: src/<fnName>.ts`
 *               (caller adds the `packages/external-apis/` prefix).
 *
 * @debugTag external-function-emitter
 */
export function generateExternalFunctionFile(node: BackendNode): CompiledFile {
  const rawFnName = node.data?.functionName || node.data?.label || "callExternalApi";
  const fnName = toVarName(rawFnName);
  const Pascal = toPascalCase(fnName);

  const inputTypeName = `${Pascal}Input`;
  const outputTypeName = `${Pascal}Output`;
  const successTypeName = `${Pascal}SuccessOutput`;
  const errorTypeName = `${Pascal}ErrorOutput`;

  const inputVars = node.data?.inputVariables || [];
  const method = (node.data?.method || "POST").toUpperCase();
  const rawUrl = node.data?.url || node.data?.baseUrl || "https://api.example.com";
  const authType = node.data?.authType || "none";
  const apiKey = node.data?.apiKey || "";
  const headers = (node.data?.headers || []).filter(
    (h) => h.enabled !== false && (h.key || h.name),
  );
  const queryParams = (node.data?.queryParams || []).filter(
    (q) => q.enabled !== false && (q.key || q.name),
  );
  const bodyType =
    node.data?.bodyType ||
    (["POST", "PUT", "PATCH"].includes(method) ? "json" : "none");
  const bodyContent = node.data?.bodyContent || "";
  const timeoutSec = Number(node.data?.timeout) || 30;

  // ── Input interface ───────────────────────────────────────────────────────
  const inputFields =
    inputVars.length > 0
      ? inputVars
          .map((v) => {
            const opt = v.required === false ? "?" : "";
            const desc = v.description ? `  /** ${v.description} */\n` : "";
            return `${desc}  ${v.name}${opt}: ${mapExternalTypeToTs(v.type)};`;
          })
          .join("\n") + "\n  [key: string]: string | number | boolean | null;"
      : "  [key: string]: string | number | boolean | null;";

  // ── URL interpolation ─────────────────────────────────────────────────────
  // Replace {{varName}} placeholders in the URL with URI-encoded runtime values
  const tsUrlTemplate = rawUrl.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, k) => `\${encodeURIComponent(String(input["${k}"] ?? ""))}`,
  );

  // ── Query params ──────────────────────────────────────────────────────────
  const hasQueryParams = queryParams.length > 0;
  const queryParamsLines: string[] = [];
  if (hasQueryParams) {
    queryParamsLines.push("  const queryParams = new URLSearchParams();");
    queryParams.forEach((qp) => {
      const k = qp.key || qp.name || "";
      const v = qp.value || qp.defaultValue || "";
      if (/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/.test(v)) {
        const varName = v.replace(/^\{\{\s*|\s*\}\}$/g, "");
        queryParamsLines.push(
          `  if (input["${varName}"] !== undefined) queryParams.set("${k}", String(input["${varName}"]));`,
        );
      } else {
        const interpolatedVal = v.replace(
          /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
          (_, vk) => `\${input["${vk}"] ?? ""}`,
        );
        queryParamsLines.push(`  queryParams.set("${k}", \`${interpolatedVal}\`);`);
      }
    });
  }

  // ── Headers (case-insensitive deduplication) ──────────────────────────────
  const headerMap = new Map<string, string>();

  if (bodyType === "json" && ["POST", "PUT", "PATCH"].includes(method)) {
    headerMap.set("content-type", '    "Content-Type": "application/json",');
  }

  headers.forEach((h) => {
    const k = (h.key || h.name || "").trim();
    if (!k) return;
    const v = h.value || h.defaultValue || "";
    let line = "";
    if (v.startsWith("process.env.")) {
      line = `    "${k}": ${v} || "",`;
    } else if (/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/.test(v)) {
      const varName = v.replace(/^\{\{\s*|\s*\}\}$/g, "");
      line = `    "${k}": String(input["${varName}"] ?? ""),`;
    } else {
      const interpolatedVal = v.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (_, vk) => `\${input["${vk}"] ?? ""}`,
      );
      line = `    "${k}": \`${interpolatedVal}\`,`;
    }
    headerMap.set(k.toLowerCase(), line);
  });

  const rawAuthHeader = node.data?.authHeader;
  const rawAuthQueryParam = node.data?.authQueryParam;

  // Resolve the API key / token string expression
  const resolveKeyExpr = (keyName: string) => {
    if (apiKey.startsWith("process.env.")) return `${apiKey} || ""`;
    if (apiKey) return `"${apiKey}"`;
    return `(input["${keyName}"] ? String(input["${keyName}"]) : (process.env.${toPascalCase(fnName).toUpperCase()}_API_KEY || ""))`;
  };

  if (authType === "bearer" && !headerMap.has("authorization")) {
    headerMap.set("authorization", `    "Authorization": \`Bearer \${${resolveKeyExpr("token")}}\`,`);
  } else if (authType === "apiKey" && (rawAuthHeader || !rawAuthQueryParam)) {
    const headerName = rawAuthHeader || "X-API-Key";
    if (!headerMap.has(headerName.toLowerCase())) {
      headerMap.set(
        headerName.toLowerCase(),
        `    "${headerName}": \`\${${resolveKeyExpr("apiKey")}}\`,`,
      );
    }
  } else if (authType === "basic" && !headerMap.has("authorization")) {
    const secretVal = node.data?.apiSecret || "";
    headerMap.set(
      "authorization",
      `    "Authorization": "Basic " + Buffer.from(\`${apiKey}:\${${secretVal ? `"${secretVal}"` : '""'}}\`).toString("base64"),`,
    );
  }

  const headersLines: string[] = [
    "  const headers: Record<string, string> = {",
    ...Array.from(headerMap.values()),
    "  };",
  ];

  const authQueryParamLines: string[] = [];
  if (authType === "apiKey" && rawAuthQueryParam) {
    authQueryParamLines.push(
      `  queryParams.set("${rawAuthQueryParam}", \`\${${resolveKeyExpr("apiKey")}}\`);`,
    );
  }

  // ── Request body ──────────────────────────────────────────────────────────
  const bodyLines: string[] = [];
  if (["POST", "PUT", "PATCH"].includes(method) && bodyType !== "none") {
    if (bodyType === "json" || (!bodyType && bodyContent.trim().startsWith("{"))) {
      const jsonExpr = compileJsonBodyExpression(bodyContent, 1);
      bodyLines.push(`  const requestBody = ${jsonExpr};`);
    } else if (bodyContent.trim()) {
      const interpolatedBody = bodyContent.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (_, k) =>
          `\${typeof input["${k}"] === "object" ? JSON.stringify(input["${k}"]) : input["${k}"] ?? ""}`,
      );
      bodyLines.push(`  const requestBody = \`${interpolatedBody}\`;`);
    } else {
      bodyLines.push(`  const requestBody = JSON.stringify(input);`);
    }
  } else {
    bodyLines.push(`  const requestBody: undefined = undefined;`);
  }

  // ── Success / Error response interfaces ──────────────────────────────────
  const descriptionDoc = node.data?.description
    ? `/**\n * ${node.data.description}\n *\n * HTTP ${method} ${rawUrl}\n */\n`
    : `/**\n * External API Calling Tool: ${fnName}\n * HTTP ${method} ${rawUrl}\n */\n`;

  let successFields = "  [key: string]: string | number | boolean | null;";
  if (node.data?.responseSchema && typeof node.data.responseSchema === "object") {
    const s = node.data.responseSchema;
    if (s.fields && Array.isArray(s.fields) && s.fields.length > 0) {
      successFields =
        s.fields
          .filter(isExternalField)
          .map((f) => {
            const opt = f.required === false ? "?" : "";
            const fieldName = typeof f.name === "string" ? f.name : "field";
            const fieldType = typeof f.type === "string" ? f.type : "string";
            return `  ${fieldName}${opt}: ${mapExternalTypeToTs(fieldType)};`;
          })
          .join("\n") + "\n  [key: string]: string | number | boolean | null;";
    }
  }

  let errorFields =
    "  error: string;\n  message?: string;\n  statusCode?: number;\n  [key: string]: string | number | boolean | null;";
  if (node.data?.errorResponseSchema && typeof node.data.errorResponseSchema === "object") {
    const es = node.data.errorResponseSchema;
    if (es.fields && Array.isArray(es.fields) && es.fields.length > 0) {
      errorFields =
        es.fields
          .filter(isExternalField)
          .map((f) => {
            const opt = f.required === false ? "?" : "";
            const fieldName = typeof f.name === "string" ? f.name : "field";
            const fieldType = typeof f.type === "string" ? f.type : "string";
            return `  ${fieldName}${opt}: ${mapExternalTypeToTs(fieldType)};`;
          })
          .join("\n") + "\n  [key: string]: string | number | boolean | null;";
    }
  }

  // ── Assemble generated file content ──────────────────────────────────────
  const content = `${descriptionDoc}export interface ${inputTypeName} {
${inputFields}
}

export interface ${successTypeName} {
${successFields}
}

export interface ${errorTypeName} {
${errorFields}
}

export interface ${outputTypeName} {
  success: boolean;
  status: number;
  data?: ${successTypeName};
  error?: ${errorTypeName};
}

export async function ${fnName}(
  input: ${inputTypeName},
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<${outputTypeName}> {
  let targetUrl = \`${tsUrlTemplate}\`;
${hasQueryParams || authQueryParamLines.length > 0 ? queryParamsLines.join("\n") + "\n" + authQueryParamLines.join("\n") + "\n  const qs = queryParams.toString();\n  if (qs) targetUrl += (targetUrl.includes('?') ? '&' : '?') + qs;\n" : ""}
${headersLines.join("\n")}
${bodyLines.join("\n")}

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? ${timeoutSec * 1000};
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "${method}",
      headers,
      body: requestBody,
      signal: options?.signal || controller.signal,
    });

    if (!response.ok) {
      let errPayload: ${errorTypeName};
      try {
        const rawJson: Record<string, string | number | boolean | null> = await response.json();
        errPayload = {
          error: typeof rawJson.error === "string" ? rawJson.error : (response.statusText || "Request failed"),
          message: typeof rawJson.message === "string" ? rawJson.message : undefined,
          statusCode: response.status,
          ...rawJson,
        };
      } catch {
        const text = await response.text().catch(() => "");
        errPayload = {
          error: response.statusText || "Request failed",
          message: text,
          statusCode: response.status,
        };
      }
      return {
        success: false,
        status: response.status,
        error: errPayload,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    let dataPayload: ${successTypeName};
    if (contentType.includes("application/json")) {
      dataPayload = await response.json();
    } else {
      const text = await response.text();
      dataPayload = { data: text };
    }
    return {
      success: true,
      status: response.status,
      data: dataPayload,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorName = err instanceof Error ? err.name : "FetchError";
    const errorPayload: ${errorTypeName} = {
      error: errorName,
      message,
      statusCode: 500,
    };
    return {
      success: false,
      status: 500,
      error: errorPayload,
    };
  } finally {
    clearTimeout(timer);
  }
}
`;

  return {
    filename: `src/${fnName}.ts`,
    language: "typescript",
    content,
  };
}
