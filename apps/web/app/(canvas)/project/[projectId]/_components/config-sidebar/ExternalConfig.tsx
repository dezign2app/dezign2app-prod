"use client";

import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Globe,
  Plus,
  Settings,
  ExternalLink,
  KeyRound,
  Trash,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { generateId } from "../backend-nodes/graph-nodes/common";
import { isOutputSchemaMissing } from "@/lib/utils/nestedJsonSchema";
import { CanvasExternalNodeData } from "@workspace/canvas/types";
import { cn } from "@workspace/ui/lib/utils";
import { useBufferedInput } from "@/lib/hooks/useBufferedInput";
import { EnvSecretInput } from "./EnvSecretInput";
import { EnvVarSelector } from "./EnvVarSelector";
import { ExternalEnvVarsDrawer } from "../backend-nodes/graph-nodes/nodes/ai-security/ExternalEnvVarsDrawer";

interface ExternalConfigProps {
  id: string;
  nodeId: string;
}

export const ExternalConfig: React.FC<ExternalConfigProps> = ({
  id,
  nodeId,
}) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === nodeId),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const allEndpoints = useBackendCanvasStore((s) => s.endpoints);
  const addEndpoint = useBackendCanvasStore((s) => s.addEndpoint);
  const deleteEndpoint = useBackendCanvasStore((s) => s.deleteEndpoint);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );

  const data = (node?.data || {}) as CanvasExternalNodeData;
  const endpoints = allEndpoints.filter((e) => e.nodeId === nodeId);

  const updateData = React.useCallback(
    (changes: Record<string, unknown>) => {
      if (!node) return;
      updateNode(nodeId, { data: { ...data, ...changes } as any });
    },
    [node, nodeId, data, updateNode],
  );

  const labelBuffer = useBufferedInput(
    data.label || "",
    React.useCallback((label: string) => updateData({ label }), [updateData]),
    200,
  );

  const descriptionBuffer = useBufferedInput(
    data.description || "",
    React.useCallback(
      (description: string) => updateData({ description }),
      [updateData],
    ),
    200,
  );

  const docsUrlBuffer = useBufferedInput(
    data.docsUrl || "",
    React.useCallback((docsUrl: string) => updateData({ docsUrl }), [updateData]),
    200,
  );

  const baseUrlBuffer = useBufferedInput(
    data.baseUrl || "",
    React.useCallback((baseUrl: string) => updateData({ baseUrl }), [updateData]),
    200,
  );

  const timeoutBuffer = useBufferedInput(
    data.timeout !== undefined && data.timeout !== null ? String(data.timeout) : "",
    React.useCallback((timeout: string) => updateData({ timeout }), [updateData]),
    200,
  );

  const rateLimitBuffer = useBufferedInput(
    data.rateLimit || "",
    React.useCallback(
      (rateLimit: string) => updateData({ rateLimit }),
      [updateData],
    ),
    200,
  );

  const authHeaderBuffer = useBufferedInput(
    data.authHeader || "",
    React.useCallback(
      (authHeader: string) => updateData({ authHeader }),
      [updateData],
    ),
    200,
  );

  if (!node) return null;

  const handleAddEndpoint = () => {
    const newEp = {
      id: generateId(),
      name: "/v1/action",
      type: "POST",
      summary: "External API action",
    };
    addEndpoint(nodeId, newEp);
    setActiveConfigItem({
      type: "endpoint",
      id: newEp.id,
      nodeId,
    });
  };

  return (
    <div className="flex flex-col gap-6 mt-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Globe size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              {data.label || "External API"}
            </span>
            <span className="text-xs text-muted-foreground">
              Configure 3rd-party API connection, defaults & endpoints.
            </span>
          </div>
        </div>
      </div>

      {/* Label & Description */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          General Info
        </span>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">API Name</Label>
          <Input
            className="h-8 text-xs bg-background"
            placeholder="e.g. Stripe, OpenAI, Twilio"
            value={labelBuffer.value}
            onChange={(e) => labelBuffer.onChange(e.target.value)}
            onBlur={labelBuffer.flush}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            className="min-h-[60px] text-xs bg-background resize-none"
            placeholder="Describe this external service and its role..."
            value={descriptionBuffer.value}
            onChange={(e) => descriptionBuffer.onChange(e.target.value)}
            onBlur={descriptionBuffer.flush}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Documentation URL</Label>
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-xs bg-background font-mono flex-1"
              placeholder="https://docs.example.com/api"
              value={docsUrlBuffer.value}
              onChange={(e) => docsUrlBuffer.onChange(e.target.value)}
              onBlur={docsUrlBuffer.flush}
            />
            {docsUrlBuffer.value && (
              <a
                href={docsUrlBuffer.value}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Open documentation"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Base URL */}
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border p-4 shadow-sm backdrop-blur-sm transition-colors",
          !baseUrlBuffer.value?.trim()
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-card/50",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Network & Base URL
          </span>
          {!baseUrlBuffer.value?.trim() && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/15 px-1.5 py-0.5 rounded border border-destructive/30">
              Error / Required
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs flex items-center justify-between">
            <span>Base URL</span>
            {!baseUrlBuffer.value?.trim() && (
              <span className="text-[10px] text-destructive font-semibold">
                Missing Base URL
              </span>
            )}
          </Label>
          <div className="flex items-center gap-2">
            <Globe
              size={14}
              className={cn(
                "shrink-0",
                !baseUrlBuffer.value?.trim()
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            />
            <Input
              className={cn(
                "h-8 text-xs bg-background font-mono flex-1",
                !baseUrlBuffer.value?.trim() &&
                  "border-destructive focus-visible:ring-destructive text-destructive placeholder:text-destructive/50",
              )}
              placeholder="https://api.stripe.com/v1"
              value={baseUrlBuffer.value}
              onChange={(e) => baseUrlBuffer.onChange(e.target.value)}
              onBlur={baseUrlBuffer.flush}
            />
          </div>
          {!baseUrlBuffer.value?.trim() ? (
            <span className="text-[10px] text-destructive font-medium flex items-center gap-1 mt-0.5">
              <AlertCircle size={12} className="shrink-0 text-destructive" />
              Base URL is not configured. Requests will fail without a target host URL.
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              Prefix prepended to all endpoint paths when invoked.
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Timeout (sec)</Label>
            <Input
              className="h-8 text-xs bg-background"
              placeholder="30"
              value={timeoutBuffer.value}
              onChange={(e) => timeoutBuffer.onChange(e.target.value)}
              onBlur={timeoutBuffer.flush}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Rate Limit</Label>
            <Input
              className="h-8 text-xs bg-background"
              placeholder="100/m"
              value={rateLimitBuffer.value}
              onChange={(e) => rateLimitBuffer.onChange(e.target.value)}
              onBlur={rateLimitBuffer.flush}
            />
          </div>
        </div>
      </div>

      {/* Global Default Authentication */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Default Authentication
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Scheme</Label>
          <Select
            value={data.authType || "none"}
            onValueChange={(val) => updateData({ authType: val })}
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                None (Public API)
              </SelectItem>
              <SelectItem value="bearer" className="text-xs">
                Bearer Token (Authorization: Bearer &lt;token&gt;)
              </SelectItem>
              <SelectItem value="apiKey" className="text-xs">
                API Key (Header)
              </SelectItem>
              <SelectItem value="basic" className="text-xs">
                Basic Auth
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.authType === "apiKey" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Header Name</Label>
            <Input
              className="h-8 text-xs bg-background font-mono"
              placeholder="X-API-Key"
              value={authHeaderBuffer.value}
              onChange={(e) => authHeaderBuffer.onChange(e.target.value)}
              onBlur={authHeaderBuffer.flush}
            />
          </div>
        )}

        {data.authType && data.authType !== "none" && (
          <EnvVarSelector
            serviceNodeId={nodeId}
            nodeEnvVars={data.envVars}
            currentEnvVar={data.apiKey || ""}
            onChange={(cleanName, refString) => {
              updateData({ apiKey: refString });
            }}
          />
        )}
      </div>

      {/* Environment Variables (.env) Config */}
      <ExternalEnvVarsDrawer nodeId={nodeId} defaultOpen={true} />

      {/* Endpoints List */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Configured Endpoints
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground font-semibold">
              {endpoints.length}
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px] gap-1 rounded-full px-2.5"
            onClick={handleAddEndpoint}
          >
            <Plus size={12} /> Add Endpoint
          </Button>
        </div>

        {endpoints.length === 0 ? (
          <span className="text-xs text-muted-foreground italic p-2">
            No endpoints configured. Add an endpoint to start defining API actions.
          </span>
        ) : (
          <div className="flex flex-col divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden">
            {endpoints.map((ep) => {
              const missingSchema = isOutputSchemaMissing({
                responseBody: ep.responseBody,
                responseMode: ep.responseMode,
              });

              return (
                <div
                  key={ep.id}
                  className="flex items-center justify-between p-2.5 bg-background/50 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                      {ep.type || "POST"}
                    </span>
                    <span className="text-xs font-medium text-foreground truncate font-mono">
                      {ep.name}
                    </span>
                    {missingSchema && (
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                        <AlertTriangle size={10} />
                        Missing Schema
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setActiveConfigItem({
                          type: "endpoint",
                          id: ep.id,
                          nodeId,
                        })
                      }
                      title="Configure endpoint parameters, request & response body"
                    >
                      <Settings size={13} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteEndpoint(ep.id)}
                      title="Delete endpoint"
                    >
                      <Trash size={13} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
