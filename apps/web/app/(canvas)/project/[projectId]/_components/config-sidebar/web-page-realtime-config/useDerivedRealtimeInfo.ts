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
    const isStepMatch = (step: PipelineStep): boolean => {
      if (step.id !== id) return false;
      if (step.type === "push_to_client") return true;
      if (
        step.type === "langgraph_invoke" &&
        step.langGraphStreamingEnabled &&
        (step.langGraphStreamingProtocol === "sse" ||
          step.langGraphStreamingProtocol === "websocket" ||
          !step.langGraphStreamingProtocol)
      ) {
        return true;
      }
      return false;
    };

    const findInSteps = (steps: PipelineStep[] | undefined): PipelineStep | null => {
      if (!steps) return null;
      for (const step of steps) {
        if (isStepMatch(step)) {
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

    // Check embedded endpoints/consumedEvents in service nodes
    for (const n of nodes) {
      if (n.type === "service" && Array.isArray(n.data?.endpoints)) {
        for (const ep of n.data.endpoints) {
          if (ep.pipelineSteps) {
            const step = findInSteps(ep.pipelineSteps);
            if (step) {
              return {
                step,
                sourceNode: n,
                sourceEventId: null,
                sourceEndpointId: ep.id,
              };
            }
          }
        }
      }
      if (n.type === "service" && Array.isArray(n.data?.consumedEvents)) {
        for (const ev of n.data.consumedEvents) {
          if (ev.pipelineSteps) {
            const step = findInSteps(ev.pipelineSteps);
            if (step) {
              return {
                step,
                sourceNode: n,
                sourceEventId: ev.id,
                sourceEndpointId: null,
              };
            }
          }
        }
      }
    }

    return null;
  }, [id, nodeId, events, endpoints, nodes]);
}
