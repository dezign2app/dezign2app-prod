"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Sparkles, Globe, Layers, TableProperties } from "lucide-react";
import { Endpoint } from "@/types/canvas";
import { AvailablePath } from "../../pipeline-step-editor/types";
import { SmartPathInput } from "../../pipeline-step-editor/SmartPathInput";
import { SourceKind } from "./types";
import { StoreActionSelectorField } from "./StoreActionSelector";

export interface StorePopulateMappingProps {
  fields: StoreActionSelectorField[];
  parameterMappings?: Record<string, string>;
  isEndpointConnected: boolean;
  connectedEndpoint?: Endpoint;
  connectedEndpointName?: string;
  actionName?: string;
  selectedSourceKind: SourceKind;
  currentSuggestedPaths: AvailablePath[];
  onSourceKindChange: (srcKind: string) => void;
  onFieldMappingChange: (fieldName: string, path: string) => void;
  onAutoMatchPopulate: () => void;
}

export const StorePopulateMapping: React.FC<StorePopulateMappingProps> = ({
  fields,
  parameterMappings = {},
  isEndpointConnected,
  connectedEndpoint,
  connectedEndpointName,
  actionName,
  selectedSourceKind,
  currentSuggestedPaths,
  onSourceKindChange,
  onFieldMappingChange,
  onAutoMatchPopulate,
}) => {
  const mappedCount = Object.keys(parameterMappings).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-500 shrink-0" />
          <div>
            <div className="text-xs font-semibold font-mono">populate({`{ field1, field2, ... }`})</div>
            <div className="text-[10px] text-muted-foreground font-sans">
              Explicitly map incoming properties to store fields. No ambiguous merge.
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAutoMatchPopulate}
          className="h-7 px-2 text-[10px] gap-1 shrink-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
        >
          <Sparkles size={10} />
          Auto-match by Name
        </Button>
      </div>

      {/* Step 1: Data Source Selector for populate */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          Data Source
        </Label>
        <Select
          value={selectedSourceKind}
          onValueChange={onSourceKindChange}
        >
          <SelectTrigger className="h-8 text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {isEndpointConnected && (
              <SelectItem value="endpoint" className="text-xs">
                <div className="flex items-center gap-2">
                  <Globe size={13} className="text-emerald-500 shrink-0" />
                  <span className="font-medium text-foreground">API Response</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({connectedEndpoint?.type || "GET"} {connectedEndpoint?.name || connectedEndpointName || "Endpoint"})
                  </span>
                </div>
              </SelectItem>
            )}
            <SelectItem value="payload" className="text-xs">
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-blue-500 shrink-0" />
                <span className="font-medium text-foreground">Form / Event Payload</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({actionName || "action"})
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Step 2: Field-by-field Mapping Table */}
      <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <TableProperties size={12} className="text-emerald-500" />
            Store Fields Schema Mapping ({fields.length})
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {mappedCount} of {fields.length} mapped
          </span>
        </div>

        <div className="flex flex-col gap-2.5 mt-1">
          {fields.map((f) => {
            const mappedPath = parameterMappings[f.name] || "";
            return (
              <div
                key={f.id}
                className="flex flex-col gap-1.5 p-2 rounded-md bg-background/80 border border-border/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {f.name}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                      {f.isArray ? `${f.type}[]` : f.type}
                    </Badge>
                  </div>
                  {mappedPath ? (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      mapped
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      (unmapped)
                    </span>
                  )}
                </div>

                <SmartPathInput
                  value={mappedPath}
                  onChange={(path) => onFieldMappingChange(f.name, path)}
                  suggestedPaths={currentSuggestedPaths}
                  sourceKindLabel={selectedSourceKind === "endpoint" ? "API Response" : "Event Payload"}
                  rootVariableName={selectedSourceKind === "endpoint" ? "response" : "payload"}
                  placeholder={`Select or type path for ${f.name} (e.g. data.${f.name})`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
