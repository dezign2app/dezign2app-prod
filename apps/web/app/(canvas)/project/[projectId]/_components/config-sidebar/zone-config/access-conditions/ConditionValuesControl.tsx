import React, { useState } from "react";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ConditionPrimitive } from "@workspace/canvas";
import { ClaimColumnInfo } from "./types";
import { cn } from "@workspace/ui/lib/utils";

interface ConditionValuesControlProps {
  idx: number;
  leaf: ConditionPrimitive;
  colInfo: ClaimColumnInfo;
  isListOp: boolean;
  isSingleValOp: boolean;
  values: string[];
  singleVal: string;
  onValuesChange: (idx: number, leaf: ConditionPrimitive, text: string) => void;
  onSingleValChange: (idx: number, leaf: ConditionPrimitive, val: string) => void;
}

export const ConditionValuesControl: React.FC<ConditionValuesControlProps> = ({
  idx,
  leaf,
  colInfo,
  isListOp,
  isSingleValOp,
  values,
  singleVal,
  onValuesChange,
  onSingleValChange,
}) => {
  const [customInput, setCustomInput] = useState("");
  const [rawText, setRawText] = useState<string | null>(null);

  const isEnumOrBool = colInfo.dataType === "enum" || colInfo.dataType === "boolean";
  const schemaEnumValues = colInfo.enumValues || [];

  const toggleEnumValue = (valToToggle: string) => {
    const exists = values.includes(valToToggle);
    const updatedValues = exists
      ? values.filter((v) => v !== valToToggle)
      : [...values, valToToggle];

    onValuesChange(idx, leaf, updatedValues.join(", "));
  };

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    onValuesChange(idx, leaf, text);
  };

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <span className="text-[10px] text-muted-foreground font-medium flex items-center justify-between">
        <span>
          {isListOp
            ? isEnumOrBool
              ? `Select DB ${colInfo.dataType.toUpperCase()} Values`
              : "Allowed Values (comma-separated)"
            : isSingleValOp
            ? `Target DB ${colInfo.dataType.toUpperCase()} Value`
            : "Condition Evaluation"}
        </span>
        {isEnumOrBool && (
          <span className="text-[9px] font-mono text-indigo-400">
            DB Schema Fields ({schemaEnumValues.length})
          </span>
        )}
      </span>

      {/* ENUM / BOOL List Operator Badges */}
      {isListOp && isEnumOrBool && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/40 border border-border/40">
          {schemaEnumValues.length === 0 ? (
            <span className="text-xs text-muted-foreground italic font-mono">
              No ENUM values defined in DB schema for column {colInfo.columnName}. Add ENUM(...) in Entity node.
            </span>
          ) : (
            schemaEnumValues.map((enumVal) => {
              const isSelected = values.includes(enumVal);
              return (
                <button
                  key={enumVal}
                  type="button"
                  onClick={() => toggleEnumValue(enumVal)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer flex items-center gap-1",
                    isSelected
                      ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/40 font-semibold shadow-xs"
                      : "bg-background text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{enumVal}</span>
                  <span className="text-[10px] opacity-75">
                    {isSelected ? "✓" : "+"}
                  </span>
                </button>
              );
            })
          )}

          {/* Custom value input for Enum */}
          <div className="flex items-center gap-1 ml-auto">
            <Input
              className="h-6 w-24 text-[10px] font-mono bg-background"
              placeholder="+ custom"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customInput.trim()) {
                  toggleEnumValue(customInput.trim());
                  setCustomInput("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (customInput.trim()) {
                  toggleEnumValue(customInput.trim());
                  setCustomInput("");
                }
              }}
              className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono hover:bg-secondary/80 text-foreground border border-border cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* ENUM / BOOL Single Value Select */}
      {isSingleValOp && isEnumOrBool && (
        <Select
          value={singleVal || schemaEnumValues[0] || ""}
          onValueChange={(val) => onSingleValChange(idx, leaf, val)}
        >
          <SelectTrigger className="h-7 text-xs font-mono bg-background">
            <SelectValue placeholder="Select DB schema value" />
          </SelectTrigger>
          <SelectContent className="font-mono">
            {schemaEnumValues.map((val) => (
              <SelectItem key={val} value={val} className="text-xs font-mono">
                {val}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Generic Non-Enum Text Input for List */}
      {isListOp && !isEnumOrBool && (
        <Input
          className="h-7 text-xs font-mono bg-background"
          value={rawText ?? values.join(", ")}
          placeholder="e.g. value1, value2"
          onChange={(e) => handleRawTextChange(e.target.value)}
          onBlur={() => setRawText(null)}
        />
      )}

      {/* Generic Non-Enum Text Input for Single Value */}
      {isSingleValOp && !isEnumOrBool && (
        <Input
          className="h-7 text-xs font-mono bg-background"
          value={singleVal}
          placeholder="e.g. value"
          onChange={(e) => onSingleValChange(idx, leaf, e.target.value)}
        />
      )}

      {!isListOp && !isSingleValOp && (
        <div className="h-7 px-2 flex items-center rounded bg-muted/60 text-[10px] text-muted-foreground font-mono border border-border/40">
          {leaf.op === "signedIn" || leaf.op === "required" || leaf.op === "granted" || leaf.op === "truthy"
            ? "Truthy (Required)"
            : "Falsy (Must be empty)"}
        </div>
      )}
    </div>
  );
};
