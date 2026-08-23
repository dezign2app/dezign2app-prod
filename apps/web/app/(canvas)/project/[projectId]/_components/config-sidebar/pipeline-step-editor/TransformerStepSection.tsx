"use client";

import React, { useMemo } from "react";
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
import { Shuffle, Plus, Sparkles, ExternalLink } from "lucide-react";
import {
  PipelineStepDraft,
  AvailableTransformer,
  ExpectedArg,
} from "./types";
import { generateId } from "./utils";
import { toVarName } from "@/lib/compiler/utils";


export interface TransformerStepSectionProps {
  step: PipelineStepDraft;
  availableTransformers: AvailableTransformer[];
  serviceNodeId?: string;
  endpointId?: string;
  expectedArgs: ExpectedArg[];
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments: () => void;
  onPopulateAllExpectedArgs: () => void;
}

export const TransformerStepSection = ({
  step,
  availableTransformers,
  serviceNodeId,
  endpointId,
  expectedArgs,
  onChange,
  onAutoMapArguments,
  onPopulateAllExpectedArgs,
}: TransformerStepSectionProps) => {
  const serviceTransformers = useMemo(
    () => availableTransformers.filter((t) => t.sourceType === "service_helper"),
    [availableTransformers],
  );

  const canvasTransformers = useMemo(
    () => availableTransformers.filter((t) => t.sourceType === "canvas_node"),
    [availableTransformers],
  );

  const selectedTransformer = useMemo(() => {
    return availableTransformers.find(
      (t) =>
        t.name === step.functionRef?.name ||
        t.id === step.functionRef?.name,
    );
  }, [step.functionRef?.name, availableTransformers]);

  const selectedTransformerOptionId = useMemo(() => {
    if (selectedTransformer) return selectedTransformer.id;
    if (step.functionRef?.name) return "__custom__";
    return undefined;
  }, [selectedTransformer, step.functionRef?.name]);

  const handleSelectTransformer = (transformerId: string) => {
    if (transformerId === "__custom__") {
      onChange({
        ...step,
        functionRef: {
          name: step.functionRef?.name || "transformData",
          importPath: step.functionRef?.importPath || "@workspace/transformers",
        },
      });
      return;
    }

    const t = availableTransformers.find((tr) => tr.id === transformerId || tr.name === transformerId);
    if (!t) return;

    const defaultOutputVar =
      step.outputVariable && !step.outputVariable.startsWith("step")
        ? step.outputVariable
        : `${toVarName(t.name)}Result`;

    onChange({
      ...step,
      name: defaultOutputVar,
      outputVariable: defaultOutputVar,
      functionRef: {
        name: t.name,
        importPath: t.importPath,
      },
      outputSchema: t.returnSchema.map((r) => ({
        name: r.name,
        type: r.type,
        required: r.required,
      })),
    });
  };

  /**
   * Directly creates a new Transformer node on the canvas and opens its configuration sidebar.
   */
  const handleCreateTransformerNode = () => {
    const store = useBackendCanvasStore.getState();
    const serviceNode = store.nodes.find((n) => n.id === serviceNodeId);

    const position = serviceNode?.position
      ? { x: serviceNode.position.x + 360, y: serviceNode.position.y + 40 }
      : { x: 250, y: 250 };

    const id = generateId();
    const existingTransformersCount = store.nodes.filter((n) => n.type === "transformer").length;
    const fnName = `transformData${existingTransformersCount + 1}`;

    // 1. Add transformer node to canvas
    store.addNode({
      id,
      type: "transformer",
      position,
      data: {
        label: fnName,
        functionName: fnName,
        description: `Transformer for ${serviceNode?.data?.label || "Service"}`,
        scope: "local",
        targetServiceId: serviceNodeId,
        targetEndpointId: endpointId,
        inputSchema: [{ name: "input", type: "string", required: true }],
        returnSchema: [{ name: "result", type: "string", required: true }],
        logicMode: "code",
        code: "return {\n  result: String(input)\n};",
        isAsync: false,
      },
    });


    // 2. Bind current pipeline step to this new transformer
    const defaultOutputVar = `${fnName}Result`;
    onChange({
      ...step,
      name: defaultOutputVar,
      outputVariable: defaultOutputVar,
      functionRef: {
        name: fnName,
        importPath: `./transformers/${fnName}`,
      },
      outputSchema: [{ name: "result", type: "string", required: true }],
    });

    // 3. Immediately open the transformer configuration sidebar
    store.setActiveConfigItem({
      type: "transformer",
      id,
      nodeId: id,
    });
  };

  const handleOpenTransformerConfig = () => {
    if (!selectedTransformer?.nodeId) return;
    useBackendCanvasStore.getState().setActiveConfigItem({
      type: "transformer",
      id: selectedTransformer.nodeId,
      nodeId: selectedTransformer.nodeId,
    });
  };

  return (
    <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-purple-500/25 bg-purple-500/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
          <Shuffle size={13} />
          <span>Data Transformer Function</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 px-2 py-0.5 rounded transition-colors"
          onClick={handleCreateTransformerNode}
          title="Add a Transformer node to canvas and configure it"
        >
          <Plus size={10} />
          Create Transformer
        </button>
      </div>

      {/* Transformer Selector */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Shuffle size={10} /> Select Transformer
        </Label>
        <Select
          value={selectedTransformerOptionId || "__custom__"}
          onValueChange={handleSelectTransformer}
        >
          <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
            <SelectValue placeholder="Choose a transformer..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__custom__" className="text-xs text-muted-foreground font-sans">
              ✏️ Manual / External Import
            </SelectItem>

            {serviceTransformers.length > 0 && (
              <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Service Helpers
              </div>
            )}
            {serviceTransformers.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                <span className="font-semibold text-purple-300">{t.name}</span>
                <span className="text-[8px] ml-1.5 px-1 py-0.2 rounded font-sans uppercase text-muted-foreground/80 bg-muted/60">
                  {t.scope}
                </span>
                <span className="text-[9px] text-muted-foreground/60 ml-1">
                  ({t.inputSchema.length} in → {t.returnSchema.length} out)
                </span>
              </SelectItem>
            ))}

            {canvasTransformers.length > 0 && (
              <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Canvas Transformer Nodes
              </div>
            )}
            {canvasTransformers.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                <span className="font-semibold text-purple-300">{t.name}</span>
                <span className="text-[8px] ml-1.5 px-1 py-0.2 rounded font-sans uppercase text-muted-foreground/80 bg-muted/60">
                  Node ({t.scope})
                </span>
                <span className="text-[9px] text-muted-foreground/60 ml-1">
                  ({t.inputSchema.length} in → {t.returnSchema.length} out)
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Transformer Info Card */}
      {selectedTransformer && (
        <div className="flex flex-col gap-1.5 p-2 rounded bg-background/60 border border-purple-500/20 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-purple-300 font-semibold">
                {selectedTransformer.name}
              </span>
              <span
                className={`text-[8px] font-mono px-1 py-0.2 rounded font-medium ${
                  selectedTransformer.scope === "global"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                }`}
              >
                {selectedTransformer.scope.toUpperCase()}
              </span>

              {selectedTransformer.nodeId && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-[9px] text-purple-300 hover:text-purple-200 hover:underline ml-1"
                  onClick={handleOpenTransformerConfig}
                  title="Open node config sidebar"
                >
                  <ExternalLink size={9} />
                  <span>Configure Node</span>
                </button>
              )}
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/70">
              import from &quot;{selectedTransformer.importPath}&quot;
            </span>
          </div>

          {selectedTransformer.description && (
            <p className="text-[10px] text-muted-foreground/80 italic">
              {selectedTransformer.description}
            </p>
          )}

          {/* Return Schema Summary */}
          {selectedTransformer.returnSchema.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5">
              <span className="text-[9px] text-muted-foreground/70">Returns:</span>
              <div className="flex flex-wrap gap-1">
                {selectedTransformer.returnSchema.map((f) => (
                  <span
                    key={f.name}
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20"
                  >
                    {f.name}: {f.type}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual / External Function Configuration row if custom */}
      {selectedTransformerOptionId === "__custom__" && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-purple-500/15">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Function name</Label>
            <Input
              className="h-7 text-xs font-mono bg-background/60 border-border/60"
              value={step.functionRef?.name ?? ""}
              onChange={(e) =>
                onChange({
                  ...step,
                  functionRef: {
                    ...(step.functionRef ?? { importPath: "@workspace/transformers" }),
                    name: e.target.value,
                  },
                })
              }
              placeholder="e.g. formatUserResponse"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Import path</Label>
            <Input
              className="h-7 text-xs font-mono bg-background/60 border-border/60"
              value={step.functionRef?.importPath ?? ""}
              onChange={(e) =>
                onChange({
                  ...step,
                  functionRef: {
                    ...(step.functionRef ?? { name: "transformData" }),
                    importPath: e.target.value,
                  },
                })
              }
              placeholder="e.g. @workspace/transformers"
            />
          </div>
        </div>
      )}

      {/* Expected arguments preview & quick mapping buttons */}
      {expectedArgs.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-purple-500/15">
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
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                onClick={onAutoMapArguments}
                title="Automatically map matching argument names from request body / params / prior steps"
              >
                <Sparkles size={10} />
                Auto-map matching fields
              </button>
              <button
                type="button"
                className="px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground rounded border border-border/50 hover:bg-muted/40 transition-colors"
                onClick={onPopulateAllExpectedArgs}
                title="Add empty binding rows for all expected fields"
              >
                + Populate all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
