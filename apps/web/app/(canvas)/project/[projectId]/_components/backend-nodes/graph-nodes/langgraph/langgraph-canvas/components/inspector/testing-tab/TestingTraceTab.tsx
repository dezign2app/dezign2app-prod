import React from "react";
import type { BrowserExecutionResult } from "@/lib/simulation/browserLangGraphRunner";
import type { LangGraphCanvasNode, LangGraphCanvasEdge } from "@workspace/canvas";
import type { TraceViewMode, BatchFormatMode } from "./types";
import { TraceStepItem } from "./trace/TraceStepItem";

export interface TestingTraceTabProps {
  executionResult: BrowserExecutionResult | null;
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
        </div>
      </div>

      <div
        className={`flex flex-col gap-1.5 overflow-y-auto hide-scrollbar transition-all duration-200 pb-20`}
      >
        {executionResult.trace.map((step, idx) => (
          <TraceStepItem
            key={idx}
            step={step}
            idx={idx}
            nodes={nodes}
            edges={edges}
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
