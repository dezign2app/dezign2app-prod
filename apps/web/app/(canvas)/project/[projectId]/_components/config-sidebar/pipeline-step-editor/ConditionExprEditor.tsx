"use client";

import React, { useMemo } from "react";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Plus, Trash2 } from "lucide-react";
import { SmartPathInput } from "./SmartPathInput";
import {
  ConditionExpr,
  ConditionClause,
  ConditionOperator,
  StepSource,
  AvailableSource,
} from "./types";
import { CONDITION_OPERATORS } from "./utils";

export interface ConditionExprEditorProps {
  expr?: ConditionExpr;
  availableSources: AvailableSource[];
  onChange: (updated: ConditionExpr) => void;
  compact?: boolean;
}

const DEFAULT_CLAUSE: ConditionClause = {
  left: { kind: "req_body", field: "" },
  operator: "eq",
  right: { kind: "literal", value: "" },
};

function normalizeToClauseArray(
  expr?: ConditionExpr,
): { clauses: ConditionClause[]; logic: "and" | "or" } {
  if (!expr) {
    return { clauses: [DEFAULT_CLAUSE], logic: "and" };
  }
  if ("and" in expr && Array.isArray(expr.and)) {
    const list: ConditionClause[] = [];
    expr.and.forEach((item) => {
      if ("left" in item && "operator" in item) {
        list.push(item as ConditionClause);
      }
    });
    return { clauses: list.length > 0 ? list : [DEFAULT_CLAUSE], logic: "and" };
  }
  if ("or" in expr && Array.isArray(expr.or)) {
    const list: ConditionClause[] = [];
    expr.or.forEach((item) => {
      if ("left" in item && "operator" in item) {
        list.push(item as ConditionClause);
      }
    });
    return { clauses: list.length > 0 ? list : [DEFAULT_CLAUSE], logic: "or" };
  }
  if ("left" in expr && "operator" in expr) {
    return { clauses: [expr as ConditionClause], logic: "and" };
  }
  return { clauses: [DEFAULT_CLAUSE], logic: "and" };
}

export const ConditionExprEditor = ({
  expr,
  availableSources,
  onChange,
  compact = false,
}: ConditionExprEditorProps) => {
  const { clauses, logic } = useMemo(() => normalizeToClauseArray(expr), [expr]);

  const updateClause = (index: number, updatedClause: ConditionClause) => {
    const nextClauses = [...clauses];
    nextClauses[index] = updatedClause;
    if (nextClauses.length === 1) {
      onChange(nextClauses[0]!);
    } else if (logic === "or") {
      onChange({ or: nextClauses });
    } else {
      onChange({ and: nextClauses });
    }
  };

  const addClause = (type: "and" | "or") => {
    const nextClauses = [...clauses, { ...DEFAULT_CLAUSE }];
    if (type === "or") {
      onChange({ or: nextClauses });
    } else {
      onChange({ and: nextClauses });
    }
  };

  const removeClause = (index: number) => {
    if (clauses.length <= 1) return;
    const nextClauses = clauses.filter((_, i) => i !== index);
    if (nextClauses.length === 1) {
      onChange(nextClauses[0]!);
    } else if (logic === "or") {
      onChange({ or: nextClauses });
    } else {
      onChange({ and: nextClauses });
    }
  };

  const toggleLogic = () => {
    const newLogic = logic === "and" ? "or" : "and";
    if (newLogic === "or") {
      onChange({ or: clauses });
    } else {
      onChange({ and: clauses });
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${compact ? "text-xs" : ""}`}>
      {clauses.map((clause, idx) => {
        const opMeta = CONDITION_OPERATORS.find((o) => o.value === clause.operator);
        const isUnary = opMeta?.unary ?? false;

        return (
          <div key={idx} className="flex flex-col gap-1.5">
            {idx > 0 && (
              <div className="flex items-center gap-2 py-0.5">
                <button
                  type="button"
                  className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-accent/60 text-primary border border-border/60 hover:bg-accent hover:border-primary/40 transition-colors"
                  onClick={toggleLogic}
                  title="Click to toggle AND / OR"
                >
                  {logic.toUpperCase()}
                </button>
                <div className="h-px bg-border/40 flex-1" />
              </div>
            )}

            <div className="flex flex-col gap-1.5 p-2 rounded-md bg-background/40 border border-border/40">
              {/* Left operand (Source & Field) */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                  Left Operand (LHS)
                </span>
                <SourcePicker
                  source={clause.left}
                  availableSources={availableSources}
                  onChange={(left) => updateClause(idx, { ...clause, left })}
                />
              </div>

              {/* Operator */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select
                    value={clause.operator}
                    onValueChange={(v) =>
                      updateClause(idx, {
                        ...clause,
                        operator: v as ConditionOperator,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value} className="text-xs">
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {clauses.length > 1 && (
                  <button
                    type="button"
                    className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => removeClause(idx)}
                    title="Remove condition"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {/* Right operand (if binary) */}
              {!isUnary && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                    Right Operand (RHS)
                  </span>
                  <SourcePicker
                    source={clause.right || { kind: "literal", value: "" }}
                    availableSources={availableSources}
                    onChange={(right) => updateClause(idx, { ...clause, right })}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add compound clause buttons */}
      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-border/60 bg-accent/20 hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all"
          onClick={() => addClause("and")}
        >
          <Plus size={10} />
          <span>Add AND Condition</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border border-border/60 bg-accent/20 hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all"
          onClick={() => addClause("or")}
        >
          <Plus size={10} />
          <span>Add OR Condition</span>
        </button>
      </div>
    </div>
  );
};

interface SourcePickerProps {
  source: StepSource;
  availableSources: AvailableSource[];
  onChange: (source: StepSource) => void;
}

const SourcePicker = ({
  source,
  availableSources,
  onChange,
}: SourcePickerProps) => {
  const currentSourceOptionId = useMemo(() => {
    if (source.kind === "step_output") {
      return `step:${source.stepId}`;
    }
    return source.kind;
  }, [source]);

  const activeSource = availableSources.find((s) => s.id === currentSourceOptionId);

  const handleSourceSelect = (selectedId: string) => {
    if (selectedId.startsWith("step:")) {
      const stepId = selectedId.replace("step:", "");
      onChange({ kind: "step_output", stepId, field: "" });
    } else if (selectedId === "req_body") {
      onChange({ kind: "req_body", field: "" });
    } else if (selectedId === "req_params") {
      onChange({ kind: "req_params", field: "" });
    } else if (selectedId === "req_query") {
      onChange({ kind: "req_query", field: "" });
    } else if (selectedId === "req_headers") {
      onChange({ kind: "req_headers", field: "" });
    } else if (selectedId === "literal") {
      onChange({ kind: "literal", value: "" });
    }
  };

  return (
    <div className="flex gap-1.5 items-center w-full">
      <Select value={currentSourceOptionId} onValueChange={handleSourceSelect}>
        <SelectTrigger className="h-7 text-xs bg-background/60 border-border/60 w-[130px] shrink-0">
          <SelectValue placeholder="Source..." />
        </SelectTrigger>
        <SelectContent>
          {availableSources.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {source.kind !== "literal" ? (
        <SmartPathInput
          value={source.field ?? ""}
          onChange={(field) => onChange({ ...source, field })}
          suggestedPaths={activeSource?.paths || []}
          sourceKindLabel={activeSource?.label}
          rootVariableName={activeSource?.rootVariableName}
        />
      ) : (
        <Input
          className="h-7 text-xs font-mono bg-background/60 border-border/60 flex-1"
          placeholder="literal value"
          value={String(source.value ?? "")}
          onChange={(e) => onChange({ kind: "literal", value: e.target.value })}
        />
      )}
    </div>
  );
};
