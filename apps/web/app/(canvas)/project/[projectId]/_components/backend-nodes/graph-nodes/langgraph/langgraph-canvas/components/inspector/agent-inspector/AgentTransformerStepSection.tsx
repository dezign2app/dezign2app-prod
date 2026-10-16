import React, { useMemo, useCallback } from "react";
import {
  Shuffle,
  Link2,
  Code2,
  Trash2,
  Plus,
  Sparkles,
  Variable,
  ArrowRight,
  AlertCircle,
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
} from "@workspace/ui/components/select";
import { LocalInput, LocalTextarea } from "../../../../../common";
import type {
  LangGraphNodePipelineStep,
  PipelineStepInputBinding,
  LangGraphStateChannel,
  LangGraphCanvasNode,
  TransformerCanvasNode,
  TransformerRefCanvasNode,
} from "@workspace/canvas";
import {
  isTransformerCanvasNode,
  isTransformerRefCanvasNode,
} from "@workspace/canvas";

export interface AgentTransformerStepSectionProps {
  step: LangGraphNodePipelineStep;
  priorSteps: LangGraphNodePipelineStep[];
  stateChannels: LangGraphStateChannel[];
  nodes: LangGraphCanvasNode[];
  onUpdateStep: (updated: LangGraphNodePipelineStep) => void;
}

export function AgentTransformerStepSection({
  step,
  priorSteps,
  stateChannels,
  nodes,
  onUpdateStep,
}: AgentTransformerStepSectionProps) {
  // ─── Filter Available Canvas Transformers ─────────────────────────────────
  const masterTransformers = useMemo(() => {
    return nodes.filter(isTransformerCanvasNode);
  }, [nodes]);

  const refTransformers = useMemo(() => {
    return nodes.filter(isTransformerRefCanvasNode);
  }, [nodes]);

  // Determine currently selected source
  const selectedSourceId =
    step.transformerNodeId ||
    step.transformerRef ||
    step.functionRef?.name ||
    "__inline__";

  const selectedMasterNode = useMemo(() => {
    if (selectedSourceId === "__inline__") return undefined;
    const directMaster = masterTransformers.find((m) => m.id === selectedSourceId);
    if (directMaster) return directMaster;

    const directRef = refTransformers.find((r) => r.id === selectedSourceId);
    if (directRef && directRef.data.transformerRef) {
      return masterTransformers.find((m) => m.id === directRef.data.transformerRef);
    }
    return undefined;
  }, [masterTransformers, refTransformers, selectedSourceId]);

  const handleSourceChange = useCallback(
    (sourceVal: string) => {
      if (sourceVal === "__inline__") {
        onUpdateStep({
          ...step,
          transformerNodeId: undefined,
          transformerRef: undefined,
          functionRef: undefined,
          customCode: step.customCode || {
            body: "// TypeScript logic: (inputs, state, clone) => transformed\nreturn {\n  // return transformed fields\n};\n",
          },
        });
        return;
      }

      const isRef = refTransformers.some((r) => r.id === sourceVal);
      if (isRef) {
        const refNode = refTransformers.find((r) => r.id === sourceVal);
        onUpdateStep({
          ...step,
          transformerNodeId: undefined,
          transformerRef: sourceVal,
          functionRef: {
            name: refNode?.data.label || refNode?.data.transformerRef || sourceVal,
          },
        });
      } else {
        const masterNode = masterTransformers.find((m) => m.id === sourceVal);
        onUpdateStep({
          ...step,
          transformerNodeId: sourceVal,
          transformerRef: undefined,
          functionRef: {
            name:
              masterNode?.data.functionName ||
              masterNode?.data.label ||
              sourceVal,
          },
        });
      }
    },
    [masterTransformers, onUpdateStep, refTransformers, step],
  );

  // ─── Input Bindings Handlers ──────────────────────────────────────────────
  const bindings: PipelineStepInputBinding[] = step.inputBindings || [];

  const handleAddBinding = useCallback(() => {
    const newBinding: PipelineStepInputBinding = {
      argName: `arg${bindings.length + 1}`,
      source:
        priorSteps.length > 0 && priorSteps[0]
          ? {
              kind: "step_output",
              stepId: priorSteps[0].outputVariable || priorSteps[0].id,
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
      inputBindings: [...bindings, newBinding],
    });
  }, [bindings, onUpdateStep, priorSteps, stateChannels, step]);

  const handleUpdateBinding = useCallback(
    (index: number, updated: PipelineStepInputBinding) => {
      const next = [...bindings];
      next[index] = updated;
      onUpdateStep({
        ...step,
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
        inputBindings: next,
      });
    },
    [bindings, onUpdateStep, step],
  );

  const handleAutoMapArguments = useCallback(() => {
    if (!selectedMasterNode?.data.inputSchema) return;

    const nextBindings: PipelineStepInputBinding[] = [];
    const schemaParams = selectedMasterNode.data.inputSchema;

    for (let pIdx = 0; pIdx < schemaParams.length; pIdx++) {
      const param = schemaParams[pIdx];
      if (!param || !param.name) continue;

      // Check if any prior step has an outputVariable matching this arg name
      const matchingPriorStep = priorSteps.find(
        (ps) => ps.outputVariable && ps.outputVariable.toLowerCase() === param.name.toLowerCase(),
      );

      // Check if any state channel matches this arg name
      const matchingStateChannel = stateChannels.find(
        (sc) => sc.key.toLowerCase() === param.name.toLowerCase(),
      );

      if (matchingPriorStep) {
        nextBindings.push({
          argName: param.name,
          source: {
            kind: "step_output",
            stepId: matchingPriorStep.outputVariable || matchingPriorStep.id,
          },
        });
      } else if (matchingStateChannel) {
        nextBindings.push({
          argName: param.name,
          source: {
            kind: "state",
            field: matchingStateChannel.key,
          },
        });
      } else if (priorSteps.length > 0 && priorSteps[priorSteps.length - 1]) {
        const lastStep = priorSteps[priorSteps.length - 1];
        if (lastStep) {
          nextBindings.push({
            argName: param.name,
            source: {
              kind: "step_output",
              stepId: lastStep.outputVariable || lastStep.id,
              field: param.name,
            },
          });
        }
      } else {
        nextBindings.push({
          argName: param.name,
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
        inputBindings: nextBindings,
      });
    }
  }, [onUpdateStep, priorSteps, selectedMasterNode, stateChannels, step]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* ─── 1. Output Variable Specification ──────────────────────────────── */}
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
        <div className="flex items-center gap-2">
          <LocalInput
            value={step.outputVariable || ""}
            onChange={(e) => {
              const clean = e.target.value.replace(/[^a-zA-Z0-9_$]/g, "_");
              onUpdateStep({ ...step, outputVariable: clean });
            }}
            placeholder="e.g. transformedData, userProfile, processedItems"
            className="h-7 text-xs font-mono bg-background/60 border-purple-500/30 focus:border-purple-400"
          />
        </div>
        <span className="text-[10px] text-muted-foreground/75 leading-tight">
          Subsequent steps below can bind this variable as an input via{" "}
          <code className="text-purple-300 font-mono">step_output</code>.
        </span>
      </div>

      {/* ─── 2. Transformer Source Selector ─────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5 text-purple-400" />
            Transformer Source
          </Label>
          {selectedMasterNode?.data.inputSchema && selectedMasterNode.data.inputSchema.length > 0 && (
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

        <Select value={selectedSourceId} onValueChange={handleSourceChange}>
          <SelectTrigger className="h-8 text-xs bg-background/50 border-border/60">
            <SelectValue placeholder="Select transformer source..." />
          </SelectTrigger>
          <SelectContent className="z-50">
            <SelectItem value="__inline__" className="text-xs">
              <div className="flex items-center gap-2 font-mono">
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Inline TypeScript Logic (Local to this node)</span>
              </div>
            </SelectItem>

            {masterTransformers.length > 0 && (
              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-border/40 mt-1">
                Canvas Master Transformers
              </div>
            )}
            {masterTransformers.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                <div className="flex items-center gap-2 font-mono">
                  <Shuffle className="w-3.5 h-3.5 text-purple-400" />
                  <span>{m.data.label || m.data.functionName || m.id}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-purple-500/30 text-purple-300">
                    Master
                  </Badge>
                </div>
              </SelectItem>
            ))}

            {refTransformers.length > 0 && (
              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-border/40 mt-1">
                Canvas Transformer References
              </div>
            )}
            {refTransformers.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                <div className="flex items-center gap-2 font-mono">
                  <Link2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>{r.data.label || r.id}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-purple-500/30 text-purple-300">
                    Ref
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedMasterNode && (
          <div className="p-2 rounded-md bg-secondary/20 border border-border/40 flex flex-col gap-1 text-[11px] font-mono">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Function: <strong className="text-purple-300">{selectedMasterNode.data.functionName || selectedMasterNode.data.label}</strong></span>
              <span className="text-[10px] uppercase text-muted-foreground">{selectedMasterNode.data.scope || "global"}</span>
            </div>
            {selectedMasterNode.data.code && (
              <div className="text-[10px] text-muted-foreground/70 truncate bg-background/40 p-1 rounded border border-border/30">
                {selectedMasterNode.data.code.slice(0, 70).replace(/[\r\n]+/g, " ")}...
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. Inline Code Body (When Inline Selected) ───────────────────────── */}
      {selectedSourceId === "__inline__" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              TypeScript Logic
            </Label>
            <span className="text-[10px] text-muted-foreground font-mono">
              (inputs, state, clone) =&gt; transformed
            </span>
          </div>
          <LocalTextarea
            value={step.customCode?.body || ""}
            onChange={(e) =>
              onUpdateStep({
                ...step,
                customCode: { body: e.target.value },
              })
            }
            placeholder={`// Example: process mapped inputs or mutate state\nconst { text } = inputs;\nreturn {\n  summary: text ? text.slice(0, 100) : "No text",\n  timestamp: Date.now()\n};`}
            className="text-xs min-h-[110px] font-mono bg-background/60 border border-border/60 rounded-md p-2.5 resize-y leading-relaxed"
          />
        </div>
      )}

      {/* ─── 4. Input & Argument Bindings (Above Steps -> Below Steps) ───────── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
              Input / Argument Bindings
            </Label>
            {bindings.length > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-purple-500/30 text-purple-400 font-mono">
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
          <div className="p-2 rounded-lg border border-dashed border-border/40 bg-secondary/10 text-center text-[11px] text-muted-foreground">
            No prior steps or state channels available yet to map inputs from.
          </div>
        ) : bindings.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-border/40 bg-secondary/10 text-center flex flex-col items-center justify-center gap-1">
            <span className="text-[11px] text-muted-foreground">
              No argument bindings configured yet.
            </span>
            <span className="text-[10px] text-muted-foreground/60 max-w-[260px]">
              Map outputs from above steps (e.g. LLM Agent response) or graph state channels directly into this transformer.
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

              return (
                <div
                  key={`binding_${bIdx}`}
                  className="flex flex-col gap-1.5 p-2 rounded-lg bg-secondary/20 border border-border/50 text-xs"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    {/* Argument Name */}
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        arg:
                      </span>
                      <LocalInput
                        value={binding.argName}
                        onChange={(e) =>
                          handleUpdateBinding(bIdx, {
                            ...binding,
                            argName: e.target.value.replace(/[^a-zA-Z0-9_$]/g, "_"),
                          })
                        }
                        placeholder="argumentName"
                        className="h-6 text-[11px] font-mono font-medium bg-background/50 border-border/40 flex-1 truncate"
                        title="Argument name in transformer function"
                      />
                    </div>

                    <span className="text-muted-foreground/60 text-[10px] font-mono shrink-0">
                      &larr;
                    </span>

                    {/* Source Kind Selector */}
                    <div className="w-[120px] shrink-0">
                      <Select
                        value={currentKind}
                        onValueChange={(newKind) => {
                          if (newKind === "step_output") {
                            const firstPrior = priorSteps[0];
                            handleUpdateBinding(bIdx, {
                              ...binding,
                              source: {
                                kind: "step_output",
                                stepId: firstPrior?.outputVariable || firstPrior?.id || "step_1",
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
                          } else if (newKind === "env") {
                            handleUpdateBinding(bIdx, {
                              ...binding,
                              source: {
                                kind: "env",
                                field: "API_KEY",
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
                          <SelectItem value="env" className="text-xs">
                            Env Var
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

                  {/* Source Value Details (Dependent on Kind) */}
                  <div className="flex items-center gap-1.5 pl-5">
                    {currentKind === "step_output" && (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {/* Prior Step Selector */}
                        <div className="flex-1 min-w-0">
                          <Select
                            value={"stepId" in binding.source ? binding.source.stepId : ""}
                            onValueChange={(val) => {
                              handleUpdateBinding(bIdx, {
                                ...binding,
                                source: {
                                  kind: "step_output",
                                  stepId: val,
                                  field: "field" in binding.source ? binding.source.field : undefined,
                                },
                              });
                            }}
                          >
                            <SelectTrigger className="h-6 text-[10px] bg-background/40 border-border/40 truncate font-mono">
                              <SelectValue placeholder="Select prior step..." />
                            </SelectTrigger>
                            <SelectContent className="z-50">
                              {priorSteps.map((ps, psIdx) => (
                                <SelectItem
                                  key={ps.id}
                                  value={ps.outputVariable || ps.id}
                                  className="text-xs font-mono"
                                >
                                  <span>
                                    {psIdx + 1}. {ps.label || ps.type}{" "}
                                    {ps.outputVariable ? `(${ps.outputVariable})` : ""}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Optional Subfield Path */}
                        <div className="w-[110px] shrink-0">
                          <LocalInput
                            value={"field" in binding.source && binding.source.field ? binding.source.field : ""}
                            onChange={(e) => {
                              const stepId = "stepId" in binding.source ? binding.source.stepId : "";
                              handleUpdateBinding(bIdx, {
                                ...binding,
                                source: {
                                  kind: "step_output",
                                  stepId,
                                  field: e.target.value.trim() || undefined,
                                },
                              });
                            }}
                            placeholder="path (optional)"
                            className="h-6 text-[10px] font-mono bg-background/40 border-border/40"
                            title="Optional subfield path e.g. user.name or response"
                          />
                        </div>
                      </div>
                    )}

                    {currentKind === "state" && (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {/* State Channel Selector */}
                        <div className="flex-1 min-w-0">
                          <Select
                            value={"field" in binding.source ? binding.source.field : ""}
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
                                <SelectItem key={sc.key} value={sc.key} className="text-xs font-mono">
                                  <span>{sc.key} ({sc.type})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {currentKind === "inline" && (
                      <div className="flex-1 min-w-0">
                        <LocalInput
                          value={"value" in binding.source ? String(binding.source.value) : ""}
                          onChange={(e) => {
                            handleUpdateBinding(bIdx, {
                              ...binding,
                              source: {
                                kind: "inline",
                                value: e.target.value,
                              },
                            });
                          }}
                          placeholder="literal value or ${state.var}"
                          className="h-6 text-[10px] font-mono bg-background/40 border-border/40 flex-1"
                          title="Inline literal string or interpolated expression"
                        />
                      </div>
                    )}

                    {currentKind === "env" && (
                      <div className="flex-1 min-w-0">
                        <LocalInput
                          value={"field" in binding.source && binding.source.field ? binding.source.field : ""}
                          onChange={(e) => {
                            handleUpdateBinding(bIdx, {
                              ...binding,
                              source: {
                                kind: "env",
                                field: e.target.value.trim(),
                              },
                            });
                          }}
                          placeholder="ENV_VARIABLE_NAME"
                          className="h-6 text-[10px] font-mono bg-background/40 border-border/40 flex-1"
                          title="Process environment variable"
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
