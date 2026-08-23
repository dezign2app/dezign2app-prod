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
import {
  Shuffle,
  Plus,
  Trash2,
} from "lucide-react";
import { BusinessLogicBlock } from "../shared/BusinessLogicBlock";

interface TransformerConfigProps {
  id: string;
  nodeId: string;
}

type SchemaField = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

const TS_TYPES = [
  "string",
  "number",
  "boolean",
  "string[]",
  "number[]",
  "Record<string, unknown>",
  "unknown",
  "Date",
];

const FieldList = ({
  fields,
  onChange,
  placeholder,
}: {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
  placeholder?: string;
}) => {
  const add = () =>
    onChange([...fields, { name: "", type: "string", required: true }]);
  const remove = (idx: number) => onChange(fields.filter((_, i) => i !== idx));
  const update = (idx: number, patch: Partial<SchemaField>) => {
    const next = [...fields];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {fields.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/50 italic py-1">
          No fields defined yet. Click below to add one.
        </div>
      ) : (
        fields.map((f, i) => (
          <div
            key={i}
            className="grid grid-cols-[2fr_1.5fr_auto_auto] gap-1.5 items-center"
          >
            <Input
              className="h-7 text-xs font-mono bg-background/60 border-border/60"
              value={f.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder={placeholder ?? "fieldName"}
            />
            <Select
              value={f.type}
              onValueChange={(v) => update(i, { type: v })}
            >
              <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TS_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${
                f.required === false
                  ? "text-muted-foreground/50 border-border/40"
                  : "text-foreground/80 border-border/60 bg-muted/40"
              }`}
              title={f.required === false ? "optional" : "required"}
              onClick={() => update(i, { required: !f.required })}
            >
              {f.required === false ? "opt" : "req"}
            </button>
            <button
              className="text-muted-foreground/40 hover:text-destructive transition-colors p-1"
              onClick={() => remove(i)}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))
      )}
      <button
        className="flex items-center gap-1 text-[11px] font-medium text-foreground/70 hover:text-foreground transition-colors self-start pt-1"
        onClick={add}
      >
        <Plus size={12} />
        Add field
      </button>
    </div>
  );
};

export const TransformerConfig = ({ id, nodeId }: TransformerConfigProps) => {
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === (nodeId || id)),
  );
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);

  if (!node) return null;

  const data = node.data;
  const targetServiceNodes = allNodes.filter((n) => n.type === "service");

  const inputSchema: SchemaField[] = data.inputSchema || [];
  const returnSchema: SchemaField[] = data.returnSchema || [];
  const logicMode = data.logicMode || "code";
  const scope = data.scope || "global";

  const updateData = (patch: Record<string, unknown>) => {
    updateNode(node.id, {
      data: {
        ...data,
        ...patch,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border/50">
        <div className="p-2.5 rounded-xl bg-secondary/40 text-foreground/80 border border-border/60">
          <Shuffle size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Data Transformer Node
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Pure, reusable data transformation function.
          </p>
        </div>
      </div>

      {/* Function name + Scope */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            Function Name (camelCase)
          </Label>
          <Input
            className="h-8 text-xs font-mono bg-background/60 border-border/60"
            value={data.label || data.functionName || ""}
            onChange={(e) =>
              updateData({
                label: e.target.value,
                functionName: e.target.value,
              })
            }
            placeholder="e.g. slugifyProductInput"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">Scope</Label>
          <Select
            value={scope}
            onValueChange={(v) => updateData({ scope: v as "global" | "local" })}
          >
            <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global (@workspace/transformers)</SelectItem>
              <SelectItem value="local">Local (Single Service)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Target service if scope === 'local' */}
      {scope === "local" && (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            Target Service
          </Label>
          <Select
            value={data.targetServiceId || ""}
            onValueChange={(v) => updateData({ targetServiceId: v })}
          >
            <SelectTrigger className="h-8 text-xs bg-background/60 border-border/60">
              <SelectValue placeholder="Select target service…" />
            </SelectTrigger>
            <SelectContent>
              {targetServiceNodes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.data?.label || s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Description */}
      <div className="flex flex-col gap-1">
        <Label className="text-[11px] text-muted-foreground">Description</Label>
        <Input
          className="h-8 text-xs bg-background/60 border-border/60"
          value={data.description || ""}
          onChange={(e) => updateData({ description: e.target.value })}
          placeholder="Brief description of this transformation"
        />
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. INPUT SCHEMA SECTION                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-secondary/10">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              1. Input Schema
            </span>
            <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
              {inputSchema.length} field{inputSchema.length !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Parameters received by function
          </span>
        </div>
        <FieldList
          fields={inputSchema}
          onChange={(fields) => updateData({ inputSchema: fields })}
          placeholder="argName"
        />
      </div>

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
          codePlaceholder={`return {\n  slug: input.name.toLowerCase().replace(/\\s+/g, '-'),\n};`}
          codeLanguageLabel="TypeScript Function Body"
        />

        <label className="flex items-center gap-2 text-[11px] text-muted-foreground/80 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            className="rounded"
            checked={!!data.isAsync}
            onChange={(e) => updateData({ isAsync: e.target.checked })}
          />
          async function (returns Promise)
        </label>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. RETURN SCHEMA SECTION                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 bg-secondary/10">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              3. Return Schema
            </span>
            <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
              {returnSchema.length} field{returnSchema.length !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Fields returned by function
          </span>
        </div>
        <FieldList
          fields={returnSchema}
          onChange={(fields) => updateData({ returnSchema: fields })}
          placeholder="returnField"
        />
      </div>
    </div>
  );
};
