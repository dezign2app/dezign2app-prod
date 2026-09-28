import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import {
  Layers,
  Code2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import type { ActionFlowEditorProps, FrontendActionStepDraft, FrontendActionStepType } from "./types";
import { deriveStepsFromEdges, getActionFlowRuntime } from "./utils";
import { FrontendAddStepToolbar } from "./FrontendAddStepToolbar";
import { FrontendStepRow } from "./FrontendStepRow";
import { createDefaultFrontendStep } from "./frontendStepFactory";
import {
  ensureActionServiceConnection,
  ensureActionStorageConnection,
  cleanupActionStepEdge,
  reorderActionStepEdges,
} from "./actionStepCanvasSync";

export const ActionFlowEditor: React.FC<ActionFlowEditorProps> = ({
  item,
  canvasSteps,
  serviceNodes,
  allNodes,
  endpoints,
  webPageNodeId = "",
  actionId = "",
  onSave,
  onDeleteStep,
}) => {
  const [drafts, setDrafts] = useState<FrontendActionStepDraft[]>(() => {
    if (item?.actionSteps && item.actionSteps.length > 0) {
      return item.actionSteps;
    }
    return deriveStepsFromEdges(canvasSteps, item?.actionSteps);
  });
  const [showRuntimePreview, setShowRuntimePreview] = useState(false);

  // Sync with item.actionSteps or canvasSteps if external changes happen
  useEffect(() => {
    if (item?.actionSteps && item.actionSteps.length > 0) {
      setDrafts(item.actionSteps);
    } else if (canvasSteps.length > 0) {
      const derived = deriveStepsFromEdges(canvasSteps, item?.actionSteps);
      setDrafts(derived);
    }
  }, [item?.actionSteps, canvasSteps]);

  const handleAddStep = (type: FrontendActionStepType) => {
    const newOrder = drafts.length + 1;
    let initialDefaults: Partial<FrontendActionStepDraft> = {};

    // Auto-draw canvas edge if adding an api_call step and service is available
    if (type === "api_call" && serviceNodes.length > 0) {
      const firstService = serviceNodes[0];
      const srvEndpoints = endpoints.filter((ep) => ep.nodeId === firstService?.id);
      const firstEndpoint = srvEndpoints[0];
      if (firstService && firstEndpoint && webPageNodeId && actionId) {
        const edgeId = ensureActionServiceConnection({
          webPageNodeId,
          actionId,
          serviceNodeId: firstService.id,
          endpointId: firstEndpoint.id,
          stepOrder: newOrder,
        });
        initialDefaults = {
          serviceNodeId: firstService.id,
          endpointId: firstEndpoint.id,
          edgeId,
        };
      }
    }

    // Auto-draw canvas edge if adding a storage_put step and bucket is available
    if (type === "storage_put") {
      const storageNode = allNodes.find((n) => n.type === "storage");
      const bucket = storageNode?.data?.buckets?.[0];
      const bucketId = bucket?.id || bucket?.name || "default-bucket";
      if (webPageNodeId && actionId) {
        const res = ensureActionStorageConnection({
          webPageNodeId,
          actionId,
          storageNodeId: storageNode?.id,
          bucketId,
          stepOrder: newOrder,
        });
        initialDefaults = {
          bucketId,
          storageNodeId: storageNode?.id,
          storageRefNodeId: res?.refNodeId,
          edgeId: res?.edgeId,
        };
      }
    }

    const newStep = createDefaultFrontendStep(type, newOrder, initialDefaults);
    const updatedDrafts = [...drafts, newStep];
    setDrafts(updatedDrafts);
    onSave(updatedDrafts);
  };

  const handleStepChange = (updatedStep: FrontendActionStepDraft) => {
    const nextDrafts = drafts.map((d) =>
      d.id === updatedStep.id ? updatedStep : d,
    );
    setDrafts(nextDrafts);
    onSave(nextDrafts);
  };

  const handleDeleteStep = (stepId: string) => {
    const stepToDelete = drafts.find((d) => d.id === stepId);
    if (stepToDelete?.edgeId) {
      cleanupActionStepEdge(stepToDelete.edgeId);
      if (onDeleteStep) {
        onDeleteStep(stepToDelete.edgeId);
      }
    }

    const remaining = drafts
      .filter((d) => d.id !== stepId)
      .map((d, idx) => ({ ...d, order: idx + 1 }));

    if (webPageNodeId && actionId) {
      reorderActionStepEdges(remaining, webPageNodeId, actionId);
    }

    setDrafts(remaining);
    onSave(remaining);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const fromIdx = result.source.index;
    const toIdx = result.destination.index;
    if (fromIdx === toIdx) return;

    const reordered = Array.from(drafts);
    const [moved] = reordered.splice(fromIdx, 1);
    if (!moved) return;
    reordered.splice(toIdx, 0, moved);

    const updated = reordered.map((d, idx) => ({ ...d, order: idx + 1 }));

    if (webPageNodeId && actionId) {
      reorderActionStepEdges(updated, webPageNodeId, actionId);
    }

    setDrafts(updated);
    onSave(updated);
  };

  const runtimePlan = getActionFlowRuntime(item, canvasSteps, drafts);

  return (
    <div className="space-y-3">
      {/* Top Header matching PipelineStepEditor */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              Pipeline Steps
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {drafts.length} {drafts.length === 1 ? "step" : "steps"}
            </Badge>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Explicit field-level bindings per step — compiler generates client interaction flow.
        </p>
      </div>

      {/* Steps List with Drag & Drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="frontend-action-steps-droppable">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-2"
            >
              {drafts.length === 0 ? (
                <div className="p-4 border border-dashed rounded-lg bg-muted/10 text-center space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    No action steps configured.
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Use the toolbar below to add API requests, state manipulators, uploads, or navigation.
                  </p>
                </div>
              ) : (
                drafts.map((step, idx) => {
                  const matchingCanvasStep = canvasSteps.find(
                    (cs) => cs.edgeId === step.edgeId || cs.step === step.order,
                  );

                  return (
                    <FrontendStepRow
                      key={step.id}
                      step={step}
                      index={idx}
                      canvasStep={matchingCanvasStep}
                      allSteps={drafts}
                      allCanvasSteps={canvasSteps}
                      allNodes={allNodes}
                      serviceNodes={serviceNodes}
                      endpoints={endpoints}
                      webPageNodeId={webPageNodeId}
                      actionId={actionId}
                      onChange={handleStepChange}
                      onDelete={() => handleDeleteStep(step.id)}
                    />
                  );
                })
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Step Toolbar matching PipelineStepEditor */}
      <div className="pt-1">
        <FrontendAddStepToolbar onAddStep={handleAddStep} />
      </div>

      {/* Collapsible Runtime Execution Preview */}
      {drafts.length > 0 && (
        <div className="pt-2 border-t border-border/30">
          <button
            type="button"
            onClick={() => setShowRuntimePreview(!showRuntimePreview)}
            className="w-full flex items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground py-1 px-1 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Code2 size={12} />
              Runtime Execution Plan
            </span>
            {showRuntimePreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showRuntimePreview && (
            <div className="mt-1.5 p-2.5 rounded-md bg-muted/40 border text-[10px] font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {runtimePlan}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
