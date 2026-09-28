import React from "react";
import { Terminal, Sparkles } from "lucide-react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import type { FrontendActionStepDraft } from "./types";

export interface CustomCodeStepProps {
  draft: FrontendActionStepDraft;
  onChange: (updated: FrontendActionStepDraft) => void;
}

const PRESETS = [
  {
    label: "Prevent Default",
    code: "event.preventDefault();",
  },
  {
    label: "Log Event",
    code: "console.log('Action event triggered:', event);",
  },
  {
    label: "Validate Form",
    code: "if (!form.checkValidity()) {\n  form.reportValidity();\n  return false;\n}",
  },
  {
    label: "Track Analytics",
    code: "analytics.track('button_clicked', { timestamp: Date.now() });",
  },
];

export const CustomCodeStep: React.FC<CustomCodeStepProps> = ({
  draft,
  onChange,
}) => {
  const code = draft.code || "";

  return (
    <div className="space-y-2.5 pt-1 text-xs">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">
          Client-Side JavaScript / TypeScript
        </Label>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Sparkles size={11} className="text-primary" />
          Snippets available
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange({ ...draft, code: p.code })}
            className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-muted/30 hover:bg-muted font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={code}
        onChange={(e) => onChange({ ...draft, code: e.target.value })}
        rows={4}
        placeholder="// Custom client logic (receives `event`, `state`, `context`)"
        className="w-full text-xs font-mono p-2 rounded border bg-background text-foreground resize-y focus:outline-hidden focus:ring-1 focus:ring-ring"
      />
    </div>
  );
};
