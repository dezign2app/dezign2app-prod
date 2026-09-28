import React from "react";
import { GitBranch } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import type { FrontendActionStepDraft } from "./types";

export interface ConditionStepProps {
  draft: FrontendActionStepDraft;
  onChange: (updated: FrontendActionStepDraft) => void;
}

const CONDITION_PRESETS = [
  "isFormValid === true",
  "currentUser != null",
  "selectedFile != null",
  "fileSize <= 5000000",
  "status === 'success'",
];

export const ConditionStep: React.FC<ConditionStepProps> = ({
  draft,
  onChange,
}) => {
  const expr = draft.conditionExpr || "";

  return (
    <div className="space-y-2.5 pt-1 text-xs">
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">
          Condition Expression (runs client-side)
        </Label>
        <Input
          value={expr}
          onChange={(e) => onChange({ ...draft, conditionExpr: e.target.value })}
          placeholder="e.g. isFormValid === true || selectedFile != null"
          className="h-7 text-xs bg-background font-mono"
        />
      </div>

      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground">Quick Presets:</span>
        <div className="flex flex-wrap gap-1">
          {CONDITION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ ...draft, conditionExpr: preset })}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-muted/30 hover:bg-muted font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
