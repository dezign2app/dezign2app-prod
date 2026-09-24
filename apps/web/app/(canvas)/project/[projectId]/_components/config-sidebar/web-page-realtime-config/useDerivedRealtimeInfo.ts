import { useMemo } from "react";
import { BackendNode, PipelineStep } from "@workspace/canvas/types";
import { EventWithNode, EndpointWithNode } from "@/lib/stores/backendCanvasStore";
import { DerivedRealtimeInfo } from "./types";

export function useDerivedRealtimeInfo(
  id: string,
  nodeId: string,
  events: EventWithNode[],
  endpoints: EndpointWithNode[],
  nodes: BackendNode[],
): DerivedRealtimeInfo | null {
  return useMemo(() => {
    const findInSteps = (steps: PipelineStep[] | undefined): PipelineStep | null => {
      if (!steps) return null;
      for (const step of steps) {
        if (
          step.id === id ||
          (step.type === "push_to_client" &&
            step.clientDeliveryTargetPageId === nodeId &&
            step.id === id)
        ) {
          return step;
        }
        const found =
          findInSteps(step.thenSteps) ||
          findInSteps(step.elseSteps) ||
          findInSteps(step.trySteps) ||
          findInSteps(step.catchSteps) ||
          findInSteps(step.loopBody);
        if (found) return found;
        if (step.switchCases) {
          for (const sc of step.switchCases) {
            const scFound = findInSteps(sc.steps);
            if (scFound) return scFound;
          }
        }
        if (step.switchDefault) {
          const sdFound = findInSteps(step.switchDefault);
          if (sdFound) return sdFound;
        }
        if (step.parallelBranches) {
          for (const pb of step.parallelBranches) {
            const pbFound = findInSteps(pb.steps);
            if (pbFound) return pbFound;
          }
        }
      }
      return null;
    };

    for (const ev of events) {
      if (ev.pipelineSteps && ev.nodeId) {
        const step = findInSteps(ev.pipelineSteps);
        if (step) {
          return {
            step,
            sourceNode: nodes.find((n) => n.id === ev.nodeId),
            sourceEventId: ev.id,
            sourceEndpointId: null,
          };
        }
      }
    }

    for (const ep of endpoints) {
      if (ep.pipelineSteps && ep.nodeId) {
        const step = findInSteps(ep.pipelineSteps);
        if (step) {
          return {
            step,
            sourceNode: nodes.find((n) => n.id === ep.nodeId),
            sourceEventId: null,
            sourceEndpointId: ep.id,
          };
        }
      }
    }

    return null;
  }, [id, nodeId, events, endpoints, nodes]);
}
