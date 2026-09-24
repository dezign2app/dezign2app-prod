"use client";

import React, { useState } from "react";
import { LocalInput, LocalTextarea } from "../../backend-nodes/graph-nodes/shared";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  FileCode,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Code2,
  Sparkles,
} from "lucide-react";
import { GlobalStoreAction, GlobalStoreField, Parameter } from "@workspace/canvas/types";
import { TypeCombobox } from "../TypeCombobox";
import { cn } from "@workspace/ui/lib/utils";

export interface StoreActionsSectionProps {
  actions: GlobalStoreAction[];
  fields: GlobalStoreField[];
  onAddAction: () => void;
  onUpdateAction: (actionId: string, patch: Partial<GlobalStoreAction>) => void;
  onRemoveAction: (actionId: string) => void;
}

export const StoreActionsSection: React.FC<StoreActionsSectionProps> = ({
  actions,
  fields,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
}) => {
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  const handleAddActionParameter = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    const currentParams = action.parameters || [];
    const newParam: Parameter = {
      id: `param_${Date.now()}`,
      name: `arg${currentParams.length + 1}`,
      type: "string",
      required: true,
    };
    onUpdateAction(actionId, { parameters: [...currentParams, newParam] });
  };

  const handleUpdateActionParameter = (
    actionId: string,
    paramId: string,
    patch: Partial<Parameter>,
  ) => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    const updatedParams = (action.parameters || []).map((p) =>
      p.id === paramId ? { ...p, ...patch } : p,
    );
    onUpdateAction(actionId, { parameters: updatedParams });
  };

  const handleRemoveActionParameter = (actionId: string, paramId: string) => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    const updatedParams = (action.parameters || []).filter((p) => p.id !== paramId);
    onUpdateAction(actionId, { parameters: updatedParams });
  };

  const customActions = React.useMemo(() => {
    return actions.filter((act) => {
      if (act.defaultManipulatorType) return false;
      const isPopulateOverride =
        act.actionType === "populate" ||
        act.name.toLowerCase() === "populate" ||
        act.name.toLowerCase() === "load";
      const isResetOverride =
        act.actionType === "reset" || act.name.toLowerCase() === "reset";
      const isSetterOverride = fields.some(
        (f) =>
          act.targetFieldId === f.id &&
          act.name.toLowerCase() === `set${f.name.toLowerCase()}`,
      );
      return !isPopulateOverride && !isResetOverride && !isSetterOverride;
    });
  }, [actions, fields]);

  return (
    <div className="flex flex-col gap-2.5 pt-2 border-t border-border/40">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileCode size={13} className="text-indigo-400" />
          <span>Custom Store Actions &amp; Logic ({customActions.length})</span>
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onAddAction();
          }}
          className="h-6 text-[10px] px-2 gap-1 text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 border-indigo-500/30 cursor-pointer"
        >
          <Plus size={11} />
          <span>Add Custom Action</span>
        </Button>
      </div>

      {customActions.length === 0 ? (
        <div className="p-3 text-center text-[11px] text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border/60">
          No additional custom actions defined. Click &quot;Add Custom Action&quot; to add business logic.
        </div>
      ) : (
        <div className="space-y-2.5">
          {customActions.map((act) => {
            const isExpanded = expandedActionId === act.id;
            const isCustom = act.actionType === "custom";

            return (
              <div
                key={act.id}
                className={cn(
                  "rounded-lg border transition-all overflow-hidden",
                  isExpanded
                    ? "bg-card border-indigo-500/40 shadow-sm"
                    : "bg-card/60 border-border/60 hover:border-border",
                )}
              >
                {/* Action Header Row */}
                <div className="p-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedActionId(isExpanded ? null : act.id)}
                    className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <LocalInput
                    value={act.name}
                    onChange={(e) => onUpdateAction(act.id, { name: e.target.value })}
                    debounceMs={150}
                    placeholder="Action name"
                    className="h-7 text-xs font-mono flex-1"
                  />
                  <Select
                    value={act.actionType}
                    onValueChange={(val: GlobalStoreAction["actionType"]) => {
                      onUpdateAction(act.id, { actionType: val });
                      if (val === "custom") setExpandedActionId(act.id);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="set">set</SelectItem>
                      <SelectItem value="append">append</SelectItem>
                      <SelectItem value="remove">remove</SelectItem>
                      <SelectItem value="toggle">toggle</SelectItem>
                      <SelectItem value="increment">increment</SelectItem>
                      <SelectItem value="populate">populate</SelectItem>
                      <SelectItem value="reset">reset</SelectItem>
                      <SelectItem value="custom">custom</SelectItem>
                    </SelectContent>
                  </Select>

                  {!isCustom && (
                    <Select
                      value={act.targetFieldId || "none"}
                      onValueChange={(val) =>
                        onUpdateAction(act.id, {
                          targetFieldId: val === "none" ? undefined : val,
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-28 font-mono">
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {fields.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      onRemoveAction(act.id);
                      if (expandedActionId === act.id) setExpandedActionId(null);
                    }}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>

                {/* Expandable Action Details / Custom Logic Editor */}
                {isExpanded && (
                  <div className="p-3 bg-muted/20 border-t border-border/40 space-y-3">
                    {/* Arguments / Parameters */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Action Arguments ({act.parameters?.length || 0})
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddActionParameter(act.id)}
                          className="h-5 text-[10px] text-indigo-400 hover:text-indigo-300 p-1 cursor-pointer"
                        >
                          <Plus size={10} className="mr-0.5" /> Add Arg
                        </Button>
                      </div>
                      {(!act.parameters || act.parameters.length === 0) ? (
                        <p className="text-[10px] text-muted-foreground/70 italic">
                          Receives default <code>payload</code> argument
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {act.parameters.map((param) => (
                            <div key={param.id} className="flex items-center gap-1.5">
                              <LocalInput
                                value={param.name}
                                onChange={(e) =>
                                  handleUpdateActionParameter(act.id, param.id, {
                                    name: e.target.value,
                                  })
                                }
                                debounceMs={150}
                                placeholder="argName"
                                className="h-6 text-[11px] font-mono flex-1 bg-background"
                              />
                              <TypeCombobox
                                value={param.type}
                                onValueChange={(val) =>
                                  handleUpdateActionParameter(act.id, param.id, {
                                    type: val,
                                  })
                                }
                                className="h-6 w-24 text-[11px] font-mono bg-background"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveActionParameter(act.id, param.id)}
                                className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Custom Logic Code Editor */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Code2 size={11} className="text-emerald-400" />
                          <span>Custom Logic (TypeScript / JS)</span>
                        </Label>
                      </div>

                      {/* Snippets / Templates Bar */}
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const snippet = `// Multi-field update and calculation\nconst items = get().items || [];\nconst nextItems = [...items, payload];\nset({\n  items: nextItems,\n  total: nextItems.reduce((sum, item) => sum + (Number(item?.price) || 0), 0)\n});`;
                            onUpdateAction(act.id, { code: snippet });
                          }}
                          className="h-5 text-[9px] px-1.5 bg-background/50 hover:bg-indigo-500/10 cursor-pointer"
                        >
                          Multi-field Calc
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const targetField = fields.find((f) => f.id === act.targetFieldId);
                            const fieldName = targetField
                              ? targetField.name.charAt(0).toLowerCase() + targetField.name.slice(1)
                              : "items";
                            const snippet = `// Map array item by id\nset((s) => ({\n  ${fieldName}: Array.isArray(s.${fieldName})\n    ? s.${fieldName}.map((it) =>\n        typeof it === "object" && it !== null && "id" in it && it.id === payload.id\n          ? { ...it, ...payload }\n          : it\n      )\n    : s.${fieldName},\n}));`;
                            onUpdateAction(act.id, { code: snippet });
                          }}
                          className="h-5 text-[9px] px-1.5 bg-background/50 hover:bg-indigo-500/10 cursor-pointer"
                        >
                          Item Map
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const snippet = `// Direct state merge\nset((s) => ({ ...s, ...(payload && typeof payload === "object" ? payload : {}) }));`;
                            onUpdateAction(act.id, { code: snippet });
                          }}
                          className="h-5 text-[9px] px-1.5 bg-background/50 hover:bg-indigo-500/10 cursor-pointer"
                        >
                          State Merge
                        </Button>
                      </div>

                      <LocalTextarea
                        value={act.code || ""}
                        onChange={(e) => onUpdateAction(act.id, { code: e.target.value })}
                        debounceMs={200}
                        placeholder={`// Access state with get(), update with set({ ... })\nconst current = get();\nset({ ${fields[0]?.name || "state"}: payload });`}
                        className="min-h-[100px] font-mono text-[11px] bg-background/80 resize-y p-2 leading-relaxed border-border/80"
                      />
                      <span className="text-[9px] text-muted-foreground block font-mono">
                        Available in scope: <code>payload</code>, <code>set(patch)</code>, <code>get()</code>
                      </span>
                    </div>

                    {/* AI Prompt */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Sparkles size={11} className="text-amber-400" />
                        <span>AI Prompt / Natural Language Instruction</span>
                      </Label>
                      <LocalInput
                        value={act.prompt || ""}
                        onChange={(e) => onUpdateAction(act.id, { prompt: e.target.value })}
                        debounceMs={150}
                        placeholder="e.g. Add product to cart and recalculate subtotal and total"
                        className="h-7 text-xs bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
