import React from "react";
import { TabsContent } from "@workspace/ui/components/tabs";
import { Parameter, Schema } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas";
import { RequestBodyMode } from "../../RequestBodyEditor";
import { WebPageParametersSection } from "../WebPageParametersSection";

interface WebPageApiTabProps {
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

export function WebPageApiTab({
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
}: WebPageApiTabProps) {
  return (
    <TabsContent
      value="api"
      className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
    >
      <WebPageParametersSection
        connectedEndpoint={connectedEndpoint}
        effectiveHeaders={effectiveHeaders}
        effectivePathParams={effectivePathParams}
        effectiveQueryParams={effectiveQueryParams}
        effectiveRequestBody={effectiveRequestBody}
        effectiveRequestBodyMode={effectiveRequestBodyMode}
        onUpdateHeaders={onUpdateHeaders}
        onUpdatePathParams={onUpdatePathParams}
        onUpdateQueryParams={onUpdateQueryParams}
        onUpdateRequestBody={onUpdateRequestBody}
        onUpdateRequestBodyMode={onUpdateRequestBodyMode}
      />
    </TabsContent>
  );
}
