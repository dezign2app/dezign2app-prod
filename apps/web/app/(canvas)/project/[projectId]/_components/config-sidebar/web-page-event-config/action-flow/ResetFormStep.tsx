import React from "react";
import { RotateCcw } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { FrontendActionStepDraft } from "./types";

export interface ResetFormStepProps {
  draft: FrontendActionStepDraft;
  onChange: (updated: FrontendActionStepDraft) => void;
}

export const ResetFormStep: React.FC<ResetFormStepProps> = ({
  draft,
  onChange,
}) => {
  const formTarget = draft.formTarget || "current_section";

  return (
    <div className="space-y-3 pt-1 text-xs">
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">
          Form Reset Target
        </Label>
        <Select
          value={formTarget}
          onValueChange={(val) => onChange({ ...draft, formTarget: val })}
        >
          <SelectTrigger className="h-7 text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_section">Current Section Inputs</SelectItem>
            <SelectItem value="entire_page">All Page Inputs</SelectItem>
            <SelectItem value="custom">Custom Form Identifier</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formTarget === "custom" && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Form Selector / ID
          </Label>
          <Input
            value={draft.description || ""}
            onChange={(e) =>
              onChange({ ...draft, description: e.target.value })
            }
            placeholder="e.g. #upload-form or myForm"
            className="h-7 text-xs bg-background font-mono"
          />
        </div>
      )}
    </div>
  );
};
