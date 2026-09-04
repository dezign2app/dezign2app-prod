import { useMemo } from "react";
import { BackendNode, Parameter, Schema } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas";
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
    data.requireAuth !== undefined ? data.requireAuth : isProtected;

  const effectiveHeaders: Parameter[] = useMemo(() => {
    let baseHeaders =
      data.headers && data.headers.length > 0
        ? [...data.headers]
        : connectedEndpoint?.headers
        ? [...connectedEndpoint.headers]
        : [];

    if (isAuthEnabled) {
      if (
        !baseHeaders.some(
          (h: Parameter) =>
            h.name?.toLowerCase() === "authorization" ||
            h.id === "auth-bearer-header",
        )
      ) {
        baseHeaders = [
          {
            id: "auth-bearer-header",
            name: "Authorization",
            type: "string",
            required: true,
            description: "Bearer <token>",
            defaultValue: "Bearer <token>",
            key: "Authorization",
            value: "Bearer <token>",
          },
          ...baseHeaders,
        ];
      }
    } else {
      baseHeaders = baseHeaders.filter(
        (h: Parameter) =>
          h.name?.toLowerCase() !== "authorization" &&
          h.id !== "auth-bearer-header" &&
          !h.id?.startsWith("auth-"),
      );
    }
    return baseHeaders;
  }, [data.headers, connectedEndpoint?.headers, isAuthEnabled]);

  const effectivePathParams: Parameter[] = useMemo(() => {
    return data.pathParams && data.pathParams.length > 0
      ? data.pathParams
      : connectedEndpoint?.pathParams || [];
  }, [data.pathParams, connectedEndpoint?.pathParams]);

  const effectiveQueryParams: Parameter[] = useMemo(() => {
    return data.queryParams && data.queryParams.length > 0
      ? data.queryParams
      : connectedEndpoint?.queryParams || [];
  }, [data.queryParams, connectedEndpoint?.queryParams]);

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
