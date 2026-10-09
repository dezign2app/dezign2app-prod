import React from "react";
import { TabsContent } from "@workspace/ui/components/tabs";
import { Parameter } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas";
import { WebPageParametersSection } from "../WebPageParametersSection";

export interface WebPageApiTabProps {
  connectedEndpoint?: Endpoint | null;
  effectivePathParams: Parameter[];
  effectiveQueryParams: Parameter[];
  onUpdatePathParams: (pathParams: Parameter[]) => void;
  onUpdateQueryParams: (queryParams: Parameter[]) => void;
}

export function WebPageApiTab({
  connectedEndpoint,
  effectivePathParams,
  effectiveQueryParams,
  onUpdatePathParams,
  onUpdateQueryParams,
}: WebPageApiTabProps) {
  return (
    <TabsContent
      value="api"
      className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
    >
      <WebPageParametersSection
        connectedEndpoint={connectedEndpoint}
        effectivePathParams={effectivePathParams}
        effectiveQueryParams={effectiveQueryParams}
        onUpdatePathParams={onUpdatePathParams}
        onUpdateQueryParams={onUpdateQueryParams}
      />
    </TabsContent>
  );
}
