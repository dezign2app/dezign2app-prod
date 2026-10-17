import React, { useState, useMemo, useEffect } from "react";
import {
  Braces,
  Plus,
  Database,
  Layers,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@workspace/ui/components/select";
import type {
  LangGraphStateChannel,
  LangGraphNodePipelineStep,
  LangGraphCanvasNode,
  TransformerCanvasNode,
} from "@workspace/canvas";
import { isTransformerCanvasNode } from "@workspace/canvas";

export interface PromptFieldOption {
  value: string; // e.g. "msg" or "field1" or "" for whole output
  label: string;
  type?: string;
}

export interface PromptSourceOption {
  id: string; // "state" or step.id
  label: string;
  outVar: string; // "state" or step output variable e.g. "step1Result"
  category: "state" | "step";
  stepIndex?: number;
  stepType?: string;
  fields: PromptFieldOption[];
}

export interface AgentPromptVariablePickerProps {
  stateChannels?: LangGraphStateChannel[];
  priorSteps?: LangGraphNodePipelineStep[];
  nodes?: LangGraphCanvasNode[];
  onInsertVariable: (token: string) => void;
  currentPrompt?: string;
}

/**
 * Extracts all unique `${...}` tokens from a prompt string.
 */
export function extractPromptVariables(prompt?: string): string[] {
  if (!prompt || typeof prompt !== "string") return [];
  const matches = prompt.match(/\$\{([^}]+)\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/**
 * Derives available sources (State and ONLY prior steps that run before this step)
 * and their respective accessible fields.
 */
export function derivePromptSources(
  stateChannels: LangGraphStateChannel[] = [],
  priorSteps: LangGraphNodePipelineStep[] = [],
  nodes: LangGraphCanvasNode[] = [],
): PromptSourceOption[] {
  const sources: PromptSourceOption[] = [];

  // 1. State Source
  const stateFields: PromptFieldOption[] = [];
  if (stateChannels.length > 0) {
    for (const ch of stateChannels) {
      if (!ch.key?.trim()) continue;
      const key = ch.key.trim();
      stateFields.push({
        value: key,
        label: `${key} (${ch.type || "string"})`,
        type: ch.type || "string",
      });
    }
  } else {
    // Default channels if none configured on graph yet
    stateFields.push(
      { value: "msg", label: "msg (string)", type: "string" },
      { value: "messages", label: "messages (chat history)", type: "messages" },
    );
  }

  sources.push({
    id: "state",
    label: "State (Graph State)",
    outVar: "state",
    category: "state",
    fields: stateFields,
  });

  // 2. Prior Steps Sources (ONLY steps that actually executed BEFORE this step!)
  if (priorSteps.length > 0) {
    priorSteps.forEach((pStep, i) => {
      const stepIdx = i + 1;
      const stepLabel = pStep.label || `Step ${stepIdx}`;
      const outVar =
        pStep.outputVariable ||
        (pStep.type === "transformer" || pStep.type === "transform"
          ? `transformedData_${stepIdx}`
          : pStep.type === "llm_call"
            ? `response`
            : `step${stepIdx}Result`);

      const stepFields: PromptFieldOption[] = [];

      // Whole object option
      stepFields.push({
        value: "",
        label: "(whole output)",
        type: "object",
      });

      if (pStep.type === "transformer" || pStep.type === "transform") {
        let hasExplicit = false;
        if (pStep.outputSchema && pStep.outputSchema.length > 0) {
          hasExplicit = true;
          for (const f of pStep.outputSchema) {
            if (!f.name?.trim()) continue;
            stepFields.push({
              value: f.name.trim(),
              label: `${f.name} (${f.type || "string"})`,
              type: f.type || "string",
            });
          }
        }

        const sourceNodeId = pStep.transformerNodeId || pStep.transformerRef;
        if (sourceNodeId && nodes.length > 0) {
          const masterNode = nodes.find(
            (n): n is TransformerCanvasNode =>
              isTransformerCanvasNode(n) && n.id === sourceNodeId,
          );
          if (masterNode?.data?.returnSchema && masterNode.data.returnSchema.length > 0) {
            hasExplicit = true;
            for (const f of masterNode.data.returnSchema) {
              if (!f.name?.trim()) continue;
              if (!stepFields.some((item) => item.value === f.name.trim())) {
                stepFields.push({
                  value: f.name.trim(),
                  label: `${f.name} (${f.type || "string"})`,
                  type: f.type || "string",
                });
              }
            }
          }
        }

        if (!hasExplicit) {
          stepFields.push(
            { value: "field1", label: "field1 (string)", type: "string" },
            { value: "result", label: "result (any)", type: "any" },
          );
        }
      } else if (pStep.type === "custom_code") {
        stepFields.push({
          value: "result",
          label: "result (any)",
          type: "any",
        });
      } else if (pStep.type === "llm_call") {
        stepFields.push(
          { value: "content", label: "content (AI text)", type: "string" },
          { value: "role", label: "role (string)", type: "string" },
        );
      }

      sources.push({
        id: pStep.id,
        label: `Step ${stepIdx}: ${stepLabel} (${outVar})`,
        outVar,
        category: "step",
        stepIndex: stepIdx,
        stepType: pStep.type,
        fields: stepFields,
      });
    });
  }

  return sources;
}

/**
 * Cascading variable picker:
 * Select Step or State  -->  Select Field  -->  Add Button
 */
export function AgentPromptVariablePicker({
  stateChannels = [],
  priorSteps = [],
  nodes = [],
  onInsertVariable,
}: AgentPromptVariablePickerProps) {
  const sources = useMemo(() => {
    return derivePromptSources(stateChannels, priorSteps, nodes);
  }, [stateChannels, priorSteps, nodes]);

  // Selected source: defaults to "state" (or first available source)
  const [selectedSourceId, setSelectedSourceId] = useState<string>("state");

  // Keep selectedSourceId valid if prior steps change
  useEffect(() => {
    if (!sources.some((s) => s.id === selectedSourceId)) {
      setSelectedSourceId("state");
    }
  }, [sources, selectedSourceId]);

  const currentSource = useMemo(() => {
    return sources.find((s) => s.id === selectedSourceId) || sources[0];
  }, [sources, selectedSourceId]);

  const availableFields = useMemo(() => {
    return currentSource?.fields || [];
  }, [currentSource]);

  // Selected field: defaults to first available field of the source
  const [selectedField, setSelectedField] = useState<string>(() => {
    return availableFields[0]?.value ?? "msg";
  });
  const [isCustomField, setIsCustomField] = useState(false);
  const [customFieldText, setCustomFieldText] = useState("");
  const [justAdded, setJustAdded] = useState(false);

  // When switching source, update selected field default
  const handleSourceChange = (newSourceId: string) => {
    setSelectedSourceId(newSourceId);
    const src = sources.find((s) => s.id === newSourceId);
    const firstF = src?.fields[0];
    // If switching to step and first field is whole output, choose second field if exists
    if (src?.category === "step" && src.fields.length > 1 && firstF?.value === "") {
      setSelectedField(src.fields[1]!.value);
    } else {
      setSelectedField(firstF?.value ?? "");
    }
    setIsCustomField(false);
    setCustomFieldText("");
  };

  const handleFieldChange = (val: string) => {
    if (val === "__custom__") {
      setIsCustomField(true);
    } else {
      setIsCustomField(false);
      setSelectedField(val);
    }
  };

  // Compute live token: e.g. ${state.msg} or ${step1Result.field1}
  const currentToken = useMemo(() => {
    if (!currentSource) return "";
    const prefix = currentSource.outVar; // "state" or "step1Result"
    const fieldPart = isCustomField ? customFieldText.trim() : selectedField;

    if (!fieldPart) {
      return `\${${prefix}}`;
    }
    return `\${${prefix}.${fieldPart}}`;
  }, [currentSource, isCustomField, customFieldText, selectedField]);

  const handleAdd = () => {
    if (!currentToken) return;
    onInsertVariable(currentToken);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 600);
  };

  const priorStepCount = sources.filter((s) => s.category === "step").length;

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg border border-border/50 bg-secondary/15 select-none">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground shrink-0">
        <Braces className="w-3.5 h-3.5 text-primary" />
        <span>Variable:</span>
      </div>

      {/* 1. Select Step or State */}
      <Select value={selectedSourceId} onValueChange={handleSourceChange}>
        <SelectTrigger
          size="sm"
          className="h-6 text-[11px] min-w-[125px] max-w-[170px] bg-background/70 border-border/60"
          title="Select State or Step"
        >
          <SelectValue placeholder="Select Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Database className="w-3 h-3 text-amber-400" />
              State
            </SelectLabel>
            <SelectItem value="state" className="text-xs">
              State (Graph State)
            </SelectItem>
          </SelectGroup>

          {priorStepCount > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3 text-purple-400" />
                  Prior Steps
                </SelectLabel>
                {sources
                  .filter((s) => s.category === "step")
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground/60 text-xs font-mono font-bold select-none">
        .
      </span>

      {/* 2. Select Field */}
      {!isCustomField ? (
        <Select value={selectedField} onValueChange={handleFieldChange}>
          <SelectTrigger
            size="sm"
            className="h-6 text-[11px] min-w-[115px] max-w-[160px] bg-background/70 border-border/60 font-mono"
            title="Select Field"
          >
            <SelectValue placeholder="Select Field" />
          </SelectTrigger>
          <SelectContent>
            {availableFields.map((f) => (
              <SelectItem key={f.value} value={f.value} className="text-xs font-mono">
                {f.label}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value="__custom__" className="text-xs italic text-primary">
              + Custom field...
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            value={customFieldText}
            onChange={(e) => setCustomFieldText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="field name..."
            className="h-6 w-24 text-[11px] font-mono px-1.5 py-0 bg-background/70 border-border/60"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setIsCustomField(false)}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1"
            title="Cancel custom field"
          >
            &times;
          </button>
        </div>
      )}

      <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />

      {/* 3. Add Button */}
      <Button
        type="button"
        size="sm"
        onClick={handleAdd}
        className={`h-6 px-2.5 text-[11px] font-mono gap-1 transition-all shrink-0 cursor-pointer shadow-xs ml-auto ${
          justAdded
            ? "bg-emerald-600 text-white hover:bg-emerald-600"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
        title={`Insert ${currentToken} into system prompt at cursor position`}
      >
        {justAdded ? (
          <>
            <Check className="w-3 h-3" />
            <span>Added!</span>
          </>
        ) : (
          <>
            <Plus className="w-3 h-3" />
            <span>Add {currentToken}</span>
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Indicator bar displayed below the prompt textarea showing variables detected in the prompt.
 */
export function PromptActiveVariablesBar({
  currentPrompt = "",
}: {
  currentPrompt?: string;
}) {
  const activeVars = useMemo(() => {
    return extractPromptVariables(currentPrompt);
  }, [currentPrompt]);

  if (activeVars.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-1 pt-1 select-none">
      <span className="text-[9px] font-medium text-muted-foreground/60">
        Interpolated in prompt:
      </span>
      {activeVars.map((v) => {
        const isState = v.includes("state.");
        return (
          <span
            key={v}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-medium border ${
              isState
                ? "bg-amber-500/10 text-amber-300/90 border-amber-500/20"
                : "bg-purple-500/10 text-purple-300/90 border-purple-500/20"
            }`}
            title={
              isState
                ? `Dynamically evaluated from LangGraph State channel`
                : `Dynamically evaluated from prior Step Output`
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isState ? "bg-amber-400" : "bg-purple-400"
              }`}
            />
            {v}
          </span>
        );
      })}
    </div>
  );
}
