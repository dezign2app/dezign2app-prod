"use client";

import React from "react";
import { AlertCircle, AlertTriangle, Database } from "lucide-react";
import { BackendNode } from "@workspace/canvas/types";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { BindingSourceEditor } from "../BindingSourceEditor";
import { AvailableSource, StepBinding } from "../types";

export interface SessionThreadIdSectionProps {
  hasMemory: boolean;
  selectedAgentNode: BackendNode | undefined;
  checkpointerWarning: string | null;
  threadIdSource: string | undefined;
  threadBinding: StepBinding;
  availableSources: AvailableSource[];
  serviceNodeId?: string;
  endpointHasThreadId: boolean;
  canEditEndpoint: boolean;
  projectId?: string;
  onThreadBindingChange: (updated: StepBinding) => void;
  onAddThreadIdToRequestBody: () => void;
  onUseHeaderThreadId: () => void;
}

export const SessionThreadIdSection: React.FC<SessionThreadIdSectionProps> = ({
  hasMemory,
  selectedAgentNode,
  checkpointerWarning,
  threadIdSource,
  threadBinding,
  availableSources,
  serviceNodeId,
  endpointHasThreadId,
  canEditEndpoint,
  projectId,
  onThreadBindingChange,
  onAddThreadIdToRequestBody,
  onUseHeaderThreadId,
}) => {
  if (!hasMemory) return null;

  return (
    <div className="flex flex-col gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <Label className="text-xs font-bold text-foreground">
            Session Thread ID (Checkpointer Memory)
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="text-[9px] font-mono border-primary/40 text-primary bg-primary/10"
            title="Configurable runtime option passed directly to LangGraph checkpointer"
          >
            configurable.thread_id
          </Badge>
          <Badge
            variant="outline"
            className="text-[9px] font-mono border-emerald-500/40 text-emerald-400 bg-emerald-500/15"
          >
            {selectedAgentNode?.data?.memoryConfig?.checkpointer || "memory"} checkpointer
          </Badge>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        LangGraph automatically queries the checkpointer database to retrieve the full chat history for this <code className="font-mono text-emerald-400">thread_id</code>. It is an execution config parameter (<code className="font-mono text-primary">configurable.thread_id</code>), not a state variable. Only the new user message needs to be mapped into state channels.
      </p>

      {/* Checkpointer storage health warning */}
      {checkpointerWarning && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>Checkpointer Storage Not Ready</span>
            </div>
            {projectId && selectedAgentNode && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-5 text-[9px] px-1.5 border-rose-500/40 text-rose-200 bg-rose-500/10 hover:bg-rose-500/20"
                onClick={() => {
                  window.open(`/project/${projectId}/langgraph/${selectedAgentNode.id}`, "_blank");
                }}
              >
                Open Studio to Fix
              </Button>
            )}
          </div>
          <p className="text-[10px] text-rose-200/80 leading-relaxed">
            {checkpointerWarning}
          </p>
        </div>
      )}

      <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-2 rounded-lg border border-emerald-500/20">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-bold text-emerald-400 text-[11px] truncate bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            thread_id
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">string</span>
        </div>
        <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
        <div className="min-w-0">
          <BindingSourceEditor
            binding={threadBinding}
            availableSources={availableSources}
            serviceNodeId={serviceNodeId}
            onChange={onThreadBindingChange}
          />
        </div>
        <div className="w-6" />
      </div>

      {!endpointHasThreadId && canEditEndpoint && (
        <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>Endpoint contract does not define a thread ID field</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Add <code className="font-mono text-amber-300">thread_id</code> to the endpoint contract so client applications can send a session ID to resume conversation context.
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-[10px] font-semibold px-2 py-0 border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200"
              onClick={onAddThreadIdToRequestBody}
            >
              + Add &quot;thread_id&quot; to Request Body
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] font-semibold px-2 py-0 text-muted-foreground hover:text-foreground"
              onClick={onUseHeaderThreadId}
            >
              Use Header (x-thread-id)
            </Button>
          </div>
        </div>
      )}

      {!threadIdSource && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>Defaults to <code className="font-mono font-bold">body.thread_id</code>. Provide a session/thread ID so the agent can resume conversation context.</span>
        </div>
      )}
    </div>
  );
};
