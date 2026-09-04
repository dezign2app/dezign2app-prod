"use client";

import React, { useMemo } from "react";
import { BackendNode, BackendEdge, Endpoint } from "@workspace/canvas/types";
import { toVarName } from "@/lib/compiler/utils";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Globe,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Settings,
} from "lucide-react";
import { PipelineStepDraft, ExpectedArg } from "./types";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { isOutputSchemaMissing } from "@/lib/utils/nestedJsonSchema";

export interface ExternalCallStepSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  serviceNodeId?: string;
  expectedArgs?: ExpectedArg[];
  showAdvancedSettings: boolean;
  onToggleAdvancedSettings: () => void;
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments?: () => void;
  children?: React.ReactNode;
}

export const ExternalCallStepSection: React.FC<ExternalCallStepSectionProps> = ({
  step,
  allNodes,
  expectedArgs,
  showAdvancedSettings,
  onToggleAdvancedSettings,
  onChange,
  onAutoMapArguments,
  children,
}) => {
  const allEndpoints = useBackendCanvasStore((s) => s.endpoints);

  // 1. Available External API nodes on the canvas
  const availableExternalNodes = useMemo(
    () => allNodes.filter((n) => n.type === "external"),
    [allNodes],
  );

  // Selected External Node
  const selectedExternalNode = useMemo(() => {
    const targetId = step.externalNodeId || step.databaseId;
    if (targetId) {
      return availableExternalNodes.find((n) => n.id === targetId);
    }
    return availableExternalNodes[0];
  }, [availableExternalNodes, step.externalNodeId, step.databaseId]);

  // Endpoints configured on the selected External Node
  const externalEndpoints: Endpoint[] = useMemo(() => {
    if (!selectedExternalNode) return [];
    const fromStore = allEndpoints.filter(
      (e) => e.nodeId === selectedExternalNode.id,
    );
    if (fromStore.length > 0) return fromStore;
    if (!selectedExternalNode?.data?.endpoints) return [];
    return Array.isArray(selectedExternalNode.data.endpoints)
      ? selectedExternalNode.data.endpoints
      : [];
  }, [selectedExternalNode, allEndpoints]);

  // Selected endpoint
  const selectedEndpoint = useMemo(() => {
    const epId = step.externalEndpointId || step.tableNodeId || step.operationId;
    if (!epId) return externalEndpoints[0];
    return (
      externalEndpoints.find(
        (ep) =>
          ep.id === epId ||
          ep.name === epId ||
          ep.id === step.tableNodeId,
      ) || externalEndpoints[0]
    );
  }, [externalEndpoints, step.externalEndpointId, step.tableNodeId, step.operationId]);

  // Handle selecting an External API node
  const handleSelectExternalNode = (targetNodeId: string) => {
    const extNode = availableExternalNodes.find((n) => n.id === targetNodeId);
    if (!extNode) return;

    const endpoints = allEndpoints.filter((e) => e.nodeId === extNode.id);
    const firstEp = endpoints[0] || extNode.data?.endpoints?.[0];
    const nodeLabel = extNode.data?.label || "externalApi";
    const varName = `${toVarName(nodeLabel)}Response`;

    onChange({
      ...step,
      databaseId: extNode.id,
      externalNodeId: extNode.id,
      tableNodeId: firstEp?.id,
      externalEndpointId: firstEp?.id,
      operationId: firstEp ? `${firstEp.type || "POST"}_${firstEp.name}` : undefined,
      name: step.outputVariable || varName,
      outputVariable: step.outputVariable || varName,
    });
  };

  // Handle selecting an Endpoint / Action
  const handleSelectEndpoint = (endpointId: string) => {
    const ep = externalEndpoints.find(
      (e) => e.id === endpointId || e.name === endpointId,
    );
    if (!ep || !selectedExternalNode) return;

    onChange({
      ...step,
      tableNodeId: ep.id,
      externalEndpointId: ep.id,
      operationId: `${ep.type || "POST"}_${ep.name}`,
    });
  };

  const isBaseUrlMissing = !selectedExternalNode?.data?.baseUrl?.trim();
  const isSchemaMissing = selectedEndpoint
    ? isOutputSchemaMissing({
        responseBody: selectedEndpoint.responseBody,
        responseMode: selectedEndpoint.responseMode,
      })
    : false;

  const fullUrl = useMemo(() => {
    if (!selectedExternalNode?.data?.baseUrl) return "";
    const base = selectedExternalNode.data.baseUrl.replace(/\/+$/, "");
    const path = selectedEndpoint?.name || "/";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }, [selectedExternalNode, selectedEndpoint]);


  return (
    <div className="flex flex-col gap-3 p-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <Globe size={13} />
          <span>External API Call</span>
        </div>
        {selectedEndpoint && (
          <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.2 rounded font-medium">
            {selectedEndpoint.type || "GET"} {selectedEndpoint.name || "/"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {/* 1. Target External API selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Globe size={10} /> Target External Service
          </Label>
          <Select
            value={selectedExternalNode?.id || availableExternalNodes[0]?.id || "__none__"}
            onValueChange={handleSelectExternalNode}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue placeholder="Select External API Node..." />
            </SelectTrigger>
            <SelectContent>
              {availableExternalNodes.length === 0 ? (
                <SelectItem value="__none__" className="text-xs text-muted-foreground">
                  No External API nodes placed on canvas
                </SelectItem>
              ) : (
                availableExternalNodes
                  .filter((ext) => Boolean(ext && ext.id && ext.id.trim()))
                  .map((ext) => (
                    <SelectItem key={ext.id} value={ext.id} className="text-xs font-mono">
                      🌐 {ext.data?.label || "External API"}{" "}
                      {ext.data?.baseUrl ? `(${ext.data.baseUrl})` : "(No URL)"}
                    </SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Missing Base URL warning */}
        {selectedExternalNode && isBaseUrlMissing && (
          <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30 text-destructive text-[11px] font-medium">
            <AlertCircle size={13} className="shrink-0 text-destructive" />
            <span>
              External API <strong>{selectedExternalNode.data?.label || "External Node"}</strong> has no Base URL configured. Configure Base URL on the node.
            </span>
          </div>
        )}

        {/* 2. Target Endpoint / Action selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ExternalLink size={10} /> Target Action / Endpoint
          </Label>
          <Select
            value={selectedEndpoint?.id || "__none__"}
            onValueChange={handleSelectEndpoint}
            disabled={!selectedExternalNode || externalEndpoints.length === 0}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue
                placeholder={
                  !selectedExternalNode
                    ? "Select External API first"
                    : externalEndpoints.length === 0
                    ? "No endpoints in external API"
                    : "Select action..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {externalEndpoints.length === 0 ? (
                <SelectItem value="__none__" className="text-xs text-muted-foreground">
                  No endpoints configured on this External API
                </SelectItem>
              ) : (
                externalEndpoints
                  .filter((ep) => Boolean(ep && ep.id && ep.id.trim()))
                  .map((ep) => {
                    const methodColor =
                      ep.type === "GET"
                        ? "text-blue-400 bg-blue-500/10"
                        : ep.type === "POST"
                        ? "text-green-400 bg-green-500/10"
                        : ep.type === "PUT"
                        ? "text-amber-400 bg-amber-500/10"
                        : ep.type === "DELETE"
                        ? "text-red-400 bg-red-500/10"
                        : "text-purple-400 bg-purple-500/10";
                    return (
                      <SelectItem key={ep.id} value={ep.id} className="text-xs font-mono">
                        <span className={`px-1 py-0.2 rounded text-[9px] font-bold mr-1.5 ${methodColor}`}>
                          {ep.type || "GET"}
                        </span>
                        <span>{ep.name || "/"}</span>
                      </SelectItem>
                    );
                  })
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 3. External API Connection Contract Card */}
        {selectedExternalNode && selectedEndpoint && (
          <div className="flex flex-col gap-1.5 p-2 rounded bg-background/60 border border-border/50 text-[11px]">
            {fullUrl && (
              <div className="flex items-center gap-1.5 text-muted-foreground font-mono truncate">
                <span className="text-[10px] uppercase font-bold text-foreground/70 shrink-0">
                  Target URL:
                </span>
                <span className="text-emerald-400 truncate" title={fullUrl}>
                  {fullUrl}
                </span>
              </div>
            )}

            {selectedExternalNode.data?.rateLimit && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-[10px] uppercase font-bold text-foreground/70">
                  Rate Limit:
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {selectedExternalNode.data.rateLimit}
                </span>
              </div>
            )}

            {isSchemaMissing && (
              <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-amber-500/20 text-amber-500 text-[10px]">
                <AlertTriangle size={11} className="shrink-0" />
                <span>
                  External endpoint lacks an output schema. Define a response body contract on the external node so downstream steps can access its response.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expected arguments preview & quick mapping button */}
      {expectedArgs && expectedArgs.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-emerald-500/15">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>Expected args:</span>
              <div className="flex flex-wrap gap-1">
                {expectedArgs.map((arg) => (
                  <span
                    key={arg.name}
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-background/80 border border-border/50 text-foreground/80"
                    title={`Type: ${arg.type}${arg.required ? " (required)" : ""}`}
                  >
                    {arg.name}
                    <span className="text-muted-foreground/60 text-[8px] ml-0.5">
                      :{arg.type}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                onClick={onAutoMapArguments}
                title="Smart map parameters and body payload from current endpoint request and prior step outputs"
              >
                <Sparkles size={10} />
                Auto-map arguments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Argument Bindings */}
      {children}

      {/* Advanced Settings Drawer */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-emerald-500/15">
        <button
          type="button"
          className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors self-start"
          onClick={onToggleAdvancedSettings}
        >
          <Settings size={10} />
          <span>{showAdvancedSettings ? "Hide" : "Show"} Advanced External API Settings</span>
        </button>

        {showAdvancedSettings && (
          <div className="p-2.5 rounded bg-muted/20 border border-border/40 text-[10px] text-muted-foreground flex flex-col gap-1.5">
            <span className="font-semibold text-foreground/90">External API Call Protocol</span>
            <p className="leading-relaxed">
              When compiled, this step executes an HTTP {selectedEndpoint?.type || "POST"} request to{" "}
              <code className="px-1 py-0.2 bg-background rounded font-mono text-[9px]">
                {fullUrl || "BaseURL + Path"}
              </code>{" "}
              using the configured credentials. Downstream steps and the return response builder can reference fields from this step via{" "}
              <code className="px-1 py-0.2 bg-background rounded font-mono text-[9px]">
                {step.outputVariable || "externalResult"}
              </code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
