"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Endpoint, BackendNode, BackendEdge } from "@workspace/canvas/types";

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
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
} from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";
import { BindingSourceEditor } from "./BindingSourceEditor";
import { TransformerStepSection } from "./TransformerStepSection";
import { DbOperationStepSection } from "./DbOperationStepSection";
import {
  StepType,
  PipelineStepDraft,
  StepBinding,
} from "./types";
import {
  STEP_TYPE_META,
  ADDABLE_STEP_TYPES,
  getAvailableSources,
  getAvailableTransformers,
} from "./utils";
import { toVarName } from "@/lib/compiler/utils";

function isStepType(val: string): val is StepType {
  return val in STEP_TYPE_META;
}

export interface StepRowProps {
  step: PipelineStepDraft;
  index: number;
  priorSteps: PipelineStepDraft[];
  endpoint?: Endpoint;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  serviceNodeId?: string;
  onChange: (updated: PipelineStepDraft) => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const StepRow = ({
  step,
  index,
  priorSteps,
  endpoint,
  allNodes,
  allEdges,
  serviceNodeId,
  onChange,
  onDelete,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: StepRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const meta = STEP_TYPE_META[step.type] || STEP_TYPE_META.custom_code;

  // Available sources (request body, params, query, headers, prior steps)
  const availableSources = useMemo(
    () => getAvailableSources(endpoint, priorSteps, allNodes),
    [endpoint, priorSteps, allNodes],
  );

  // Available transformers
  const availableTransformers = useMemo(
    () => getAvailableTransformers(allNodes, serviceNodeId, allEdges),
    [allNodes, serviceNodeId, allEdges],
  );

  const selectedTransformer = useMemo(() => {
    if (step.type !== "transform") return undefined;
    return availableTransformers.find(
      (t) =>
        t.name === step.functionRef?.name ||
        t.id === step.functionRef?.name,
    );
  }, [step.type, step.functionRef?.name, availableTransformers]);

  // DB nodes & entities
  const allEntityNodes = useMemo(
    () =>
      allNodes.filter(
        (n) =>
          n.type === "entity" ||
          n.type === "redis_schema" ||
          n.type === "redis-cache" ||
          n.type === "db_ref",
      ),
    [allNodes],
  );

  const selectedDbId = step.databaseId || "all";
  const selectedTableNode = useMemo(
    () => allEntityNodes.find((n) => n.id === step.tableNodeId),
    [allEntityNodes, step.tableNodeId],
  );

  // Expected arguments (for DB Operation or Transform)
  const expectedArgs = useMemo(() => {
    if (step.type === "transform" && selectedTransformer) {
      return selectedTransformer.inputSchema.map((f) => ({
        name: f.name,
        type: f.type || "string",
        required: f.required !== false,
      }));
    }

    if (step.type === "db_operation" && selectedTableNode) {
      const columns = selectedTableNode.data?.columns || [];
      const pkCol = columns.find((c) => c.isPrimaryKey) || columns[0];
      const pkName = pkCol?.name || "id";
      const pkType = pkCol?.type || "string";
      const writableCols = columns.filter((c) => !c.isPrimaryKey);

      const opName = (step.functionRef?.name || step.operationId || "").toLowerCase();
      if (opName.includes("create") || opName.includes("insert")) {
        return writableCols.map((c) => ({
          name: toVarName(c.name),
          type: c.type || "string",
          required: c.isNotNull,
        }));
      }
      if (opName.includes("update")) {
        return [
          { name: toVarName(pkName), type: pkType, required: true },
          ...writableCols.map((c) => ({
            name: toVarName(c.name),
            type: c.type || "string",
            required: false,
          })),
        ];
      }
      if (opName.includes("byid") || opName.includes("findone") || opName.includes("delete")) {
        return [{ name: toVarName(pkName), type: pkType, required: true }];
      }
    }

    return [];
  }, [step.type, selectedTransformer, selectedTableNode, step.functionRef?.name, step.operationId]);

  // -------------------------------------------------------------------------
  // Auto-map arguments from request body / prior steps
  // -------------------------------------------------------------------------
  const handleAutoMapArguments = () => {
    if (expectedArgs.length === 0) return;
    const reqBodySource = availableSources.find((s) => s.kind === "req_body");
    const reqParamsSource = availableSources.find((s) => s.kind === "req_params");
    const reqQuerySource = availableSources.find((s) => s.kind === "req_query");

    const newBindings: StepBinding[] = expectedArgs.map((arg) => {
      // 1. Path param match
      const matchParam = reqParamsSource?.paths.find(
        (p) => p.path.toLowerCase() === arg.name.toLowerCase(),
      );
      if (matchParam) {
        return {
          argName: arg.name,
          source: { kind: "req_params", field: matchParam.path },
        };
      }

      // 2. Query param match
      const matchQuery = reqQuerySource?.paths.find(
        (p) => p.path.toLowerCase() === arg.name.toLowerCase(),
      );
      if (matchQuery) {
        return {
          argName: arg.name,
          source: { kind: "req_query", field: matchQuery.path },
        };
      }

      // 3. Prior step outputs match
      for (const ps of availableSources.filter((s) => s.kind === "step_output")) {
        const matchStepField = ps.paths.find(
          (p) => p.path.toLowerCase() === arg.name.toLowerCase(),
        );
        if (matchStepField && ps.stepId) {
          return {
            argName: arg.name,
            source: {
              kind: "step_output",
              stepId: ps.stepId,
              field: matchStepField.path,
            },
          };
        }
      }

      // 4. Request body match
      const matchBody = reqBodySource?.paths.find(
        (p) =>
          p.path.toLowerCase() === arg.name.toLowerCase() ||
          p.path.toLowerCase().endsWith(`.${arg.name.toLowerCase()}`),
      );
      if (matchBody) {
        return {
          argName: arg.name,
          source: { kind: "req_body", field: matchBody.path },
        };
      }

      // 5. Default fallback
      return {
        argName: arg.name,
        source: { kind: "req_body", field: arg.name },
      };
    });

    onChange({
      ...step,
      inputBindings: newBindings,
    });
  };

  const handlePopulateAllExpectedArgs = () => {
    if (expectedArgs.length === 0) return;
    const existingArgNames = new Set(step.inputBindings.map((b) => b.argName));
    const missing = expectedArgs.filter((a) => !existingArgNames.has(a.name));
    const addedBindings: StepBinding[] = missing.map((a) => ({
      argName: a.name,
      source: { kind: "req_body", field: a.name },
    }));
    onChange({
      ...step,
      inputBindings: [...step.inputBindings, ...addedBindings],
    });
  };

  // -------------------------------------------------------------------------
  // General Binding Handlers
  // -------------------------------------------------------------------------
  const updateBinding = useCallback(
    (bi: number, updated: StepBinding) => {
      const bindings = [...step.inputBindings];
      bindings[bi] = updated;
      onChange({ ...step, inputBindings: bindings });
    },
    [step, onChange],
  );

  const addBinding = () => {
    const newBinding: StepBinding = {
      argName: "",
      source: { kind: "req_body", field: "" },
    };
    onChange({
      ...step,
      inputBindings: [...step.inputBindings, newBinding],
    });
  };

  const removeBinding = (bi: number) => {
    onChange({
      ...step,
      inputBindings: step.inputBindings.filter((_, i) => i !== bi),
    });
  };

  const stepId = step.id || `step-${index}`;
  const displayVarName = step.outputVariable || step.name || `step${index + 1}Result`;

  return (
    <Draggable draggableId={stepId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`rounded-lg border transition-all duration-150 ${
            step.enabled === false ? "opacity-50" : ""
          } ${
            snapshot.isDragging
              ? "border-primary shadow-xl shadow-black/25 bg-background z-50 ring-1 ring-primary/40"
              : "border-border/60 bg-card/40 hover:border-border/80"
          }`}
        >
          {/* Step Header — Variable-Centric */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer select-none"
            onClick={() => setExpanded((v) => !v)}
          >
            <div
              {...provided.dragHandleProps}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted/40"
              title="Drag to reorder"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={13} className="shrink-0" />
            </div>
            <span className="text-[11px] text-muted-foreground/60 w-3.5 shrink-0 font-mono">
              {index + 1}
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${meta.color}`}
            >
              {meta.icon}
              {meta.label}
            </span>

            {/* Variable assignment view */}
            <span className="text-xs font-mono font-medium text-foreground/90 flex-1 truncate flex items-center gap-1.5">
              <span className="text-muted-foreground/45 font-normal select-none">const</span>
              <span className="text-primary/95 font-semibold">{displayVarName}</span>
              <span className="text-muted-foreground/35 font-normal select-none">=</span>
              {step.functionRef?.name && (
                <span className="text-[11px] text-muted-foreground/75 font-mono truncate max-w-[150px]">
                  {step.functionRef.name}(...)
                </span>
              )}
              {step.type === "custom_code" && (
                <span className="text-[11px] text-muted-foreground/50 font-mono italic truncate max-w-[120px]">
                  {`{ /* code */ }`}
                </span>
              )}
            </span>

            <div
              className="flex items-center gap-0.5 ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              {!isFirst && (
                <button
                  type="button"
                  className="text-muted-foreground/40 hover:text-foreground transition-colors p-1 rounded hover:bg-muted/40"
                  onClick={onMoveUp}
                  title="Move step up"
                >
                  <ArrowUp size={11} />
                </button>
              )}
              {!isLast && (
                <button
                  type="button"
                  className="text-muted-foreground/40 hover:text-foreground transition-colors p-1 rounded hover:bg-muted/40"
                  onClick={onMoveDown}
                  title="Move step down"
                >
                  <ArrowDown size={11} />
                </button>
              )}
              <button
                type="button"
                className="text-destructive/50 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                onClick={onDelete}
                title="Delete step"
              >
                <Trash2 size={11} />
              </button>
            </div>
            {expanded ? (
              <ChevronDown size={12} className="text-muted-foreground/50 shrink-0" />
            ) : (
              <ChevronRight size={12} className="text-muted-foreground/50 shrink-0" />
            )}
          </div>

          {/* Expanded Step Body */}
          {expanded && (
            <div className="border-t border-border/40 px-3 pt-3 pb-3 flex flex-col gap-3.5">
              {/* Row 1: Output Variable Name + Step Type */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium flex items-center justify-between">
                    <span>Output Variable Name</span>
                    <span className="text-[9px] font-mono text-muted-foreground/50">const [name] = ...</span>
                  </Label>
                  <Input
                    className="h-7 text-xs font-mono bg-background/60 border-border/60"
                    value={step.outputVariable ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange({ ...step, outputVariable: val, name: val });
                    }}
                    placeholder="e.g. createdProduct"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground font-medium">Step Type</Label>
                  <Select
                    value={step.type}
                    onValueChange={(v) => {
                      if (!isStepType(v)) return;
                      const nextVar =
                        v === "transform"
                          ? `transformedData${index + 1}`
                          : v === "db_operation"
                          ? `dbResult${index + 1}`
                          : `step${index + 1}Result`;
                      onChange({
                        ...step,
                        type: v,
                        outputVariable: step.outputVariable || nextVar,
                        name: step.outputVariable || nextVar,
                      });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADDABLE_STEP_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {STEP_TYPE_META[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Transform Step Section */}
              {step.type === "transform" && (
                <TransformerStepSection
                  step={step}
                  availableTransformers={availableTransformers}
                  serviceNodeId={serviceNodeId}
                  endpointId={endpoint?.id}
                  expectedArgs={expectedArgs}
                  onChange={onChange}
                  onAutoMapArguments={handleAutoMapArguments}
                  onPopulateAllExpectedArgs={handlePopulateAllExpectedArgs}
                />
              )}


              {/* DB Operation Step Section */}
              {step.type === "db_operation" && (
                <DbOperationStepSection
                  step={step}
                  allNodes={allNodes}
                  allEdges={allEdges}
                  expectedArgs={expectedArgs}
                  selectedDbId={selectedDbId}
                  showAdvancedSettings={showAdvancedSettings}
                  onToggleAdvancedSettings={() => setShowAdvancedSettings((v) => !v)}
                  onChange={onChange}
                  onAutoMapArguments={handleAutoMapArguments}
                  onPopulateAllExpectedArgs={handlePopulateAllExpectedArgs}
                />
              )}

              {/* Row 2: Standard Function Ref for other step types (Redis, Kafka, Service Call) */}
              {step.type !== "custom_code" && step.type !== "db_operation" && step.type !== "transform" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">Function name</Label>
                    <Input
                      className="h-7 text-xs font-mono bg-background/60 border-border/60"
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
                      placeholder="e.g. processData"
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
                            ...(step.functionRef ?? { name: "" }),
                            importPath: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. @workspace/services"
                    />
                  </div>
                </div>
              )}

              {/* Custom Code Block */}
              {step.type === "custom_code" && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">TypeScript code</Label>
                  <Textarea
                    className="text-xs font-mono bg-background/60 border border-border/60 rounded-md p-2 min-h-[80px] resize-y text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    value={step.customCode ?? ""}
                    onChange={(e) => onChange({ ...step, customCode: e.target.value })}
                    placeholder="// raw TypeScript to inline at this step&#10;const result = someValue;"
                  />
                </div>
              )}

              {/* Input Bindings Section */}
              {step.type !== "custom_code" && (
                <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Argument Bindings
                      </Label>
                      {step.inputBindings.length > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-muted/60 text-muted-foreground">
                          {step.inputBindings.length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary transition-colors"
                        onClick={addBinding}
                      >
                        <Plus size={10} />
                        Add arg
                      </button>
                    </div>
                  </div>

                  {step.inputBindings.length === 0 && (
                    <div className="rounded border border-dashed border-border/40 p-2.5 text-center bg-muted/10">
                      <p className="text-[10px] text-muted-foreground/60">
                        No arguments bound yet.
                      </p>
                      {expectedArgs.length > 0 ? (
                        <p
                          className="text-[9px] text-primary/70 mt-0.5 cursor-pointer hover:underline"
                          onClick={handleAutoMapArguments}
                        >
                          Click here to auto-map expected fields from Request Body.
                        </p>
                      ) : (
                        <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                          Click &quot;+ Add arg&quot; to bind function parameters.
                        </p>
                      )}
                    </div>
                  )}

                  {step.inputBindings.map((binding, bi) => (
                    <div
                      key={bi}
                      className="grid grid-cols-[1fr_auto_2.2fr_auto] gap-1.5 items-center bg-muted/15 p-1.5 rounded border border-border/40"
                    >
                      {/* Arg name */}
                      <Input
                        className="h-7 text-xs font-mono bg-background/70 border-border/60"
                        value={binding.argName}
                        onChange={(e) =>
                          updateBinding(bi, { ...binding, argName: e.target.value })
                        }
                        placeholder="argName"
                      />
                      {/* Arrow */}
                      <span className="text-[10px] text-muted-foreground/50 px-0.5">←</span>
                      {/* Source & Smart Path Editor */}
                      <BindingSourceEditor
                        binding={binding}
                        availableSources={availableSources}
                        onChange={(updated) => updateBinding(bi, updated)}
                      />
                      {/* Delete */}
                      <button
                        type="button"
                        className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                        onClick={() => removeBinding(bi)}
                        title="Remove argument"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Enabled toggle */}
              <button
                type="button"
                className={`flex items-center gap-1.5 text-[10px] self-end transition-colors ${
                  step.enabled === false
                    ? "text-muted-foreground/50"
                    : "text-primary/70 hover:text-primary"
                }`}
                onClick={() =>
                  onChange({ ...step, enabled: step.enabled === false ? true : false })
                }
              >
                <Check size={11} />
                {step.enabled === false ? "Enable step" : "Disable step"}
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};
