import React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@workspace/ui/components/button";

export interface TestingStateTabProps {
  finalState?: Record<string, unknown>;
  isTraceExpanded: boolean;
  copiedKey: boolean;
  copyStateJson: () => void;
}

export function TestingStateTab({
  finalState,
  isTraceExpanded,
  copiedKey,
  copyStateJson,
}: TestingStateTabProps) {
  if (!finalState) {
    return (
      <div className="text-center p-6 border rounded-xl border-dashed text-muted-foreground text-[11px]">
        No state recorded yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">
          Active State Channels
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={copyStateJson}
        >
          {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          Copy JSON
        </Button>
      </div>
      <pre
        className={`p-2.5 rounded-lg bg-background border font-mono text-[10px] text-foreground overflow-y-auto hide-scrollbar transition-all ${
          isTraceExpanded ? "max-h-[600px]" : "max-h-[380px]"
        }`}
      >
        {JSON.stringify(finalState, null, 2)}
      </pre>
    </div>
  );
}
