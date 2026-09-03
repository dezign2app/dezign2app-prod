"use client";

import React from "react";
import { KeyRound, ShieldAlert, Check } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Endpoint, Parameter } from "@/types/canvas";
import { generateId } from "../backend-nodes/graph-nodes/common";

export type ExternalAuthType =
  | "none"
  | "bearer"
  | "apiKeyHeader"
  | "apiKeyQuery"
  | "basic";

interface ExternalAuthSectionProps {
  endpoint: Endpoint;
  projectId?: string;
  serviceNodeId?: string;
  nodeEnvVars?: Array<{ id: string; name: string; description?: string }>;
  defaultAuthType?: string;
  defaultAuthHeader?: string;
  defaultApiKey?: string;
  onUpdateEndpoint: (changes: Partial<Endpoint>) => void;
}

import { useBufferedInput } from "@/lib/hooks/useBufferedInput";
import { EnvVarSelector } from "./EnvVarSelector";
import { cleanEnvVarName, formatEnvVarRef } from "@/lib/utils/localEnvSync";

export const ExternalAuthSection: React.FC<ExternalAuthSectionProps> = ({
  endpoint,
  projectId,
  serviceNodeId,
  nodeEnvVars,
  defaultAuthType = "none",
  defaultAuthHeader,
  defaultApiKey,
  onUpdateEndpoint,
}) => {
  const currentHeaders = endpoint.headers || [];
  const currentQueryParams = endpoint.queryParams || [];

  // Detect current auth configuration from headers/params
  const bearerHeader = currentHeaders.find(
    (h) => h.name.toLowerCase() === "authorization" && h.value?.startsWith("Bearer"),
  );
  const customAuthHeader = currentHeaders.find(
    (h) =>
      h.name.toLowerCase() === "authorization" ||
      h.name.toLowerCase().includes("key") ||
      h.name.toLowerCase().includes("token") ||
      h.name.toLowerCase().includes("api"),
  );
  const apiKeyQuery = currentQueryParams.find(
    (q) =>
      q.name.toLowerCase().includes("key") ||
      q.name.toLowerCase().includes("token") ||
      q.name.toLowerCase().includes("api"),
  );

  const derivedType: ExternalAuthType = bearerHeader
    ? "bearer"
    : customAuthHeader && customAuthHeader.name.toLowerCase() !== "authorization"
    ? "apiKeyHeader"
    : customAuthHeader
    ? "bearer"
    : apiKeyQuery
    ? "apiKeyQuery"
    : (defaultAuthType as ExternalAuthType) || "none";

  const [authType, setAuthType] = React.useState<ExternalAuthType>(derivedType);

  const rawInitialHeader =
    customAuthHeader?.name || defaultAuthHeader || "X-API-Key";
  const rawInitialToken = bearerHeader
    ? bearerHeader.value?.replace(/^Bearer\s*/, "") || ""
    : customAuthHeader?.value || apiKeyQuery?.defaultValue || defaultApiKey || "";

  const initialEnvVarName = cleanEnvVarName(rawInitialToken) || "API_KEY";
  const [envVarName, setEnvVarName] = React.useState(initialEnvVarName);

  const handleApplyAuth = React.useCallback(
    (newType: ExternalAuthType, hName: string, envRef: string) => {
      setAuthType(newType);

      let nextHeaders = [...currentHeaders];
      let nextQueryParams = [...currentQueryParams];

      // Clear previous auth headers
      nextHeaders = nextHeaders.filter(
        (h) =>
          h.name.toLowerCase() !== "authorization" &&
          h.name.toLowerCase() !== hName.toLowerCase() &&
          h.id !== "auth-header-external",
      );
      nextQueryParams = nextQueryParams.filter(
        (q) => q.id !== "auth-query-external",
      );

      const resolvedRef = envRef.trim() || "process.env.API_KEY";

      if (newType === "bearer") {
        const formatted = `Bearer ${resolvedRef}`;
        nextHeaders.unshift({
          id: "auth-header-external",
          name: "Authorization",
          type: "string",
          required: true,
          description: "Bearer authentication token",
          defaultValue: formatted,
          key: "Authorization",
          value: formatted,
        });
      } else if (newType === "apiKeyHeader") {
        const targetHeader = hName.trim() || "X-API-Key";
        nextHeaders.unshift({
          id: "auth-header-external",
          name: targetHeader,
          type: "string",
          required: true,
          description: "",
          defaultValue: resolvedRef,
          key: targetHeader,
          value: resolvedRef,
        });
      } else if (newType === "apiKeyQuery") {
        const targetQuery = hName.trim() || "api_key";
        nextQueryParams.unshift({
          id: "auth-query-external",
          name: targetQuery,
          type: "string",
          required: true,
          description: "API Key Query Parameter",
          defaultValue: resolvedRef,
        });
      } else if (newType === "basic") {
        const formatted = `Basic ${resolvedRef}`;
        nextHeaders.unshift({
          id: "auth-header-external",
          name: "Authorization",
          type: "string",
          required: true,
          description: "Basic authentication header",
          defaultValue: formatted,
          key: "Authorization",
          value: formatted,
        });
      }

      onUpdateEndpoint({
        headers: nextHeaders,
        queryParams: nextQueryParams,
      });
    },
    [currentHeaders, currentQueryParams, onUpdateEndpoint],
  );

  const headerBuffer = useBufferedInput(
    rawInitialHeader,
    React.useCallback(
      (val: string) => handleApplyAuth(authType, val, formatEnvVarRef(envVarName)),
      [authType, handleApplyAuth, envVarName],
    ),
    200,
  );

  const handleEnvVarChange = React.useCallback(
    (cleanName: string, refString: string) => {
      setEnvVarName(cleanName);
      handleApplyAuth(authType, headerBuffer.value, refString);
    },
    [authType, headerBuffer.value, handleApplyAuth],
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            API Authentication
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Auto-injects credential headers
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Scheme</Label>
          <Select
            value={authType}
            onValueChange={(val: ExternalAuthType) => {
              let nextHName = headerBuffer.value;
              if (val === "apiKeyHeader" && (!nextHName || nextHName.toLowerCase() === "authorization")) {
                nextHName = defaultAuthHeader || "X-API-Key";
                headerBuffer.onChange(nextHName);
              } else if (val === "apiKeyQuery" && (!nextHName || nextHName.toLowerCase() === "authorization" || nextHName.toLowerCase() === "x-api-key")) {
                nextHName = "api_key";
                headerBuffer.onChange(nextHName);
              } else if (val === "bearer" || val === "basic") {
                nextHName = "Authorization";
                headerBuffer.onChange(nextHName);
              }
              handleApplyAuth(val, nextHName, formatEnvVarRef(envVarName));
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                No Auth (Public Endpoint)
              </SelectItem>
              <SelectItem value="bearer" className="text-xs">
                Bearer Token (Authorization: Bearer &lt;token&gt;)
              </SelectItem>
              <SelectItem value="apiKeyHeader" className="text-xs">
                API Key (Custom Header e.g. X-API-Key)
              </SelectItem>
              <SelectItem value="apiKeyQuery" className="text-xs">
                API Key (Query Parameter e.g. ?api_key=)
              </SelectItem>
              <SelectItem value="basic" className="text-xs">
                HTTP Basic Auth
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {authType === "apiKeyHeader" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Header Name</Label>
            <Input
              className="h-8 text-xs bg-background font-mono"
              placeholder="X-API-Key"
              value={headerBuffer.value}
              onChange={(e) => headerBuffer.onChange(e.target.value)}
              onBlur={headerBuffer.flush}
            />
          </div>
        )}

        {authType === "apiKeyQuery" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Query Parameter Name</Label>
            <Input
              className="h-8 text-xs bg-background font-mono"
              placeholder="api_key"
              value={headerBuffer.value}
              onChange={(e) => headerBuffer.onChange(e.target.value)}
              onBlur={headerBuffer.flush}
            />
          </div>
        )}

        {authType !== "none" && (
          <EnvVarSelector
            serviceNodeId={serviceNodeId}
            nodeEnvVars={nodeEnvVars}
            currentEnvVar={envVarName}
            onChange={handleEnvVarChange}
            projectId={projectId}
          />
        )}
      </div>
    </div>
  );
};
