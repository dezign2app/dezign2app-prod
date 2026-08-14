import { UIEventItem, Parameter, Schema } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas";

export interface EventComponentMeta {
  componentName: string;
  eventName: string;
  eventType: string;
  url: string;
  method: string;
  targetRoute?: string;
  targetPageLabel?: string;
  requireAuth?: boolean;
  customHeaders?: Record<string, string>;
  queryParams?: Record<string, string>;
  requestBody?: unknown;
  eventItem?: UIEventItem;
  endpoint?: Endpoint;
}

const METHOD_BADGE_CLASSES: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  PATCH: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  WS: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  SSE: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
};

/**
 * Extracts all path parameter names from a URL path template (e.g. /users/:id or /orgs/{orgId})
 */
function extractPathPlaceholders(pathStr: string): string[] {
  const matches = new Set<string>();
  const colonRegex = /:([a-zA-Z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = colonRegex.exec(pathStr)) !== null) {
    if (m[1]) matches.add(m[1]);
  }
  const braceRegex = /\{([a-zA-Z0-9_]+)\}/g;
  while ((m = braceRegex.exec(pathStr)) !== null) {
    if (m[1]) matches.add(m[1]);
  }
  return Array.from(matches);
}

/**
 * Infers TypeScript types from a JSON string or object
 */
function inferTypesFromJson(jsonStr: string): [string, string][] {
  try {
    const obj = JSON.parse(jsonStr);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return Object.entries(obj).map(([key, val]) => {
        let tsType = "string";
        if (typeof val === "number") tsType = "number";
        else if (typeof val === "boolean") tsType = "boolean";
        else if (Array.isArray(val)) tsType = "unknown[]";
        else if (val !== null && typeof val === "object")
          tsType = "Record<string, unknown>";
        return [key, tsType];
      });
    }
  } catch {}
  return [];
}

export function generateEventComponent(
  eventName: string,
  eventType: string,
  url: string,
  method: string,
  componentName: string,
  targetRoute?: string,
  targetPageLabel?: string,
  requireAuth: boolean = true,
  customHeaders?: Record<string, string>,
  customQueryParams?: Record<string, string>,
  customRequestBody?: unknown,
  eventItem?: UIEventItem,
  endpoint?: Endpoint,
): string {
  // 1. Navigation Event (e.g. navigateToPage)
  if (eventType === "navigateToPage") {
    const route = targetRoute || "/";
    const label = targetPageLabel || route;
    return `"use client";

import React from "react";
import Link from "next/link";

export interface ${componentName}Props {
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
}

export function ${componentName}({ onTrigger }: ${componentName}Props) {
  return (
    <Link
      href="${route}"
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 cursor-pointer"
    >
      <span>${eventName}</span>
      <span className="text-xs opacity-75 font-mono">(&rarr; ${label})</span>
    </Link>
  );
}

export default ${componentName};
`;
  }

  // 2. Resolve Parameters & Request Body Schema from eventItem / endpoint
  const upperMethod = (method || "POST").toUpperCase();
  const methodBadgeClass =
    METHOD_BADGE_CLASSES[upperMethod] ||
    "bg-secondary/40 text-secondary-foreground border-border";

  // Path Parameters
  const configuredPathParams: Parameter[] =
    eventItem?.pathParams?.length
      ? eventItem.pathParams
      : endpoint?.pathParams || [];

  const pathPlaceholders = extractPathPlaceholders(url);
  const mergedPathParams: Parameter[] = [...configuredPathParams];
  pathPlaceholders.forEach((ph) => {
    if (!mergedPathParams.some((p) => p.name === ph)) {
      mergedPathParams.push({
        id: ph,
        name: ph,
        type: "string",
        required: true,
        defaultValue: "1",
      });
    }
  });

  // Query Parameters
  const configuredQueryParams: Parameter[] =
    eventItem?.queryParams?.length
      ? eventItem.queryParams
      : endpoint?.queryParams || endpoint?.params || [];

  const mergedQueryParams: Parameter[] = [...configuredQueryParams];
  if (customQueryParams) {
    Object.entries(customQueryParams).forEach(([k, v]) => {
      if (!mergedQueryParams.some((p) => p.name === k)) {
        mergedQueryParams.push({
          id: k,
          name: k,
          type: "string",
          required: false,
          defaultValue: v,
        });
      }
    });
  }

  // Headers
  const configuredHeaders: Parameter[] =
    eventItem?.headers?.length ? eventItem.headers : endpoint?.headers || [];

  const mergedHeaders: Parameter[] = configuredHeaders.filter(
    (h) =>
      h.name.toLowerCase() !== "content-type" &&
      h.name.toLowerCase() !== "authorization",
  );
  if (customHeaders) {
    Object.entries(customHeaders).forEach(([k, v]) => {
      if (
        k.toLowerCase() !== "content-type" &&
        k.toLowerCase() !== "authorization" &&
        !mergedHeaders.some((h) => h.name === k)
      ) {
        mergedHeaders.push({
          id: k,
          name: k,
          type: "string",
          required: false,
          defaultValue: v,
        });
      }
    });
  }

  // Request Body
  const isBodyAllowedMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(
    upperMethod,
  );
  const rawRequestBodySchema: Schema | undefined =
    eventItem?.requestBody || endpoint?.requestBody;
  const requestBodyMode =
    eventItem?.requestBodyMode ??
    endpoint?.requestBodyMode ??
    (rawRequestBodySchema?.rawJson ? "raw_json" : "field_builder");

  const bodyFields: Parameter[] =
    isBodyAllowedMethod && requestBodyMode === "field_builder"
      ? rawRequestBodySchema?.fields || []
      : [];

  let rawJsonTemplate = "";
  let inferredJsonFields: [string, string][] = [];
  if (isBodyAllowedMethod) {
    if (requestBodyMode === "raw_json" && rawRequestBodySchema?.rawJson) {
      rawJsonTemplate = rawRequestBodySchema.rawJson.trim();
      inferredJsonFields = inferTypesFromJson(rawJsonTemplate);
    } else if (bodyFields.length === 0 && customRequestBody !== undefined) {
      try {
        rawJsonTemplate = JSON.stringify(customRequestBody, null, 2);
        inferredJsonFields = inferTypesFromJson(rawJsonTemplate);
      } catch {}
    }
  }

  const hasPathParams = mergedPathParams.length > 0;
  const hasQueryParams = mergedQueryParams.length > 0;
  const hasHeaders = mergedHeaders.length > 0;
  const hasBodyFields = bodyFields.length > 0;
  const hasRawJson = Boolean(rawJsonTemplate);
  const hasAnyInputs =
    hasPathParams || hasQueryParams || hasHeaders || hasBodyFields || hasRawJson;

  // 3. Generate TypeScript Interfaces
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
  onTrigger: (
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

  // Default state initialization literals
  const pathParamsDefault = JSON.stringify(
    Object.fromEntries(
      mergedPathParams.map((p) => [p.name, p.defaultValue || "1"]),
    ),
    null,
    2,
  );

  const queryParamsDefault = JSON.stringify(
    Object.fromEntries(
      mergedQueryParams.map((q) => [q.name, q.defaultValue || ""]),
    ),
    null,
    2,
  );

  const headersDefault = JSON.stringify(
    Object.fromEntries(
      mergedHeaders.map((h) => [h.name, h.defaultValue || ""]),
    ),
    null,
    2,
  );

  const bodyFieldsDefault = JSON.stringify(
    Object.fromEntries(
      bodyFields.map((f) => [
        f.name,
        f.defaultValue !== undefined
          ? f.defaultValue
          : f.type === "number"
          ? 0
          : f.type === "boolean"
          ? false
          : "",
      ]),
    ),
    null,
    2,
  );

  const defaultRawJsonString = JSON.stringify(
    rawJsonTemplate || "{\n  \n}",
  );

  // If no inputs exist, render a clean compact card
  if (!hasAnyInputs) {
    return `"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";

${typeDefs.join("\n\n")}

export function ${componentName}({ onTrigger }: ${componentName}Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onTrigger(
        "${eventName}",
        "${eventType}",
        "${url}",
        "${upperMethod}",
        ${Boolean(requireAuth)},
        undefined,
        undefined,
        undefined,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full border-border shadow-sm">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            ${eventName}
          </CardTitle>
          <CardDescription className="text-xs font-mono text-muted-foreground flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border ${methodBadgeClass}">
              ${upperMethod}
            </span>
            <span className="truncate max-w-[300px]">${url}</span>
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isSubmitting}
          onClick={handleSend}
          className="cursor-pointer"
        >
          {isSubmitting ? "Sending..." : "Execute ${upperMethod}"}
        </Button>
      </CardHeader>
    </Card>
  );
}

export default ${componentName};
`;
  }

  // 4. Rich Interactive Component with Form Inputs
  return `"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Textarea } from "@workspace/ui/components/textarea";

${typeDefs.join("\n\n")}

export function ${componentName}({ onTrigger }: ${componentName}Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
${hasPathParams ? `  const [pathParams, setPathParams] = useState<Record<string, string>>(${pathParamsDefault});\n` : ""}${hasQueryParams ? `  const [queryParams, setQueryParams] = useState<Record<string, string>>(${queryParamsDefault});\n` : ""}${hasHeaders ? `  const [customHeaders, setCustomHeaders] = useState<Record<string, string>>(${headersDefault});\n` : ""}${hasBodyFields ? `  const [bodyFields, setBodyFields] = useState<Record<string, any>>(${bodyFieldsDefault});\n` : ""}${hasRawJson ? `  const [rawJsonBody, setRawJsonBody] = useState<string>(${defaultRawJsonString});\n  const [jsonError, setJsonError] = useState<string | null>(null);\n` : ""}
  const computeFinalUrl = (): string => {
    let target = "${url}";
${hasPathParams ? `    Object.entries(pathParams).forEach(([key, val]) => {
      if (val !== undefined && val !== "") {
        target = target.replace(new RegExp(":" + key + "\\\\b|\\\\{" + key + "\\\\}", "g"), encodeURIComponent(String(val)));
      }
    });\n` : ""}${hasQueryParams ? `    const search = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, val]) => {
      if (val !== undefined && val !== "") {
        search.append(key, String(val));
      }
    });
    const qs = search.toString();
    if (qs) {
      target += (target.includes("?") ? "&" : "?") + qs;
    }\n` : ""}    return target;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const finalUrl = computeFinalUrl();
      let payloadBody: unknown = undefined;
${hasBodyFields ? `      // Form fields payload
      payloadBody = { ...bodyFields };
` : ""}${hasRawJson ? `      // Raw JSON payload
      if (rawJsonBody.trim()) {
        try {
          payloadBody = JSON.parse(rawJsonBody);
          setJsonError(null);
        } catch (err: any) {
          setJsonError("Invalid JSON: " + err.message);
          setIsSubmitting(false);
          return;
        }
      }
` : ""}
      await onTrigger(
        "${eventName}",
        "${eventType}",
        finalUrl,
        "${upperMethod}",
        ${Boolean(requireAuth)},
        ${hasHeaders ? "Object.keys(customHeaders).length > 0 ? customHeaders : undefined" : "undefined"},
        ${hasQueryParams ? "Object.keys(queryParams).length > 0 ? queryParams : undefined" : "undefined"},
        payloadBody,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeUrlPreview = computeFinalUrl();

  return (
    <Card className="w-full border-border shadow-sm">
      <CardHeader className="p-4 pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
              <span>${eventName}</span>
              <Badge variant="secondary" className="text-[10px] font-mono">
                ${eventType}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs font-mono text-muted-foreground mt-0.5 flex items-center gap-2">
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold border ${methodBadgeClass}">
                ${upperMethod}
              </span>
              <span className="truncate font-mono">${url}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleFormSubmit}>
        <CardContent className="p-4 space-y-4 text-xs">
${hasPathParams ? `          {/* 1. Path Parameters */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Path Parameters
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
${mergedPathParams.map((p) => `              <div key="${p.name}" className="space-y-1">
                <Label className="text-[11px] font-mono text-muted-foreground">
                  :${p.name}${p.required ? ` <span className="text-destructive font-sans">*</span>` : ""}
                </Label>
                <Input
                  className="h-8 text-xs bg-background font-mono"
                  placeholder="${p.description || p.defaultValue || p.name}"
                  value={pathParams["${p.name}"] ?? ""}
                  required={${Boolean(p.required)}}
                  onChange={(e) =>
                    setPathParams((prev) => ({ ...prev, "${p.name}": e.target.value }))
                  }
                />
              </div>`).join("\n")}
            </div>
          </div>
` : ""}${hasQueryParams ? `          {/* 2. Query Parameters */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Query Parameters
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
${mergedQueryParams.map((q) => `              <div key="${q.name}" className="space-y-1">
                <Label className="text-[11px] font-mono text-muted-foreground">
                  ${q.name}${q.required ? ` <span className="text-destructive font-sans">*</span>` : ""}
                </Label>
                <Input
                  type="${q.type === "number" ? "number" : "text"}"
                  className="h-8 text-xs bg-background font-mono"
                  placeholder="${q.description || q.defaultValue || q.name}"
                  value={queryParams["${q.name}"] ?? ""}
                  required={${Boolean(q.required)}}
                  onChange={(e) =>
                    setQueryParams((prev) => ({ ...prev, "${q.name}": e.target.value }))
                  }
                />
              </div>`).join("\n")}
            </div>
          </div>
` : ""}${hasHeaders ? `          {/* 3. Custom Headers */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Headers
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
${mergedHeaders.map((h) => `              <div key="${h.name}" className="space-y-1">
                <Label className="text-[11px] font-mono text-muted-foreground">
                  ${h.name}
                </Label>
                <Input
                  className="h-8 text-xs bg-background font-mono"
                  placeholder="${h.description || h.defaultValue || h.name}"
                  value={customHeaders["${h.name}"] ?? ""}
                  onChange={(e) =>
                    setCustomHeaders((prev) => ({ ...prev, "${h.name}": e.target.value }))
                  }
                />
              </div>`).join("\n")}
            </div>
          </div>
` : ""}${hasBodyFields ? `          {/* 4. Request Body Fields */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Request Body
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
${bodyFields.map((f) => {
  if (f.type === "boolean") {
    return `              <div key="${f.name}" className="space-y-1">
                <Label className="text-[11px] font-mono text-muted-foreground">
                  ${f.name}${f.required ? ` <span className="text-destructive font-sans">*</span>` : ""}
                </Label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                  value={String(bodyFields["${f.name}"] ?? "false")}
                  onChange={(e) =>
                    setBodyFields((prev) => ({ ...prev, "${f.name}": e.target.value === "true" }))
                  }
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>`;
  }
  if (f.type === "object" || f.type === "array") {
    return `              <div key="${f.name}" className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-mono text-muted-foreground">
                  ${f.name} (${f.type})${f.required ? ` <span className="text-destructive font-sans">*</span>` : ""}
                </Label>
                <Textarea
                  className="min-h-[60px] text-xs font-mono bg-background"
                  placeholder="${f.type === "array" ? "[\"item1\", \"item2\"]" : "{\"key\": \"val\"}"}"
                  value={typeof bodyFields["${f.name}"] === "object" ? JSON.stringify(bodyFields["${f.name}"]) : bodyFields["${f.name}"] ?? ""}
                  onChange={(e) => {
                    const text = e.target.value;
                    try {
                      const parsed = JSON.parse(text);
                      setBodyFields((prev) => ({ ...prev, "${f.name}": parsed }));
                    } catch {
                      setBodyFields((prev) => ({ ...prev, "${f.name}": text }));
                    }
                  }}
                />
              </div>`;
  }
  return `              <div key="${f.name}" className="space-y-1">
                <Label className="text-[11px] font-mono text-muted-foreground">
                  ${f.name}${f.required ? ` <span className="text-destructive font-sans">*</span>` : ""}
                </Label>
                <Input
                  type="${f.type === "number" ? "number" : "text"}"
                  className="h-8 text-xs bg-background font-mono"
                  placeholder="${f.description || f.defaultValue || f.name}"
                  value={bodyFields["${f.name}"] ?? ""}
                  required={${Boolean(f.required)}}
                  onChange={(e) =>
                    setBodyFields((prev) => ({
                      ...prev,
                      "${f.name}": ${f.type === "number" ? `Number(e.target.value)` : `e.target.value`},
                    }))
                  }
                />
              </div>`;
}).join("\n")}
            </div>
          </div>
` : ""}${hasRawJson ? `          {/* 4. Raw JSON Body */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Request Body (JSON)
            </Label>
            <Textarea
              className="min-h-[90px] text-xs font-mono bg-background"
              value={rawJsonBody}
              onChange={(e) => {
                setRawJsonBody(e.target.value);
                if (jsonError) setJsonError(null);
              }}
            />
            {jsonError && (
              <span className="text-[10px] text-destructive font-mono">{jsonError}</span>
            )}
          </div>
` : ""}
        </CardContent>

        <CardFooter className="p-4 pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-secondary/10">
          <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[320px]">
            Target: <span className="text-foreground">{activeUrlPreview}</span>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="cursor-pointer font-semibold shadow"
          >
            {isSubmitting ? "Executing..." : "Trigger ${eventName}"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default ${componentName};
`;
}
