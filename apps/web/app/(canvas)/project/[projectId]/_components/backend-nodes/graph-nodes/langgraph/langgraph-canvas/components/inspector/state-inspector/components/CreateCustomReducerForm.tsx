import React from "react";
import { Code2, X, Check } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { LocalInput, LocalTextarea } from "../../../../../../common";
import { TargetVariableCombobox } from "./TargetVariableCombobox";
import { REDUCER_CODE_PRESETS } from "../constants";
import type { LangGraphStateChannel } from "@/types/canvas";

interface CreateCustomReducerFormProps {
  availableFieldKeys: string[];
  stateChannels: LangGraphStateChannel[];
  newTargetField: string;
  newTargetFieldInput: string;
  newReducerName: string;
  newReducerCode: string;
  newReducerDesc: string;
  onSelectTargetField: (fieldKey: string) => void;
  onTargetFieldInputChange: (text: string) => void;
  onReducerNameChange: (name: string) => void;
  onReducerCodeChange: (code: string) => void;
  onReducerDescChange: (desc: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function CreateCustomReducerForm({
  availableFieldKeys,
  stateChannels,
  newTargetField,
  newTargetFieldInput,
  newReducerName,
  newReducerCode,
  newReducerDesc,
  onSelectTargetField,
  onTargetFieldInputChange,
  onReducerNameChange,
  onReducerCodeChange,
  onReducerDescChange,
  onSave,
  onCancel,
}: CreateCustomReducerFormProps) {
  return (
    <div id="create-custom-reducer-form" className="flex flex-col gap-2.5 p-3 rounded-xl border border-purple-500/40 bg-purple-500/5 shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <Code2 className="w-3.5 h-3.5" /> Define Custom Reducer
        </span>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <TargetVariableCombobox
        availableFieldKeys={availableFieldKeys}
        stateChannels={stateChannels}
        value={newTargetField}
        onSelectValue={onSelectTargetField}
        inputValue={newTargetFieldInput}
        onInputValueChange={(text) => {
          onTargetFieldInputChange(text);
          if (
            text &&
            (!newReducerName ||
              newReducerName.endsWith("_reducer") ||
              newReducerName === "custom_reducer")
          ) {
            onReducerNameChange(`${text.trim()}_reducer`);
          }
        }}
        autoFocus
      />

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground font-mono">
          Reducer Name
        </Label>
        <LocalInput
          className="h-7 text-xs font-mono font-medium bg-background"
          placeholder="e.g. sum_scores, dedup_append"
          value={newReducerName}
          onChange={(e) => onReducerNameChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground font-mono">
            Reducer Function Body (JavaScript)
          </Label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onReducerCodeChange(REDUCER_CODE_PRESETS.chat);
                onSelectTargetField("messages");
                if (
                  !newReducerName ||
                  newReducerName.endsWith("_reducer") ||
                  newReducerName === "custom_reducer"
                ) {
                  onReducerNameChange("add_messages");
                }
              }}
              className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-mono transition-colors cursor-pointer"
              title="Chat history dedup & append"
            >
              +chat (messages)
            </button>
            <button
              type="button"
              onClick={() => onReducerCodeChange(REDUCER_CODE_PRESETS.array)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
              title="Append array values"
            >
              +array
            </button>
            <button
              type="button"
              onClick={() => onReducerCodeChange(REDUCER_CODE_PRESETS.object)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
              title="Merge object keys"
            >
              +merge
            </button>
            <button
              type="button"
              onClick={() => onReducerCodeChange(REDUCER_CODE_PRESETS.number)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
              title="Sum numbers"
            >
              +sum
            </button>
          </div>
        </div>
        <LocalTextarea
          className="min-h-[72px] text-xs font-mono bg-background leading-relaxed p-2 resize-y"
          placeholder="(prev, next) => prev + next"
          value={newReducerCode}
          onChange={(e) => onReducerCodeChange(e.target.value)}
          debounceMs={150}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground font-mono">
          Description (optional)
        </Label>
        <LocalInput
          className="h-7 text-xs bg-background"
          placeholder="Brief description of the reduction logic"
          value={newReducerDesc}
          onChange={(e) => onReducerDescChange(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-6 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1 cursor-pointer"
          onClick={onSave}
          disabled={!newReducerName.trim()}
        >
          <Check className="w-3 h-3" /> Save &amp; Tie Reducer
        </Button>
      </div>
    </div>
  );
}
