import {
  Endpoint,
  BackendNode,
  AnyMessagingResource,
} from "@workspace/canvas/types";
import {
  PipelineStepDraft,
  AvailableSource,
} from "../types";
import { getEndpointSources, createEnvExtraSource } from "./endpointSources";
import { createStepSource } from "./step-resolvers";

/**
 * Derives all available data sources and their sub-paths for argument bindings
 * at a given step in the pipeline editor.
 */
export function getAvailableSources(
  endpoint?: Endpoint,
  priorSteps: readonly PipelineStepDraft[] = [],
  allNodes: BackendNode[] = [],
  consumedEvent?: AnyMessagingResource,
  extraSources: readonly AvailableSource[] = [],
  serviceNodeId?: string,
): AvailableSource[] {
  const sources: AvailableSource[] = [];

  // 1-4. Inbound Endpoint / Event sources (body, params, query, headers, event payload)
  sources.push(...getEndpointSources(endpoint, consumedEvent));

  // 5. Environment Variables (.env)
  const hasEnvInExtra = extraSources.some(
    (s) => s.id === "env" || s.kind === "env",
  );
  if (!hasEnvInExtra) {
    sources.push(createEnvExtraSource(allNodes, serviceNodeId));
  }

  // 6. Prior Steps (Variable-centric output paths)
  priorSteps.forEach((s, idx) => {
    const stepSource = createStepSource(s, idx, allNodes);
    if (stepSource) {
      sources.push(stepSource);
    }
  });

  // 7. Injected Context / Extra Sources (e.g. caught error, loop item)
  if (Array.isArray(extraSources) && extraSources.length > 0) {
    sources.push(...extraSources);
  }

  // 8. Inline Value (Literal or Template ${...})
  sources.push({
    id: "inline",
    label: "Inline Value (${...})",
    kind: "inline",
    rootVariableName: "inline",
    paths: [],
  });

  // Deduplicate sources by ID
  const uniqueSources: AvailableSource[] = [];
  const seenIds = new Set<string>();

  for (const s of sources) {
    if (s && s.id && !seenIds.has(s.id)) {
      seenIds.add(s.id);
      uniqueSources.push(s);
    }
  }

  return uniqueSources;
}
