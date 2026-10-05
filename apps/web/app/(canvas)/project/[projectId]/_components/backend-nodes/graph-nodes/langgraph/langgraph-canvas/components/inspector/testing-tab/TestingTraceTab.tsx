import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import type { BrowserExecutionResult } from "@/lib/simulation/browserLangGraphRunner";
import type { LangGraphCanvasNode, LangGraphCanvasEdge } from "@workspace/canvas";
import type { TraceViewMode, BatchFormatMode } from "./types";
import { TraceStepItem } from "./trace/TraceStepItem";

export interface TestingTraceTabProps {
  executionResult: BrowserExecutionResult | null;
  isTraceExpanded: boolean;
  setIsTraceExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  expandedTraceNodes: Record<number, boolean>;
  setExpandedTraceNodes: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  traceNodeViews: Record<number, TraceViewMode>;
  setTraceNodeViews: React.Dispatch<React.SetStateAction<Record<number, TraceViewMode>>>;
  batchFormatViews: Record<number, BatchFormatMode>;
  setBatchFormatViews: React.Dispatch<React.SetStateAction<Record<number, BatchFormatMode>>>;
  expandedBatchRaw: Record<string, boolean>;
  expandedLogDetails: Record<string, boolean>;
  setExpandedLogDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  provider: string;
  modelName: string;
}

export function TestingTraceTab({
  executionResult,
  isTraceExpanded,
  setIsTraceExpanded,
  nodes,
  edges,
  expandedTraceNodes,
  setExpandedTraceNodes,
  traceNodeViews,
  setTraceNodeViews,
  batchFormatViews,
  setBatchFormatViews,
  expandedBatchRaw,
  expandedLogDetails,
  setExpandedLogDetails,
  provider,
  modelName,
}: TestingTraceTabProps) {
  if (!executionResult) {
    return (
      <div className="text-center p-6 border rounded-xl border-dashed text-muted-foreground text-[11px]">
        Click <strong>Run Graph</strong> to test in your browser.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pb-0.5">
        <span
          className="font-mono truncate max-w-[240px]"
          title={executionResult.visitedNodes.join(" → ")}
        >
          Path: {executionResult.visitedNodes.join(" → ")}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono">{executionResult.totalDurationMs}ms</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1.5 gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setIsTraceExpanded((v) => !v)}
            title={isTraceExpanded ? "Collapse trace view" : "Expand trace view"}
          >
            {isTraceExpanded ? (
              <>
                <Minimize2 className="w-3 h-3" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3" />
                <span>Expand</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div
        className={`flex flex-col gap-1.5 overflow-y-auto hide-scrollbar transition-all duration-200 ${
          isTraceExpanded
            ? "min-h-[460px] max-h-[750px]"
            : "min-h-[300px] max-h-[500px]"
        }`}
      >
        {executionResult.trace.map((step, idx) => (
          <TraceStepItem
            key={idx}
            step={step}
            idx={idx}
            nodes={nodes}
            edges={edges}
            isTraceExpanded={isTraceExpanded}
            expandedTraceNodes={expandedTraceNodes}
            setExpandedTraceNodes={setExpandedTraceNodes}
            traceNodeViews={traceNodeViews}
            setTraceNodeViews={setTraceNodeViews}
            batchFormatViews={batchFormatViews}
            setBatchFormatViews={setBatchFormatViews}
            expandedBatchRaw={expandedBatchRaw}
            expandedLogDetails={expandedLogDetails}
            setExpandedLogDetails={setExpandedLogDetails}
            finalState={executionResult.finalState}
            provider={provider}
            modelName={modelName}
          />
        ))}
      </div>
    </div>
  );
}
