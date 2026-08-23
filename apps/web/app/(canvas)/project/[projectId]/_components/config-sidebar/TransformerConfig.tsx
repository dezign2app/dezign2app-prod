"use client";

import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Shuffle } from "lucide-react";
import { BusinessLogicBlock } from "../shared/BusinessLogicBlock";
import { RequestBodyEditor, RequestBodyMode } from "./RequestBodyEditor";
import { Parameter, Schema } from "@/types/canvas";
import { toVarName } from "@/lib/compiler/utils";

interface TransformerConfigProps {
  id: string;
  nodeId: string;
}

export const TransformerConfig = ({ id, nodeId }: TransformerConfigProps) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === (nodeId || id)),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);

  if (!node) return null;

  const data = node.data;
  const targetServiceNodes = allNodes.filter((n) => n.type === "service");

  const currentServiceEndpoints = React.useMemo(() => {
    if (!data.targetServiceId) return [];
    return endpoints.filter((e) => e.nodeId === data.targetServiceId);
  }, [endpoints, data.targetServiceId]);

  const inputSchema: Parameter[] = React.useMemo(() => {
    const raw = data.inputSchema || [];
    return raw.map((f, idx) => ({
      ...f,
      id: f.id || `in_${idx}_${f.name || "field"}`,
      required: f.required ?? true,
    }));
  }, [data.inputSchema]);

  const returnSchema: Parameter[] = React.useMemo(() => {
    const raw = data.returnSchema || [];
    return raw.map((f, idx) => ({
      ...f,
      id: f.id || `out_${idx}_${f.name || "field"}`,
      required: f.required ?? true,
    }));
  }, [data.returnSchema]);

  const logicMode = data.logicMode || "code";
  const scope = data.scope || "local";
  const functionName = data.functionName || data.label || "transformData";

  const inputSchemaMode: RequestBodyMode =
    data.inputSchemaMode ?? (data.inputSchemaRawJson ? "raw_json" : "field_builder");
  const returnSchemaMode: RequestBodyMode =
    data.returnSchemaMode ?? (data.returnSchemaRawJson ? "raw_json" : "field_builder");

  const updateData = (patch: Partial<typeof data>) => {
    updateNode(node.id, {
      data: {
        ...data,
        ...patch,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 mt-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded border border-purple-500/20 shadow-sm flex items-center gap-1">
            <Shuffle size={11} />
            TRANSFORMER
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground font-mono">
            {functionName}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          Configure reusable data transformation function parameters, schemas, and logic.
        </span>
      </div>

      <div className="flex gap-4">
        {/* Function name */}
        <div className="flex-1 flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Function Name
          </Label>
          <Input
            className="h-8 text-xs font-mono bg-background/60 border-border/60"
            value={functionName}
            onChange={(e) => {
              const val = toVarName(e.target.value);
              updateData({
                label: val,
                functionName: val,
              });
            }}
            placeholder="e.g. slugifyProductInput"
          />
        </div>

        {/* Scope */}
        <div className="flex-1 flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Scope
          </Label>
          <Select
            value={scope}
            onValueChange={(v) => {
              if (v === "global" || v === "local") {
                updateData({ scope: v });
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local" className="text-xs">
                Local
              </SelectItem>
              <SelectItem value="global" className="text-xs">
                Global
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Target service & Target endpoint when scope === 'local' */}
      {scope === "local" && (
        <div className="flex gap-6">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Target Service
            </Label>
            <Select
              value={data.targetServiceId || ""}
              onValueChange={(v) =>
                updateData({
                  targetServiceId: v,
                  targetEndpointId: undefined,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60 font-mono">
                <SelectValue placeholder="Select target service…" />
              </SelectTrigger>
              <SelectContent>
                {targetServiceNodes.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs font-mono">
                    {s.data?.label || s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Target Endpoint
            </Label>
            <Select
              value={data.targetEndpointId || ""}
              onValueChange={(v) =>
                updateData({
                  targetEndpointId: v || undefined,
                })
              }
              disabled={!data.targetServiceId}
            >
              <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60 font-mono">
                <SelectValue placeholder={data.targetServiceId ? "Select target endpoint…" : "Select a service first"} />
              </SelectTrigger>
              <SelectContent>
                {currentServiceEndpoints.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                    No endpoints in this service
                  </div>
                ) : (
                  currentServiceEndpoints.map((ep) => (
                    <SelectItem key={ep.id} value={ep.id} className="text-xs font-mono">
                      <span className="font-bold text-[10px] px-1 py-0.2 rounded bg-primary/10 text-primary mr-1">
                        {ep.type}
                      </span>
                      <span>{ep.name || ep.summary || ep.id}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}



      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Description (optional)
        </Label>
        <Input
          className="h-8 text-xs bg-background/60 border-border/60"
          value={data.description || ""}
          onChange={(e) => updateData({ description: e.target.value })}
          placeholder="e.g. Sanitizes input parameters and generates slug"
        />
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. INPUT SCHEMA SECTION (Reusing RequestBodyEditor)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <RequestBodyEditor
        title="1. Input Schema"
        subtitle="Parameters passed into the transformer function"
        mode={inputSchemaMode}
        onModeChange={(inputSchemaMode) => updateData({ inputSchemaMode })}
        schema={{
          id: `transformer-in-${node.id}`,
          fields: inputSchema,
          rawJson: data.inputSchemaRawJson || "",
        }}
        onSchemaChange={(s: Schema) =>
          updateData({
            inputSchema: s.fields || [],
            inputSchemaRawJson: s.rawJson || "",
          })
        }
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. TRANSFORMATION LOGIC SECTION (BusinessLogicBlock)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <BusinessLogicBlock
          mode={logicMode}
          onModeChange={(m) => updateData({ logicMode: m })}
          prompt={data.prompt || ""}
          onPromptChange={(prompt) => updateData({ prompt })}
          code={data.code || ""}
          onCodeChange={(code) => updateData({ code })}
          title="2. Transformation Logic"
          description="Pure TypeScript function body or natural language transformation instructions."
          promptPlaceholder="Describe how the input fields should be mapped and transformed into the return fields..."
          codePlaceholder={`return {\n  result: input.name.toLowerCase().replace(/\\s+/g, '-'),\n};`}
          codeLanguageLabel="TypeScript Function Body"
        />

        <label className="flex items-center gap-2 text-[11px] text-muted-foreground/80 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            className="rounded"
            checked={!!data.isAsync}
            onChange={(e) => updateData({ isAsync: e.target.checked })}
          />
          <span>async function (returns Promise)</span>
        </label>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. RETURN SCHEMA SECTION (Reusing RequestBodyEditor)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <RequestBodyEditor
        title="3. Return Schema"
        subtitle="Return object shape produced by the transformer"
        mode={returnSchemaMode}
        onModeChange={(returnSchemaMode) => updateData({ returnSchemaMode })}
        schema={{
          id: `transformer-out-${node.id}`,
          fields: returnSchema,
          rawJson: data.returnSchemaRawJson || "",
        }}
        onSchemaChange={(s: Schema) =>
          updateData({
            returnSchema: s.fields || [],
            returnSchemaRawJson: s.rawJson || "",
          })
        }
      />
    </div>
  );
};
