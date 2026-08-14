import React from "react";
import { Parameter, Schema } from "@/types/canvas";
import { ParameterEditor } from "../../backend-nodes/graph-nodes/Editors";
import { RequestBodyEditor, RequestBodyMode } from "../RequestBodyEditor";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { SlidersHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Endpoint } from "@workspace/canvas";

interface RequestConfigSectionProps {
  headers: Parameter[];
  pathParams: Parameter[];
  queryParams: Parameter[];
  requestBody?: Schema;
  requestBodyMode: RequestBodyMode;
  connectedEndpoint?: Endpoint | null;
  onHeadersChange: (headers: Parameter[]) => void;
  onPathParamsChange: (pathParams: Parameter[]) => void;
  onQueryParamsChange: (queryParams: Parameter[]) => void;
  onRequestBodyChange: (schema: Schema) => void;
  onRequestBodyModeChange: (mode: RequestBodyMode) => void;
  onSyncWithEndpoint?: () => void;
}

export const RequestConfigSection: React.FC<RequestConfigSectionProps> = ({
  headers,
  pathParams,
  queryParams,
  requestBody,
  requestBodyMode,
  connectedEndpoint,
  onHeadersChange,
  onPathParamsChange,
  onQueryParamsChange,
  onRequestBodyChange,
  onRequestBodyModeChange,
  onSyncWithEndpoint,
}) => {
  return (
    <AccordionItem
      value="request_config"
      className="border rounded-xl overflow-hidden bg-card"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/20 transition-colors [&>svg]:shrink-0">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-primary" />
            <span className="text-xs font-semibold">Request Configuration</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5 pt-2">
        <div className="flex flex-col gap-4">
          {connectedEndpoint && onSyncWithEndpoint && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs">
              <span className="text-[11px] text-muted-foreground">
                Configured for{" "}
                <span className="font-mono font-medium text-foreground">
                  {connectedEndpoint.type || "GET"} {connectedEndpoint.name}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2 text-primary hover:text-primary hover:bg-primary/10"
                onClick={onSyncWithEndpoint}
                title="Reset/sync parameters and body from connected endpoint"
              >
                <RefreshCw size={10} />
                Sync Endpoint
              </Button>
            </div>
          )}

          {/* 1. Headers */}
          <ParameterEditor
            title="Headers"
            parameters={headers}
            onChange={onHeadersChange}
          />

          {/* 2. Path Params */}
          <ParameterEditor
            title="Path Params"
            parameters={pathParams}
            onChange={onPathParamsChange}
          />

          {/* 3. Query Params */}
          <ParameterEditor
            title="Query Params"
            parameters={queryParams}
            onChange={onQueryParamsChange}
          />

          {/* 4. Request Body */}
          <RequestBodyEditor
            mode={requestBodyMode}
            onModeChange={onRequestBodyModeChange}
            schema={requestBody}
            onSchemaChange={onRequestBodyChange}
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
