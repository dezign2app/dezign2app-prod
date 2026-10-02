import React from "react";
import { Code2, X, Check } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { LocalInput, LocalTextarea } from "../../../../../../common";
import { TargetVariableCombobox } from "./TargetVariableCombobox";
import { REDUCER_CODE_PRESETS } from "../constants";
import type { LangGraphStateChannel } from "@/types/canvas";

interface EditCustomReducerFormProps {
  availableFieldKeys: string[];
  stateChannels: LangGraphStateChannel[];
  editTargetField: string;
  editTargetFieldInput: string;
  editReducerName: string;
  editReducerCode: string;
  editReducerDesc: string;
  onSelectTargetField: (val: string) => void;
  onTargetFieldInputChange: (text: string) => void;
  onReducerNameChange: (name: string) => void;
  onReducerCodeChange: (code: string) => void;
  onReducerDescChange: (desc: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditCustomReducerForm({
  availableFieldKeys,
  stateChannels,
  editTargetField,
  editTargetFieldInput,
  editReducerName,
  editReducerCode,
  editReducerDesc,
  onSelectTargetField,
  onTargetFieldInputChange,
  onReducerNameChange,
  onReducerCodeChange,
  onReducerDescChange,
  onSave,
  onCancel,
}: EditCustomReducerFormProps) {
  return (
    <div id="edit-custom-reducer-form" className="flex flex-col gap-2.5 p-2.5 rounded-xl border border-purple-500/50 bg-purple-500/10 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
          <Code2 className="w-3.5 h-3.5" /> Edit Custom Reducer
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <TargetVariableCombobox
        availableFieldKeys={availableFieldKeys}
        stateChannels={stateChannels}
        value={editTargetField}
        onSelectValue={onSelectTargetField}
        inputValue={editTargetFieldInput}
        onInputValueChange={onTargetFieldInputChange}
        labelSize="small"
        placeholder="Search state variable..."
        badgeLabel="Tied to state variable"
      />

      <div className="flex flex-col gap-1">
        <Label className="text-[9px] text-muted-foreground font-mono">
          Reducer Name
        </Label>
        <LocalInput
          className="h-7 text-xs font-mono font-medium bg-background"
          placeholder="reducer_name"
          value={editReducerName}
          onChange={(e) => onReducerNameChange(e.target.value)}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label className="text-[9px] text-muted-foreground font-mono">
            Function Body (JavaScript)
          </Label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onReducerCodeChange(REDUCER_CODE_PRESETS.array)}
              className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
              title="Append array values"
            >
              +array
            </button>
            <button
              type="button"
              onClick={() => onReducerCodeChange(REDUCER_CODE_PRESETS.object)}
              className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
              title="Merge object keys"
            >
              +merge
            </button>
            <button
              type="button"
              onClick={() => onReducerCodeChange(REDUCER_CODE_PRESETS.number)}
              className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-mono transition-colors cursor-pointer"
              title="Sum numbers"
            >
              +sum
            </button>
          </div>
        </div>
        <LocalTextarea
          className="min-h-[72px] text-xs font-mono bg-background leading-relaxed p-2 resize-y"
          placeholder="(prev, next) => Array.isArray(prev) ? [...prev, ...next] : next"
          value={editReducerCode}
          onChange={(e) => onReducerCodeChange(e.target.value)}
          debounceMs={150}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[9px] text-muted-foreground font-mono">
          Description (optional)
        </Label>
        <LocalInput
          className="h-7 text-xs bg-background"
          placeholder="Description"
          value={editReducerDesc}
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
          disabled={!editReducerName.trim()}
        >
          <Check className="w-3 h-3" /> Save Changes
        </Button>
      </div>
    </div>
  );
}
