import React from "react";
import { Endpoint } from "@workspace/canvas";
import { Parameter, Schema } from "@/types/canvas";
import { ParameterEditor } from "../../backend-nodes/graph-nodes/Editors";
import { RequestBodyEditor, RequestBodyMode } from "../RequestBodyEditor";

interface WebPageParametersSectionProps {
  connectedEndpoint: Endpoint | null;
  effectiveHeaders: Parameter[];
  effectivePathParams: Parameter[];
  effectiveQueryParams: Parameter[];
  effectiveRequestBody: Schema;
  effectiveRequestBodyMode: RequestBodyMode;
  onUpdateHeaders: (headers: Parameter[]) => void;
  onUpdatePathParams: (pathParams: Parameter[]) => void;
  onUpdateQueryParams: (queryParams: Parameter[]) => void;
  onUpdateRequestBody: (requestBody: Schema) => void;
  onUpdateRequestBodyMode: (mode: RequestBodyMode) => void;
}

export function WebPageParametersSection({
  connectedEndpoint,
  effectiveHeaders,
  effectivePathParams,
  effectiveQueryParams,
  effectiveRequestBody,
  effectiveRequestBodyMode,
  onUpdateHeaders,
  onUpdatePathParams,
  onUpdateQueryParams,
  onUpdateRequestBody,
  onUpdateRequestBodyMode,
}: WebPageParametersSectionProps) {
  return (
    <>
      {connectedEndpoint && (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs">
          <span className="text-[11px] text-muted-foreground">
            synced with{" "}
            <span className="font-mono font-medium text-foreground">
              {connectedEndpoint.type || "GET"} {connectedEndpoint.name}
            </span>
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Synced
          </span>
        </div>
      )}

      <ParameterEditor
        title="Headers"
        parameters={effectiveHeaders}
        onChange={onUpdateHeaders}
      />
      <ParameterEditor
        title="Path Params"
        parameters={effectivePathParams}
        onChange={onUpdatePathParams}
      />
      <ParameterEditor
        title="Query Params"
        parameters={effectiveQueryParams}
        onChange={onUpdateQueryParams}
      />
      <RequestBodyEditor
        mode={effectiveRequestBodyMode}
        onModeChange={onUpdateRequestBodyMode}
        schema={effectiveRequestBody}
        onSchemaChange={onUpdateRequestBody}
      />
    </>
  );
}
