import React, { useMemo, useCallback, useState } from "react";
import {
  Shuffle,
  Link2,
  Trash2,
  Plus,
  Sparkles,
  Variable,
  ArrowRight,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@workspace/ui/components/select";
import { LocalInput } from "../../../../../common";
import type {
  LangGraphNodePipelineStep,
  PipelineStepInputBinding,
  LangGraphStateChannel,
  LangGraphCanvasNode,
  TransformerCanvasNode,
  TransformerRefCanvasNode,
  AgentNodeData,
} from "@workspace/canvas";
import {
  isTransformerCanvasNode,
  isTransformerRefCanvasNode,
} from "@workspace/canvas";
import { parseSchemaJsonToFields } from "./AgentStructuredOutputSection";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentTransformerStepSectionProps {
  step: LangGraphNodePipelineStep;
  priorSteps: LangGraphNodePipelineStep[];
  stateChannels: LangGraphStateChannel[];
  nodes: LangGraphCanvasNode[];
  onUpdateStep: (updated: LangGraphNodePipelineStep) => void;
  selectedAgentData?: AgentNodeData;
}

interface StepOutputFieldOption {
  path: string;
  label: string;
  type?: string;
  description?: string;
}

interface PriorStepInfo {
  step: LangGraphNodePipelineStep;
  index: number;
  outputVariable: string;
  label: string;
  fields: StepOutputFieldOption[];
}

/**
 * Derives the typed output fields available from a prior step.
 */
function getPriorStepOutputFields(
  priorStep: LangGraphNodePipelineStep,
  selectedAgentData?: AgentNodeData,
  nodes: LangGraphCanvasNode[] = [],
): StepOutputFieldOption[] {
  const fields: StepOutputFieldOption[] = [];
  const outVar =
    priorStep.outputVariable ||
    (priorStep.type === "llm_call" ? "response" : priorStep.id);

  // 1. Whole Output Object
  fields.push({
    path: "",
    label: `${outVar} (Whole Output)`,
    type: "object",
  });

  if (priorStep.type === "llm_call") {
    // If structured output is enabled on the agent, extract JSON Schema fields
    if (
      selectedAgentData?.responseFormat?.enabled &&
      selectedAgentData.responseFormat.schemaJson
    ) {
      const { fields: schemaFields } = parseSchemaJsonToFields(
        selectedAgentData.responseFormat.schemaJson,
      );
      for (const sf of schemaFields) {
        if (!sf.name?.trim()) continue;
        fields.push({
          path: sf.name.trim(),
          label: `${sf.name} (${sf.type || "string"})`,
          type: sf.type || "string",
          description: sf.description,
        });
      }
    }

    // Standard LLM message output fields
    fields.push(
      { path: "content", label: "content (AI Response Text)", type: "string" },
      { path: "role", label: "role (string)", type: "string" },
      { path: "tool_calls", label: "tool_calls (array)", type: "array" },
    );
    return fields;
  }

  if (priorStep.type === "transformer" || priorStep.type === "transform") {
    if (priorStep.outputSchema && priorStep.outputSchema.length > 0) {
      for (const f of priorStep.outputSchema) {
        if (!f.name?.trim()) continue;
        fields.push({
          path: f.name.trim(),
          label: `${f.name} (${f.type || "string"})`,
          type: f.type || "string",
        });
      }
      return fields;
    }

    const sourceNodeId = priorStep.transformerNodeId || priorStep.transformerRef;
    if (sourceNodeId) {
      const masterNode = nodes.find(
        (n): n is TransformerCanvasNode =>
          isTransformerCanvasNode(n) && n.id === sourceNodeId,
      );
      if (masterNode?.data?.returnSchema && masterNode.data.returnSchema.length > 0) {
        for (const f of masterNode.data.returnSchema) {
          if (!f.name?.trim()) continue;
          fields.push({
            path: f.name.trim(),
            label: `${f.name} (${f.type || "string"})`,
            type: f.type || "string",
          });
        }
        return fields;
      }
    }

    fields.push({ path: "result", label: "result (any)", type: "any" });
    return fields;
  }

  if (priorStep.type === "custom_code") {
    fields.push({ path: "result", label: "result (object)", type: "object" });
  }

  return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AgentTransformerStepSection({
  step,
  priorSteps,
  stateChannels,
  nodes,
  onUpdateStep,
  selectedAgentData,
}: AgentTransformerStepSectionProps) {
  const [customFieldMode, setCustomFieldMode] = useState<Record<number, boolean>>({});

  // ─── Available Canvas Transformers ────────────────────────────────────────
  const availableTransformers = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      isRef: boolean;
      masterNode?: TransformerCanvasNode;
    }> = [];

    for (const n of nodes) {
      if (isTransformerCanvasNode(n)) {
        list.push({
          id: n.id,
          label: n.data.functionName || n.data.label || n.id,
          isRef: false,
          masterNode: n,
        });
      } else if (isTransformerRefCanvasNode(n)) {
        const master = nodes.find(
          (m): m is TransformerCanvasNode =>
            isTransformerCanvasNode(m) && m.id === n.data.transformerRef,
        );
        list.push({
          id: n.id,
          label: n.data.label || n.id,
          isRef: true,
          masterNode: master,
        });
      }
    }
    return list;
  }, [nodes]);

  // Selected transformer node
  const selectedTransformer = useMemo(() => {
    const currentId = step.transformerNodeId || step.transformerRef;
    if (currentId) {
      const match = availableTransformers.find((t) => t.id === currentId);
      if (match) return match;
    }
    // Default to first available if not set yet
    return availableTransformers[0];
  }, [availableTransformers, step.transformerNodeId, step.transformerRef]);

  const selectedMasterNode = selectedTransformer?.masterNode;

  // Expected input schema from the selected canvas transformer
  const expectedParams = useMemo(() => {
    return selectedMasterNode?.data.inputSchema || [];
  }, [selectedMasterNode]);

  // Return schema from the selected canvas transformer
  const returnSchema = useMemo(() => {
    return selectedMasterNode?.data.returnSchema || [];
  }, [selectedMasterNode]);

  // ─── Switch Selected Canvas Transformer ──────────────────────────────────
  const handleSelectTransformer = useCallback(
    (transformerId: string) => {
      const target = availableTransformers.find((t) => t.id === transformerId);
      if (!target) return;

      const master = target.masterNode;
      const targetReturnSchema = (master?.data.returnSchema || []).map((r) => ({
        name: r.name,
        type: r.type || "string",
        required: r.required ?? true,
      }));
      const targetInputSchema = master?.data.inputSchema || [];

      // Automatically map input parameters from the transformer schema
      const existingBindings = step.inputBindings || [];
      const nextBindings: PipelineStepInputBinding[] = targetInputSchema.map((param) => {
        const match = existingBindings.find(
          (b) => b.argName.toLowerCase() === param.name.toLowerCase(),
        );
        if (match) return match;

        // Auto-bind to prior step if available
        const firstPrior = priorSteps[0];
        return {
          argName: param.name,
          source: firstPrior
            ? {
                kind: "step_output",
                stepId:
                  firstPrior.outputVariable ||
                  (firstPrior.type === "llm_call" ? "response" : firstPrior.id),
                field: param.name,
              }
            : { kind: "inline", value: "" },
        };
      });

      onUpdateStep({
        ...step,
        transformerNodeId: target.isRef ? undefined : target.id,
        transformerRef: target.isRef ? target.id : undefined,
        customCode: undefined, // no inline code
        functionRef: {
          name: master?.data.functionName || target.label,
          importPath:
            master?.data.scope === "global"
              ? "@workspace/transformers"
              : `../transformers/${master?.data.functionName || target.label}`,
        },
        outputSchema:
          targetReturnSchema.length > 0
            ? targetReturnSchema
            : [{ name: "result", type: "string", required: true }],
        inputBindings: nextBindings.length > 0 ? nextBindings : step.inputBindings,
      });
    },
    [availableTransformers, onUpdateStep, priorSteps, step],
  );

  // ─── Input Bindings Handlers ──────────────────────────────────────────────
  const bindings: PipelineStepInputBinding[] = step.inputBindings || [];

  const handleAddBinding = useCallback(() => {
    const nextArgNum = bindings.length + 1;
    const defaultPrior = priorSteps[0];
    const newBinding: PipelineStepInputBinding = {
      argName: `arg${nextArgNum}`,
      source: defaultPrior
        ? {
            kind: "step_output",
            stepId:
              defaultPrior.outputVariable ||
              (defaultPrior.type === "llm_call" ? "response" : defaultPrior.id),
            field: "content",
          }
        : stateChannels.length > 0 && stateChannels[0]
          ? {
              kind: "state",
              field: stateChannels[0].key,
            }
          : {
              kind: "inline",
              value: "",
            },
    };

    onUpdateStep({
      ...step,
      customCode: undefined,
      inputBindings: [...bindings, newBinding],
    });
  }, [bindings, onUpdateStep, priorSteps, stateChannels, step]);

  const handleUpdateBinding = useCallback(
    (index: number, updated: PipelineStepInputBinding) => {
      const next = [...bindings];
      next[index] = updated;
      onUpdateStep({
        ...step,
        customCode: undefined,
        inputBindings: next,
      });
    },
    [bindings, onUpdateStep, step],
  );

  const handleRemoveBinding = useCallback(
    (index: number) => {
      const next = bindings.filter((_, i) => i !== index);
      onUpdateStep({
        ...step,
        customCode: undefined,
        inputBindings: next,
      });
    },
    [bindings, onUpdateStep, step],
  );

  // ─── Prior Steps Introspection ───────────────────────────────────────────
  const priorStepsInfo: PriorStepInfo[] = useMemo(() => {
    return priorSteps.map((ps, idx) => {
      const outVar =
        ps.outputVariable || (ps.type === "llm_call" ? "response" : ps.id);
      const fields = getPriorStepOutputFields(ps, selectedAgentData, nodes);
      return {
        step: ps,
        index: idx + 1,
        outputVariable: outVar,
        label: ps.label || ps.type,
        fields,
      };
    });
  }, [nodes, priorSteps, selectedAgentData]);

  // ─── Auto-Map Arguments from Prior Steps or State ────────────────────────
  const handleAutoMapArguments = useCallback(() => {
    const targetParams =
      expectedParams.length > 0
        ? expectedParams
        : bindings.map((b) => ({ name: b.argName, type: "string" }));

    if (targetParams.length === 0) return;

    const nextBindings: PipelineStepInputBinding[] = [];

    for (const param of targetParams) {
      if (!param || !param.name) continue;
      const cleanParamName = param.name.trim();
      const lowerParam = cleanParamName.toLowerCase();

      // 1. Search prior steps' typed output fields
      let matchedPriorStepId: string | undefined;
      let matchedField: string | undefined;

      for (const psi of priorStepsInfo) {
        const foundField = psi.fields.find(
          (f) =>
            f.path.toLowerCase() === lowerParam ||
            f.path.toLowerCase().replace(/_/g, "") ===
              lowerParam.replace(/_/g, ""),
        );
        if (foundField && foundField.path) {
          matchedPriorStepId = psi.outputVariable;
          matchedField = foundField.path;
          break;
        }
      }

      // 2. Search state channels
      const matchingStateChannel = stateChannels.find(
        (sc) =>
          sc.key.toLowerCase() === lowerParam ||
          sc.key.toLowerCase().replace(/_/g, "") ===
            lowerParam.replace(/_/g, ""),
      );

      if (matchedPriorStepId && matchedField) {
        nextBindings.push({
          argName: cleanParamName,
          source: {
            kind: "step_output",
            stepId: matchedPriorStepId,
            field: matchedField,
          },
        });
      } else if (matchingStateChannel) {
        nextBindings.push({
          argName: cleanParamName,
          source: {
            kind: "state",
            field: matchingStateChannel.key,
          },
        });
      } else if (
        priorStepsInfo.length > 0 &&
        priorStepsInfo[priorStepsInfo.length - 1]
      ) {
        const lastPsi = priorStepsInfo[priorStepsInfo.length - 1]!;
        nextBindings.push({
          argName: cleanParamName,
          source: {
            kind: "step_output",
            stepId: lastPsi.outputVariable,
            field: lastPsi.fields.some((f) => f.path === "content")
              ? "content"
              : "",
          },
        });
      } else {
        nextBindings.push({
          argName: cleanParamName,
          source: {
            kind: "inline",
            value: "",
          },
        });
      }
    }

    if (nextBindings.length > 0) {
      onUpdateStep({
        ...step,
        customCode: undefined,
        inputBindings: nextBindings,
      });
    }
  }, [bindings, expectedParams, onUpdateStep, priorStepsInfo, stateChannels, step]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* ─── 1. Select Canvas Transformer ─────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5 text-purple-400" />
            Select Transformer
          </Label>
          {expectedParams.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAutoMapArguments}
              className="h-5 text-[10px] px-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-1 cursor-pointer"
              title="Automatically map arguments matching schema parameters"
            >
              <Sparkles className="w-3 h-3" /> Auto-Map Inputs
            </Button>
          )}
        </div>

        {availableTransformers.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-border/60 bg-secondary/15 flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>No Transformer Nodes Found on Canvas</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Add a Transformer node to your canvas from the left sidebar to connect its logic here.
            </p>
          </div>
        ) : (
          <Select
            value={selectedTransformer?.id || ""}
            onValueChange={handleSelectTransformer}
          >
            <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60 font-mono">
              <SelectValue placeholder="Choose a transformer..." />
            </SelectTrigger>
            <SelectContent className="z-50">
              {availableTransformers.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-semibold text-foreground">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({t.masterNode?.data.inputSchema?.length || 0} in &rarr;{" "}
                      {t.masterNode?.data.returnSchema?.length || 0} out)
                    </span>
                    {t.isRef && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-purple-500/30 text-purple-300">
                        Ref
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ─── 2. Output Variable Name ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Variable className="w-3.5 h-3.5 text-purple-400" />
            Output Variable Name
          </Label>
          <span className="text-[10px] font-mono text-purple-400/80">
            Exported to pipeline context
          </span>
        </div>
        <LocalInput
          value={step.outputVariable || ""}
          onChange={(e) => {
            const clean = e.target.value.replace(/[^a-zA-Z0-9_$]/g, "_");
            onUpdateStep({ ...step, customCode: undefined, outputVariable: clean });
          }}
          placeholder="e.g. transformedData, userProfile, processedItems"
          className="h-7 text-xs font-mono bg-background/60 border-purple-500/30 focus:border-purple-400"
        />
        <span className="text-[10px] text-muted-foreground/75 leading-tight">
          Subsequent steps below and graph state updates can bind to{" "}
          <code className="text-purple-300 font-mono">
            {step.outputVariable || "transformedData"}
          </code>{" "}
          via <code className="text-purple-300 font-mono">step_output</code>.
        </span>
      </div>

      {/* ─── 3. Input & Argument Bindings (Top Step Output -> Transformer) ─── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
              Input / Argument Bindings
            </Label>
            {bindings.length > 0 && (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 h-4 border-purple-500/30 text-purple-400 font-mono"
              >
                {bindings.length}
              </Badge>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddBinding}
            className="h-6 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Argument
          </Button>
        </div>

        {priorSteps.length === 0 && stateChannels.length === 0 ? (
          <div className="p-2.5 rounded-lg border border-dashed border-border/40 bg-secondary/10 text-center text-[11px] text-muted-foreground">
            No prior steps or state channels available yet to map inputs from.
          </div>
        ) : bindings.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-border/40 bg-secondary/10 text-center flex flex-col items-center justify-center gap-1">
            <span className="text-[11px] text-muted-foreground">
              No argument bindings configured yet.
            </span>
            <span className="text-[10px] text-muted-foreground/60 max-w-[280px]">
              Map outputs from top steps (e.g. LLM Agent response) or graph state channels into this transformer.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBinding}
              className="mt-1 h-6 text-[10px] border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-1"
            >
              <Plus className="w-3 h-3" /> Map First Argument
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {bindings.map((binding, bIdx) => {
              const currentKind = binding.source.kind;
              const expectedParam = expectedParams.find(
                (p) => p.name.toLowerCase() === binding.argName.toLowerCase(),
              );

              const selectedStepId =
                "stepId" in binding.source ? binding.source.stepId : "";
              const activePriorStepInfo =
                priorStepsInfo.find(
                  (psi) =>
                    psi.outputVariable === selectedStepId ||
                    psi.step.id === selectedStepId,
                ) || priorStepsInfo[0];

              const currentField =
                "field" in binding.source ? binding.source.field || "" : "";
              const isCustomField = Boolean(
                customFieldMode[bIdx] ||
                  (currentField &&
                    activePriorStepInfo &&
                    !activePriorStepInfo.fields.some(
                      (f) => f.path === currentField,
                    )),
              );

              return (
                <div
                  key={`binding_${bIdx}`}
                  className="flex flex-col gap-2 p-2.5 rounded-lg bg-secondary/20 border border-border/50 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    {/* Argument Name */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        arg:
                      </span>
                      <LocalInput
                        value={binding.argName}
                        onChange={(e) =>
                          handleUpdateBinding(bIdx, {
                            ...binding,
                            argName: e.target.value.replace(
                              /[^a-zA-Z0-9_$]/g,
                              "_",
                            ),
                          })
                        }
                        placeholder="parameterName"
                        className="h-6 text-[11px] font-mono font-medium bg-background/50 border-border/40 flex-1 truncate"
                        title="Argument name in transformer function"
                      />
                      {expectedParam?.type && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-4 border-purple-500/30 text-purple-300 font-mono shrink-0"
                        >
                          {expectedParam.type}
                        </Badge>
                      )}
                    </div>

                    <span className="text-muted-foreground/60 text-[10px] font-mono shrink-0 select-none">
                      &larr;
                    </span>

                    {/* Source Kind Selector */}
                    <div className="w-[125px] shrink-0">
                      <Select
                        value={currentKind}
                        onValueChange={(newKind) => {
                          if (newKind === "step_output") {
                            const firstPrior = priorStepsInfo[0];
                            const defaultField = firstPrior?.fields.some(
                              (f) => f.path === "content",
                            )
                              ? "content"
                              : firstPrior?.fields[1]?.path || "";
                            handleUpdateBinding(bIdx, {
                              ...binding,
                              source: {
                                kind: "step_output",
                                stepId:
                                  firstPrior?.outputVariable ||
                                  firstPrior?.step.id ||
                                  "response",
                                field: defaultField,
                              },
                            });
                          } else if (newKind === "state") {
                            const firstChannel = stateChannels[0];
                            handleUpdateBinding(bIdx, {
                              ...binding,
                              source: {
                                kind: "state",
                                field: firstChannel?.key || "messages",
                              },
                            });
                          } else if (newKind === "inline") {
                            handleUpdateBinding(bIdx, {
                              ...binding,
                              source: {
                                kind: "inline",
                                value: "",
                              },
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-6 text-[10px] bg-background/50 border-border/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          <SelectItem value="step_output" className="text-xs">
                            Step Output
                          </SelectItem>
                          <SelectItem value="state" className="text-xs">
                            Graph State
                          </SelectItem>
                          <SelectItem value="inline" className="text-xs">
                            Inline Value
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delete Binding */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveBinding(bIdx)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                      title="Remove argument binding"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* ─── Source Value Details ──────────────────────────────── */}
                  <div className="flex items-center gap-1.5 pl-5">
                    {/* CASE 1: Step Output (Top Step -> Below Step) */}
                    {currentKind === "step_output" && (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {/* 1. Prior Top Step Selector */}
                        <div className="flex-1 min-w-0">
                          <Select
                            value={
                              selectedStepId ||
                              (activePriorStepInfo?.outputVariable ?? "")
                            }
                            onValueChange={(val) => {
                              const targetPsi = priorStepsInfo.find(
                                (p) =>
                                  p.outputVariable === val ||
                                  p.step.id === val,
                              );
                              const defaultField = targetPsi?.fields.some(
                                (f) => f.path === "content",
                              )
                                ? "content"
                                : targetPsi?.fields[1]?.path || "";
                              handleUpdateBinding(bIdx, {
                                ...binding,
                                source: {
                                  kind: "step_output",
                                  stepId: val,
                                  field: defaultField,
                                },
                              });
                            }}
                          >
                            <SelectTrigger className="h-6 text-[10px] bg-background/40 border-border/40 truncate font-mono">
                              <SelectValue placeholder="Select top step..." />
                            </SelectTrigger>
                            <SelectContent className="z-50">
                              {priorStepsInfo.map((psi) => (
                                <SelectItem
                                  key={psi.step.id}
                                  value={psi.outputVariable}
                                  className="text-xs font-mono"
                                >
                                  <span>
                                    {psi.index}. {psi.label} ({psi.outputVariable})
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 2. Output Field Selector */}
                        <div className="flex-1 min-w-0">
                          {isCustomField ? (
                            <div className="flex items-center gap-1">
                              <LocalInput
                                value={currentField}
                                onChange={(e) => {
                                  handleUpdateBinding(bIdx, {
                                    ...binding,
                                    source: {
                                      kind: "step_output",
                                      stepId:
                                        selectedStepId ||
                                        (activePriorStepInfo?.outputVariable ??
                                          "response"),
                                      field: e.target.value.trim() || undefined,
                                    },
                                  });
                                }}
                                placeholder="nested.field.path"
                                className="h-6 text-[10px] font-mono bg-background/40 border-border/40 flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setCustomFieldMode((prev) => ({
                                    ...prev,
                                    [bIdx]: false,
                                  }))
                                }
                                className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-foreground"
                                title="Switch back to predefined fields"
                              >
                                Presets
                              </Button>
                            </div>
                          ) : (
                            <Select
                              value={currentField || "__whole__"}
                              onValueChange={(fVal) => {
                                if (fVal === "__custom_path__") {
                                  setCustomFieldMode((prev) => ({
                                    ...prev,
                                    [bIdx]: true,
                                  }));
                                  return;
                                }
                                handleUpdateBinding(bIdx, {
                                  ...binding,
                                  source: {
                                    kind: "step_output",
                                    stepId:
                                      selectedStepId ||
                                      (activePriorStepInfo?.outputVariable ??
                                        "response"),
                                    field: fVal === "__whole__" ? "" : fVal,
                                  },
                                });
                              }}
                            >
                              <SelectTrigger className="h-6 text-[10px] bg-background/40 border-border/40 truncate font-mono">
                                <SelectValue placeholder="Select output field..." />
                              </SelectTrigger>
                              <SelectContent className="z-50">
                                {activePriorStepInfo?.fields.map((f, fIdx) => (
                                  <SelectItem
                                    key={`f_${fIdx}_${f.path}`}
                                    value={f.path || "__whole__"}
                                    className="text-xs font-mono"
                                  >
                                    <div className="flex items-center justify-between gap-2 w-full">
                                      <span>{f.label}</span>
                                      {f.type && (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] px-1 py-0 h-3.5 border-border/50 text-muted-foreground"
                                        >
                                          {f.type}
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                                <SelectSeparator />
                                <SelectItem
                                  value="__custom_path__"
                                  className="text-xs font-mono text-purple-400"
                                >
                                  <span>+ Custom field path...</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CASE 2: Graph State */}
                    {currentKind === "state" && (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <Select
                            value={
                              "field" in binding.source ? binding.source.field : ""
                            }
                            onValueChange={(channelKey) => {
                              handleUpdateBinding(bIdx, {
                                ...binding,
                                source: {
                                  kind: "state",
                                  field: channelKey,
                                },
                              });
                            }}
                          >
                            <SelectTrigger className="h-6 text-[10px] bg-background/40 border-border/40 truncate font-mono">
                              <SelectValue placeholder="Select channel..." />
                            </SelectTrigger>
                            <SelectContent className="z-50">
                              {stateChannels.map((sc) => (
                                <SelectItem
                                  key={sc.key}
                                  value={sc.key}
                                  className="text-xs font-mono"
                                >
                                  <span>
                                    {sc.key} ({sc.type})
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* CASE 3: Inline Value */}
                    {currentKind === "inline" && (
                      <div className="flex-1 min-w-0">
                        <LocalInput
                          value={
                            "value" in binding.source
                              ? String(binding.source.value)
                              : ""
                          }
                          onChange={(e) => {
                            handleUpdateBinding(bIdx, {
                              ...binding,
                              source: {
                                kind: "inline",
                                value: e.target.value,
                              },
                            });
                          }}
                          placeholder="literal value"
                          className="h-6 text-[10px] font-mono bg-background/40 border-border/40 flex-1"
                          title="Inline literal string or value"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
