import { useMemo } from "react";
import { BackendNode, Parameter, Schema } from "@/types/canvas";
import { Endpoint, parseRouteWithQueryParams } from "@workspace/canvas";
import { RequestBodyMode } from "../../RequestBodyEditor";

interface UseWebPageApiParametersParams {
  data: BackendNode["data"];
  connectedEndpoint: Endpoint | null;
  isProtected?: boolean;
}

export function useWebPageApiParameters({
  data,
  connectedEndpoint,
  isProtected = false,
}: UseWebPageApiParametersParams) {
  // Resolve live page-level parameters and request body
  const resolvedPageEndpointRequestBody: Schema | undefined = useMemo(() => {
    if (!connectedEndpoint) return undefined;
    if (connectedEndpoint.requestBody) {
      return {
        id: connectedEndpoint.requestBody.id || crypto.randomUUID(),
        fields:
          connectedEndpoint.requestBody.fields && connectedEndpoint.requestBody.fields.length > 0
            ? connectedEndpoint.requestBody.fields
            : connectedEndpoint.params && connectedEndpoint.params.length > 0
            ? [...connectedEndpoint.params]
            : [],
        rawJson: connectedEndpoint.requestBody.rawJson || connectedEndpoint.body || "",
      };
    }
    if (connectedEndpoint.body) {
      return { id: connectedEndpoint.id || crypto.randomUUID(), rawJson: connectedEndpoint.body, fields: [] };
    }
    if (connectedEndpoint.params && connectedEndpoint.params.length > 0) {
      return { id: connectedEndpoint.id || crypto.randomUUID(), fields: [...connectedEndpoint.params] };
    }
    return undefined;
  }, [connectedEndpoint]);

  const hasCustomPageRequestBody = Boolean(
    data.requestBody &&
      ((data.requestBody.fields && data.requestBody.fields.length > 0) ||
        Boolean(data.requestBody.rawJson?.trim())),
  );

  const effectiveRequestBody: Schema = useMemo(() => {
    if (hasCustomPageRequestBody && data.requestBody) {
      return data.requestBody;
    }
    return resolvedPageEndpointRequestBody || data.requestBody || { id: crypto.randomUUID(), fields: [] };
  }, [hasCustomPageRequestBody, data.requestBody, resolvedPageEndpointRequestBody]);

  const isAuthEnabled =
    connectedEndpoint
      ? connectedEndpoint.requireAuth !== undefined
        ? connectedEndpoint.requireAuth
        : data.requireAuth !== undefined
        ? data.requireAuth
        : isProtected
      : data.requireAuth !== undefined
      ? data.requireAuth
      : isProtected;

  const effectiveHeaders: Parameter[] = useMemo(() => {
    const baseHeaders =
      data.headers && data.headers.length > 0
        ? [...data.headers]
        : connectedEndpoint?.headers
        ? [...connectedEndpoint.headers]
        : [];

    return baseHeaders.filter(
      (h: Parameter) =>
        h.name?.toLowerCase() !== "authorization" &&
        h.id !== "auth-bearer-header" &&
        !h.id?.startsWith("auth-"),
    );
  }, [data.headers, connectedEndpoint?.headers]);

  const effectivePathParams: Parameter[] = useMemo(() => {
    const rawLabel = typeof data.label === "string" ? data.label : "";
    const parsed = parseRouteWithQueryParams(rawLabel);
    const labelPathParams = parsed.extractedPathParams || [];

    const existingParams =
      data.pathParams && data.pathParams.length > 0
        ? [...data.pathParams]
        : connectedEndpoint?.pathParams
        ? [...connectedEndpoint.pathParams]
        : [];

    const merged = [...existingParams];
    labelPathParams.forEach((lp) => {
      if (!merged.some((p) => p.name.toLowerCase() === lp.name.toLowerCase())) {
        merged.push(lp);
      }
    });

    return merged;
  }, [data.label, data.pathParams, connectedEndpoint?.pathParams]);

  const effectiveQueryParams: Parameter[] = useMemo(() => {
    const rawLabel = typeof data.label === "string" ? data.label : "";
    const parsed = parseRouteWithQueryParams(rawLabel);
    const labelQueryParams = parsed.extractedQueryParams || [];

    const existingParams =
      data.queryParams && data.queryParams.length > 0
        ? [...data.queryParams]
        : connectedEndpoint?.queryParams
        ? [...connectedEndpoint.queryParams]
        : [];

    const merged = [...existingParams];
    labelQueryParams.forEach((lq) => {
      if (!merged.some((q) => q.name.toLowerCase() === lq.name.toLowerCase())) {
        merged.push(lq);
      }
    });

    return merged;
  }, [data.label, data.queryParams, connectedEndpoint?.queryParams]);

  const effectiveRequestBodyMode: RequestBodyMode =
    data.requestBodyMode ??
    connectedEndpoint?.requestBodyMode ??
    (effectiveRequestBody.rawJson ? "raw_json" : "field_builder");

  return {
    effectiveHeaders,
    effectivePathParams,
    effectiveQueryParams,
    effectiveRequestBody,
    effectiveRequestBodyMode,
    isAuthEnabled,
  };
}
