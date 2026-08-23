import React, { useState } from "react";
import { AnyMessagingResource, BackendNode, BackendEdge } from "@workspace/canvas/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { LocalInput, LocalTextarea } from "../../backend-nodes/graph-nodes/shared";
import { ConfigItemData } from "./types";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isEndpointPipelineUnconfigured } from "@/lib/utils/pipelineValidation";
import { PipelineStepEditor } from "../PipelineStepEditor";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

interface ConsumerConfigProps {
  item: ConfigItemData;
  handleUpdate: (eventId: string, changes: Partial<AnyMessagingResource>) => void;
  nodes?: BackendNode[];
  edges?: BackendEdge[];
  nodeId?: string;
}

export const ConsumerConfig: React.FC<ConsumerConfigProps> = ({
  item,
  handleUpdate,
  nodes = [],
  edges = [],
  nodeId,
}) => {
  const [pipelineExpanded, setPipelineExpanded] = useState(true);
  const storeNodes = useBackendCanvasStore((s) => s.nodes);
  const storeEdges = useBackendCanvasStore((s) => s.edges);

  const isPipelineRed = React.useMemo(
    () =>
      isEndpointPipelineUnconfigured(
        item,
        nodeId || "",
        nodes.length ? nodes : storeNodes,
        edges.length ? edges : storeEdges,
      ),
    [item, nodeId, nodes, edges, storeNodes, storeEdges],
  );

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* PIPELINE STEPS SECTION                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col gap-2 border border-border/40 rounded-xl overflow-hidden mt-4 transition-colors">
        <button
          type="button"
          className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors text-left"
          onClick={() => setPipelineExpanded((v) => !v)}
        >
          <div>
            <p className="text-[11px] font-semibold text-foreground/90 flex items-center gap-1.5 flex-wrap">
              <span>Pipeline Steps</span>
              {item.pipelineSteps && item.pipelineSteps.length > 0 && (
                <span className="text-[9px] text-primary/70 font-mono bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {item.pipelineSteps.length} step{item.pipelineSteps.length !== 1 ? "s" : ""}
                </span>
              )}
              {isPipelineRed && (
                <span className="text-[9px] font-bold text-destructive font-mono bg-destructive/15 border border-destructive/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  ⚠️ Unconfigured Inputs
                </span>
              )}
            </p>
            <p className="text-[9px] text-muted-foreground/60 mt-0.5">
              Transform incoming payload, query/mutate database, or emit downstream events.
            </p>
          </div>
          {pipelineExpanded ? (
            <ChevronDown size={13} className="text-muted-foreground/50 shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-muted-foreground/50 shrink-0" />
          )}
        </button>

        {pipelineExpanded && (
          <div className="px-3 pb-3">
            <PipelineStepEditor
              steps={item.pipelineSteps || []}
              onChange={(steps) =>
                handleUpdate(item.id, { pipelineSteps: steps })
              }
              consumedEvent={item}
              allNodes={nodes}
              allEdges={edges}
              serviceNodeId={nodeId}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-4">
        <span className="text-xs font-bold text-muted-foreground">
          Custom Handler Logic (Optional)
        </span>
        <LocalTextarea
          className="min-h-[80px] text-xs font-mono"
          placeholder="Additional fallback logic or notes when this event is received..."
          value={item.handlerLogic || ""}
          onBlur={(e) =>
            handleUpdate(item.id, { handlerLogic: e.target.value })
          }
        />
      </div>

      <div className="flex flex-col gap-4 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            Retry Policy
          </span>
          <Select
            value={item.retryPolicy || "NONE"}
            onValueChange={(v) => handleUpdate(item.id, { retryPolicy: v })}
          >
            <SelectTrigger className="w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE" className="text-xs">
                None
              </SelectItem>
              <SelectItem value="EXPONENTIAL_BACKOFF" className="text-xs">
                Exponential Backoff
              </SelectItem>
              <SelectItem value="FIXED_INTERVAL" className="text-xs">
                Fixed Interval
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            Max Retries
          </span>
          <LocalInput
            type="number"
            className="w-24 text-xs text-right"
            placeholder="e.g. 3"
            value={item.maxRetries ?? ""}
            onBlur={(e) =>
              handleUpdate(item.id, { maxRetries: parseInt(e.target.value) })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">DLQ</span>
          <LocalInput
            className="flex-1 text-xs font-mono"
            placeholder="dlq-topic-name"
            value={item.deadLetterQueue || ""}
            onBlur={(e) =>
              handleUpdate(item.id, { deadLetterQueue: e.target.value })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`idempotent-${item.id}`}
            checked={item.isIdempotent || false}
            onChange={(e) =>
              handleUpdate(item.id, { isIdempotent: e.target.checked })
            }
          />
          <label
            htmlFor={`idempotent-${item.id}`}
            className="text-xs font-bold text-muted-foreground cursor-pointer"
          >
            Idempotent Consumer
          </label>
        </div>
      </div>
    </>
  );
};
