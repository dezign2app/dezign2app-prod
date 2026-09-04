"use client";

import React from "react";
import { Plus, Trash, Code2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ExternalInputVariable } from "@workspace/canvas/types";
import { toVarName } from "@/lib/compiler/utils";
import { BufferedInput } from "./BufferedInput";

interface ExternalInputVariablesSectionProps {
  inputVariables: ExternalInputVariable[];
  onAddVariable: (presetName?: string, presetType?: ExternalInputVariable["type"]) => void;
  onUpdateVariable: (id: string, patch: Partial<ExternalInputVariable>) => void;
  onDeleteVariable: (id: string) => void;
  onInsertInUrl: (varName: string) => void;
  onInsertInBody: (varName: string) => void;
  onUpdateTestValue?: (name: string, val: string) => void;
}

export const ExternalInputVariablesSection = React.memo<ExternalInputVariablesSectionProps>(
  ({
    inputVariables,
    onAddVariable,
    onUpdateVariable,
    onDeleteVariable,
    onInsertInUrl,
    onInsertInBody,
    onUpdateTestValue,
  }) => {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.02] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Code2 size={14} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Dynamic Input Variables
              </span>
              <span className="text-[10px] text-muted-foreground">
                Dynamic parameters passed into this function. Reference using{" "}
                <code className="font-mono text-emerald-600 dark:text-emerald-400">{`{{variableName}}`}</code>.
              </span>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => onAddVariable()}
          >
            <Plus size={12} /> Add Variable
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-medium">Quick add:</span>
          {["userId", "amount", "query", "email", "limit"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() =>
                onAddVariable(
                  preset,
                  preset === "amount" || preset === "limit" ? "number" : "string",
                )
              }
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary hover:bg-muted text-foreground border border-border/60 transition-colors"
            >
              + {preset}
            </button>
          ))}
        </div>

        {/* Variables List */}
        {inputVariables.length === 0 ? (
          <div className="text-xs text-muted-foreground italic p-3 border border-dashed border-border rounded-lg text-center bg-background/50">
            No dynamic variables defined. If your request has static values only, leave this empty.
            Otherwise click <strong>Add Variable</strong> to define dynamic arguments.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/60 border border-border rounded-lg overflow-hidden bg-background/60">
            {inputVariables.map((v) => (
              <div key={v.id} className="p-2.5 flex flex-col gap-2 group">
                <div className="flex items-center gap-2">
                  <BufferedInput
                    className="h-7 text-xs font-mono font-semibold flex-1 bg-background"
                    placeholder="variableName"
                    value={v.name}
                    onCommit={(val) => onUpdateVariable(v.id, { name: toVarName(val) })}
                    transformValue={toVarName}
                  />

                  <Select
                    value={v.type}
                    onValueChange={(val: ExternalInputVariable["type"]) =>
                      onUpdateVariable(v.id, { type: val })
                    }
                  >
                    <SelectTrigger className="h-7 w-24 text-xs font-mono bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">boolean</SelectItem>
                      <SelectItem value="object">object</SelectItem>
                      <SelectItem value="array">array</SelectItem>
                    </SelectContent>
                  </Select>

                  <BufferedInput
                    className="h-7 text-xs flex-1 bg-background font-mono"
                    placeholder="Default / Test Sample Value"
                    value={v.defaultValue || ""}
                    onCommit={(val) => {
                      onUpdateVariable(v.id, { defaultValue: val });
                      onUpdateTestValue?.(v.name, val);
                    }}
                  />

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteVariable(v.id)}
                    title="Remove variable"
                  >
                    <Trash size={12} />
                  </Button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <span className="font-mono">
                    Usage:{" "}
                    <code className="text-emerald-600 dark:text-emerald-400">{`{{${v.name || "var"}}}`}</code>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onInsertInUrl(v.name)}
                      className="hover:text-foreground underline cursor-pointer"
                    >
                      Insert in URL
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => onInsertInBody(v.name)}
                      className="hover:text-foreground underline cursor-pointer"
                    >
                      Insert in Body
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
ExternalInputVariablesSection.displayName = "ExternalInputVariablesSection";
