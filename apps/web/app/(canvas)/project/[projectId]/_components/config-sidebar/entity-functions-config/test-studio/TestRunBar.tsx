import React from "react";
import { Play, RefreshCw } from "lucide-react";
import { DbOperationTestCase } from "@workspace/canvas/types";
import { Button } from "@workspace/ui/components/button";

export interface TestRunBarProps {
  executing: boolean;
  activeCase: DbOperationTestCase;
  onRunTest: () => void;
}

export const TestRunBar: React.FC<TestRunBarProps> = ({
  executing,
  activeCase,
  onRunTest,
}) => {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-border/40">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onRunTest}
          disabled={executing}
          className="h-8 gap-2 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
        >
          {executing ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Play size={13} className="fill-current" />
          )}
          {executing ? "Running..." : "Run Test"}
        </Button>

        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">Ctrl+Enter</kbd> to run
        </span>
      </div>

      {activeCase.lastResult && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground font-mono">
            Duration:{" "}
            <strong className="text-foreground">{activeCase.lastResult.durationMs ?? 0}ms</strong>
          </span>
          <span className="text-[11px] text-muted-foreground">
            at {activeCase.lastResult.executedAt}
          </span>
        </div>
      )}
    </div>
  );
};
