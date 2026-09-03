"use client";

import React, { useMemo } from "react";
import { BackendNode, BackendEdge, Endpoint } from "@workspace/canvas/types";
import { toFolderName, toPascalCase, toVarName } from "@/lib/compiler/utils";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Cloud, Globe, Code2, Settings, Sparkles, ExternalLink, AlertCircle } from "lucide-react";
import { PipelineStepDraft, ExpectedArg, StepBinding } from "./types";

import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

export interface ServiceCallStepSectionProps {
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

export const ServiceCallStepSection = ({
  step,
  allNodes,
  allEdges,
  serviceNodeId,
  expectedArgs,
  showAdvancedSettings,
  onToggleAdvancedSettings,
  onChange,
  onAutoMapArguments,
  children,
}: ServiceCallStepSectionProps) => {
  const allEndpoints = useBackendCanvasStore((s) => s.endpoints);

  // 1. Identify other target microservices on the canvas
  const availableServices = useMemo(
    () =>
      allNodes.filter(
        (n) =>
          (n.type === "service" ||
            n.type === "serverless" ||
            n.type === "worker") &&
          (!serviceNodeId || n.id !== serviceNodeId),
      ),
    [allNodes, serviceNodeId],
  );

  // Selected target service node
  const selectedServiceNode = useMemo(() => {
    if (step.databaseId) {
      return availableServices.find((s) => s.id === step.databaseId);
    }
    return availableServices[0];
  }, [availableServices, step.databaseId]);

  // 2. Endpoints configured on the selected service
  const serviceEndpoints: Endpoint[] = useMemo(() => {
    if (!selectedServiceNode) return [];
    const fromStore = allEndpoints.filter(
      (e) => e.nodeId === selectedServiceNode.id,
    );
    if (fromStore.length > 0) return fromStore;
    if (!selectedServiceNode?.data?.endpoints) return [];
    return Array.isArray(selectedServiceNode.data.endpoints)
      ? selectedServiceNode.data.endpoints
      : [];
  }, [selectedServiceNode, allEndpoints]);

  // Selected endpoint
  const selectedEndpoint = useMemo(() => {
    if (!step.tableNodeId) return serviceEndpoints[0];
    return (
      serviceEndpoints.find(
        (ep) =>
          ep.id === step.tableNodeId ||
          ep.name === step.tableNodeId ||
          ep.id === step.operationId,
      ) || serviceEndpoints[0]
    );
  }, [serviceEndpoints, step.tableNodeId, step.operationId]);

  // 3. Client call options for this service & endpoint
  const clientOptions = useMemo(() => {
    if (!selectedServiceNode) return [];

    const serviceLabel = selectedServiceNode.data?.label || "service";
    const pascalService = toPascalCase(serviceLabel);
    const folderName = toFolderName(serviceLabel);
    const epName = selectedEndpoint?.name?.replace(/[^a-zA-Z0-9]/g, "") || "call";
    const method = selectedEndpoint?.type || "GET";
    const pascalEp = toPascalCase(`${method.toLowerCase()}_${epName}`);

    return [
      {
        id: `call-${serviceLabel}-${epName}`,
        name: `call${pascalService}${pascalEp}`,
        importPath: `@workspace/services/${folderName}`,
        signature: `call${pascalService}${pascalEp}(params?: Record<string, unknown>, body?: Record<string, unknown>): Promise<unknown>`,
        description: `Dedicated RPC client for ${serviceLabel} [${method} ${selectedEndpoint?.name || "/"}]`,
      },
      {
        id: `http-${method.toLowerCase()}`,
        name: `httpClient.${method.toLowerCase()}`,
        importPath: "@workspace/http-client",
        signature: `httpClient.${method.toLowerCase()}(url: string, data?: Record<string, unknown>): Promise<unknown>`,
        description: `Direct HTTP ${method} client request`,
      },
    ];
  }, [selectedServiceNode, selectedEndpoint]);

  const selectedClientOption = useMemo(() => {
    return (
      clientOptions.find(
        (o) =>
          o.name === step.functionRef?.name ||
          o.id === step.operationId ||
          o.id === step.functionRef?.name,
      ) || clientOptions[0]
    );
  }, [clientOptions, step.functionRef?.name, step.operationId]);

  // Handle selecting a Target Microservice
  const handleSelectService = (targetServiceId: string) => {
    const sNode = availableServices.find((s) => s.id === targetServiceId);
    if (!sNode) return;

    const endpoints: Endpoint[] = sNode.data?.endpoints || [];
    const firstEp = endpoints[0];
    const serviceLabel = sNode.data?.label || "service";
    const pascalService = toPascalCase(serviceLabel);
    const folderName = toFolderName(serviceLabel);

    const epName = firstEp?.name?.replace(/[^a-zA-Z0-9]/g, "") || "call";
    const method = firstEp?.type || "GET";
    const pascalEp = toPascalCase(`${method.toLowerCase()}_${epName}`);
    const fnName = `call${pascalService}${pascalEp}`;
    const varName = `${toVarName(serviceLabel)}Response`;

    onChange({
      ...step,
      databaseId: sNode.id, // Store target service ID in databaseId / tableNodeId
      tableNodeId: firstEp?.id,
      operationId: `call-${serviceLabel}-${epName}`,
      functionRef: {
        name: fnName,
        importPath: `@workspace/services/${folderName}`,
      },
      name: varName,
      outputVariable: varName,
    });
  };

  // Handle selecting a Target Endpoint
  const handleSelectEndpoint = (endpointId: string) => {
    const ep = serviceEndpoints.find((e) => e.id === endpointId || e.name === endpointId);
    if (!ep || !selectedServiceNode) return;

    const serviceLabel = selectedServiceNode.data?.label || "service";
    const pascalService = toPascalCase(serviceLabel);
    const folderName = toFolderName(serviceLabel);

    const epName = ep.name?.replace(/[^a-zA-Z0-9]/g, "") || "call";
    const method = ep.type || "GET";
    const pascalEp = toPascalCase(`${method.toLowerCase()}_${epName}`);
    const fnName = `call${pascalService}${pascalEp}`;
    const varName = `${toVarName(serviceLabel)}Response`;

    onChange({
      ...step,
      tableNodeId: ep.id,
      operationId: `call-${serviceLabel}-${epName}`,
      functionRef: {
        name: fnName,
        importPath: `@workspace/services/${folderName}`,
        signature: `call${pascalService}${pascalEp}(params?: Record<string, unknown>, body?: Record<string, unknown>): Promise<unknown>`,
      },
      name: varName,
      outputVariable: varName,
    });
  };

  // Handle selecting Client Function
  const handleSelectFunction = (fnId: string) => {
    const opt = clientOptions.find((o) => o.id === fnId || o.name === fnId);
    if (!opt) return;

    onChange({
      ...step,
      operationId: opt.id,
      functionRef: {
        name: opt.name,
        importPath: opt.importPath,
        signature: opt.signature,
      },
    });
  };

  return (
    <div className="flex flex-col gap-3 p-2.5 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.04]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
          <Cloud size={13} />
          <span>Inter-Service API Call</span>
        </div>
        {selectedClientOption && (
          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/15 border border-cyan-500/25 px-1.5 py-0.2 rounded font-medium">
            {selectedClientOption.name}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {/* 1. Target Service selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Globe size={10} /> Target Microservice
          </Label>
          <Select
            value={selectedServiceNode?.id || availableServices[0]?.id || "__none__"}
            onValueChange={handleSelectService}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue placeholder="Select Target Microservice..." />
            </SelectTrigger>
            <SelectContent>
              {availableServices.length === 0 ? (
                <SelectItem value="__none__" className="text-xs text-muted-foreground">
                  No other microservices available
                </SelectItem>
              ) : (
                availableServices
                  .filter((svc) => Boolean(svc && svc.id && svc.id.trim()))
                  .map((svc) => (
                    <SelectItem key={svc.id} value={svc.id} className="text-xs font-mono">
                      ☁️ {svc.data?.label || "Service"} ({svc.data?.techStack || "node"})
                    </SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Target Endpoint selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ExternalLink size={10} /> Target Endpoint
          </Label>
          <Select
            value={selectedEndpoint?.id || "__none__"}
            onValueChange={handleSelectEndpoint}
            disabled={!selectedServiceNode || serviceEndpoints.length === 0}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue
                placeholder={
                  !selectedServiceNode
                    ? "Select service first"
                    : serviceEndpoints.length === 0
                    ? "No endpoints in service"
                    : "Select endpoint..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {serviceEndpoints.length === 0 ? (
                <SelectItem value="__none__" className="text-xs text-muted-foreground">
                  No endpoints configured on this service
                </SelectItem>
              ) : (
                serviceEndpoints
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

        {/* 3. Client Function selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Code2 size={10} /> Client Invocation Helper
          </Label>
          <Select
            value={selectedClientOption?.id || selectedClientOption?.name || "__none__"}
            onValueChange={handleSelectFunction}
            disabled={clientOptions.length === 0}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue placeholder="Choose Client Function..." />
            </SelectTrigger>
            <SelectContent>
              {clientOptions
                .filter((opt) => Boolean(opt && opt.id && opt.id.trim()))
                .map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="text-xs font-mono">
                    <span className="font-semibold text-cyan-300">{opt.name}</span>
                    <span className="text-[9px] text-muted-foreground ml-1.5">
                      — {opt.description}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expected arguments preview & quick mapping button */}
      {expectedArgs && expectedArgs.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-cyan-500/15">
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
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 transition-colors"
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

      {/* Advanced function settings toggle */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-cyan-500/15">
        <button
          type="button"
          className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors self-start"
          onClick={onToggleAdvancedSettings}
        >
          <Settings size={10} />
          <span>{showAdvancedSettings ? "Hide" : "Show"} Advanced Import & Function Overrides</span>
        </button>

        {showAdvancedSettings && (
          <div className="grid grid-cols-2 gap-2 p-2 rounded bg-muted/20 border border-border/40">
            <div className="flex flex-col gap-1">
              <Label className="text-[9px] text-muted-foreground">Compiled Function Name</Label>
              <Input
                className="h-6 text-[11px] font-mono bg-background/60 border-border/60"
                value={step.functionRef?.name ?? ""}
                onChange={(e) =>
                  onChange({
                    ...step,
                    functionRef: {
                      ...(step.functionRef ?? { importPath: "" }),
                      name: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[9px] text-muted-foreground">Compiled Import Path</Label>
              <Input
                className="h-6 text-[11px] font-mono bg-background/60 border-border/60"
                value={step.functionRef?.importPath ?? ""}
                onChange={(e) =>
                  onChange({
                    ...step,
                    functionRef: {
                      ...(step.functionRef ?? { name: "" }),
                      importPath: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
