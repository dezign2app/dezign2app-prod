import React from "react";
import { Sliders, Database, ArrowRight } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { BackendNode } from "@workspace/canvas";
import type {
  FrontendActionStepDraft,
  FrontendFieldSource,
} from "./types";
import { ResponseFieldPicker } from "./ResponseFieldPicker";

export interface StateMutationStepProps {
  draft: FrontendActionStepDraft;
  allSteps: FrontendActionStepDraft[];
  stepIndex: number;
  allNodes: BackendNode[];
  onChange: (updated: FrontendActionStepDraft) => void;
}

export const StateMutationStep: React.FC<StateMutationStepProps> = ({
  draft,
  allSteps,
  stepIndex,
  allNodes,
  onChange,
}) => {
  const stateStores = allNodes.filter((n) => n.type === "state_store");
  const priorSteps = allSteps.slice(0, stepIndex);

  const targetKind = draft.stateTargetKind || "local";
  const updateType = draft.stateUpdateType || "set";
  const stateKey = draft.stateKey || "";
  const valueSource = draft.stateValueSource || {
    kind: "literal",
    value: "",
  };

  return (
    <div className="space-y-3 pt-1 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Target State Scope
          </Label>
          <Select
            value={targetKind}
            onValueChange={(val: "local" | "store") =>
              onChange({ ...draft, stateTargetKind: val })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Component / Page State</SelectItem>
              <SelectItem value="store">State Store Node</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {targetKind === "store" ? (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Select State Store
            </Label>
            <Select
              value={draft.stateStoreNodeId || ""}
              onValueChange={(val) =>
                onChange({ ...draft, stateStoreNodeId: val })
              }
            >
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue placeholder="Choose store node" />
              </SelectTrigger>
              <SelectContent>
                {stateStores.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.data?.label || st.data?.storeName || st.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              State Key / Property Name
            </Label>
            <Input
              value={stateKey}
              onChange={(e) =>
                onChange({ ...draft, stateKey: e.target.value })
              }
              placeholder="e.g. currentUser, selectedItem, isSubmitting"
              className="h-7 text-xs bg-background font-mono"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Operation Type
          </Label>
          <Select
            value={updateType}
            onValueChange={(val: "set" | "toggle" | "increment" | "reset") =>
              onChange({ ...draft, stateUpdateType: val })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set">Set Value</SelectItem>
              <SelectItem value="toggle">Toggle Boolean</SelectItem>
              <SelectItem value="increment">Increment Number</SelectItem>
              <SelectItem value="reset">Reset to Default</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {updateType === "set" && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Value Source
            </Label>
            <Select
              value={valueSource.kind}
              onValueChange={(
                val: "literal" | "state_var" | "user_input" | "prev_response",
              ) => {
                let nextSource: FrontendFieldSource;
                if (val === "literal") {
                  nextSource = { kind: "literal", value: "" };
                } else if (val === "state_var") {
                  nextSource = { kind: "state_var", stateKey: "" };
                } else if (val === "prev_response") {
                  nextSource = {
                    kind: "prev_response",
                    stepId: priorSteps[0]?.id || "",
                    fieldPath: "",
                  };
                } else {
                  nextSource = { kind: "user_input", fieldName: "" };
                }
                onChange({ ...draft, stateValueSource: nextSource });
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="literal">Static Literal</SelectItem>
                <SelectItem value="user_input">User Form Input</SelectItem>
                <SelectItem value="state_var">Another State Var</SelectItem>
                {priorSteps.length > 0 && (
                  <SelectItem value="prev_response">Prior Step Response</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {updateType === "set" && (
        <div className="pt-1">
          {valueSource.kind === "literal" && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Value to Assign
              </Label>
              <Input
                value={valueSource.value}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    stateValueSource: { kind: "literal", value: e.target.value },
                  })
                }
                placeholder="String, number, or JSON value"
                className="h-7 text-xs bg-background"
              />
            </div>
          )}

          {valueSource.kind === "user_input" && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Form Input Field Name
              </Label>
              <Input
                value={valueSource.fieldName}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    stateValueSource: {
                      kind: "user_input",
                      fieldName: e.target.value,
                    },
                  })
                }
                placeholder="e.g. email, message, query"
                className="h-7 text-xs bg-background"
              />
            </div>
          )}

          {valueSource.kind === "state_var" && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Source State Key
              </Label>
              <Input
                value={valueSource.stateKey}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    stateValueSource: {
                      kind: "state_var",
                      stateKey: e.target.value,
                    },
                  })
                }
                placeholder="e.g. otherState"
                className="h-7 text-xs bg-background font-mono"
              />
            </div>
          )}

          {valueSource.kind === "prev_response" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  From Step
                </Label>
                <Select
                  value={valueSource.stepId}
                  onValueChange={(val) =>
                    onChange({
                      ...draft,
                      stateValueSource: {
                        kind: "prev_response",
                        stepId: val,
                        fieldPath: valueSource.fieldPath || "",
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs bg-background">
                    <SelectValue placeholder="Select step" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorSteps.map((pStep, pIdx) => (
                      <SelectItem key={pStep.id} value={pStep.id}>
                        Step {pIdx + 1}: {pStep.name || pStep.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Response Property
                </Label>
                <ResponseFieldPicker
                  value={valueSource.fieldPath}
                  onChange={(val) =>
                    onChange({
                      ...draft,
                      stateValueSource: {
                        kind: "prev_response",
                        stepId: valueSource.stepId || priorSteps[0]?.id || "",
                        fieldPath: val,
                      },
                    })
                  }
                  placeholder="e.g. data.user or token"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
