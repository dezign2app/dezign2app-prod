import type { Endpoint, UIEventItem } from "@workspace/canvas";
import type { ActionStepItem } from "../TargetEndpointSection";
import type {
  FrontendActionStepDraft,
  FrontendActionStepType,
  FrontendRequestFieldBinding,
} from "./types";

const COMMON_RESPONSE_FIELD_SUGGESTIONS = [
  "presignedUrl",
  "url",
  "uploadUrl",
  "downloadUrl",
  "fileUrl",
  "data.presignedUrl",
  "data.url",
  "key",
  "id",
];

/**
 * Extracts candidate response field paths from an endpoint or returns defaults.
 */
export function extractResponseFieldSuggestions(endpoint?: Endpoint): string[] {
  const suggestions = new Set<string>(COMMON_RESPONSE_FIELD_SUGGESTIONS);

  if (endpoint?.responseBody?.fields) {
    for (const field of endpoint.responseBody.fields) {
      if (field.name) {
        suggestions.add(field.name);
      }
    }
  }

  if (endpoint?.responseBody?.rawJson) {
    try {
      const parsed = JSON.parse(endpoint.responseBody.rawJson);
      if (parsed && typeof parsed === "object") {
        for (const key of Object.keys(parsed)) {
          suggestions.add(key);
        }
      }
    } catch {}
  }

  if (endpoint?.requestBody?.fields) {
    for (const field of endpoint.requestBody.fields) {
      if (field.name) {
        suggestions.add(field.name);
      }
    }
  }

  return Array.from(suggestions);
}

/**
 * Derives FrontendActionStepDraft[] by merging canvas topology (ActionStepItem[])
 * with any existing saved drafts on the UIEventItem.
 * Canvas steps remain the source of truth for step existence, ordering, and topology.
 */
export function deriveStepsFromEdges(
  canvasSteps: ActionStepItem[],
  existing?: FrontendActionStepDraft[],
): FrontendActionStepDraft[] {
  const existingMap = new Map<string, FrontendActionStepDraft>();
  const orderMap = new Map<number, FrontendActionStepDraft>();

  if (existing) {
    for (const draft of existing) {
      existingMap.set(draft.id, draft);
      orderMap.set(draft.order, draft);
    }
  }

  return canvasSteps.map((cStep, idx) => {
    const order = idx + 1;
    const existingDraft = existingMap.get(cStep.edgeId) || orderMap.get(order);
    const stepType: FrontendActionStepType = cStep.isStorageRef
      ? "storage_put"
      : "api_call";

    if (stepType === "storage_put") {
      const priorCanvasStep = idx > 0 ? canvasSteps[idx - 1] : undefined;
      const defaultPresignedUrlSource = priorCanvasStep
        ? {
            stepId: priorCanvasStep.edgeId,
            fieldPath: "presignedUrl",
          }
        : undefined;

      const presignedUrlSource =
        existingDraft?.presignedUrlSource || defaultPresignedUrlSource;

      const fileSource = existingDraft?.fileSource || {
        kind: "user_input" as const,
        key: "file",
      };

      const contentType =
        existingDraft?.contentType || "application/octet-stream";

      const draft: FrontendActionStepDraft = {
        id: cStep.edgeId,
        order,
        type: "storage_put",
        storageRefNodeId: cStep.targetNodeId,
        storageServiceNodeId: existingDraft?.storageServiceNodeId,
        presignedUrlSource,
        fileSource,
        contentType,
      };

      return draft;
    }

    const requestBindings: FrontendRequestFieldBinding[] =
      existingDraft?.requestBindings ? [...existingDraft.requestBindings] : [];

    const draft: FrontendActionStepDraft = {
      id: cStep.edgeId,
      order,
      type: "api_call",
      serviceNodeId: cStep.targetNodeId,
      endpointId: cStep.endpointId,
      requestBindings,
    };

    return draft;
  });
}

/**
 * Formats a clean runtime summary string for display in the sidebar.
 */
export function getActionFlowRuntime(
  item?: UIEventItem,
  canvasSteps: ActionStepItem[] = [],
  drafts: FrontendActionStepDraft[] = [],
): string {
  if (canvasSteps.length === 0) {
    return "// No execution steps configured for this action.";
  }

  const actionName = item?.name || "Action";
  const lines: string[] = [
    `// Runtime execution plan for: ${actionName}`,
    `// Total sequential steps: ${canvasSteps.length}`,
    "// ----------------------------------------------------",
  ];

  canvasSteps.forEach((cStep, idx) => {
    const draft = drafts.find((d) => d.id === cStep.edgeId) || drafts[idx];
    const stepNum = idx + 1;

    if (cStep.isStorageRef) {
      const bucket = cStep.bucketName || "bucket";
      const op = cStep.operationName || "uploadObject";
      const sourceStepId = draft?.presignedUrlSource?.stepId;
      const priorStepIdx = canvasSteps.findIndex((s) => s.edgeId === sourceStepId);
      const urlRef =
        priorStepIdx >= 0
          ? `Step ${priorStepIdx + 1}.${draft?.presignedUrlSource?.fieldPath || "presignedUrl"}`
          : `<${draft?.presignedUrlSource?.fieldPath || "presignedUrl"}>`;

      const fileKey = draft?.fileSource
        ? `${draft.fileSource.kind === "state_var" ? "state." : "input."}${draft.fileSource.key}`
        : "file";
      const cType = draft?.contentType || "application/octet-stream";

      lines.push(
        `// Step ${stepNum}: [STORAGE PUT] -> ${bucket} (${op})`,
        `//         URL: ${urlRef}`,
        `//         Payload: ${fileKey}`,
        `//         Content-Type: ${cType}`,
      );
    } else {
      const method = cStep.endpoint?.type || "POST";
      const epPath = cStep.endpoint?.name || "/endpoint";
      const serviceName = cStep.targetNode?.data?.label || "Service";
      const bindings = draft?.requestBindings || [];
      const bindingStr =
        bindings.length > 0
          ? bindings
              .map((b) => {
                const src =
                  b.source.kind === "literal"
                    ? `"${b.source.value}"`
                    : b.source.kind === "state_var"
                      ? `state.${b.source.stateKey}`
                      : b.source.kind === "user_input"
                        ? `input.${b.source.fieldName}`
                        : `Step.${b.source.fieldPath}`;
                return `${b.targetField}: ${src}`;
              })
              .join(", ")
          : "default payload";

      lines.push(
        `// Step ${stepNum}: [API CALL] ${method} ${epPath} (${serviceName})`,
        `//         Body: { ${bindingStr} }`,
      );
    }
  });

  return lines.join("\n");
}
