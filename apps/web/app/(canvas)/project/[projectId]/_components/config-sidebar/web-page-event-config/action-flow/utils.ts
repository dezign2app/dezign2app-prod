import type { Endpoint, UIEventItem } from "@workspace/canvas";
import type { ActionStepItem } from "../TargetEndpointSection";
import type {
  FrontendActionStepDraft,
  FrontendActionStepType,
  FrontendFieldSource,
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
      if (draft.edgeId) {
        existingMap.set(draft.edgeId, draft);
      }
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
        id: existingDraft?.id || cStep.edgeId,
        order,
        type: "storage_put",
        edgeId: cStep.edgeId,
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
      id: existingDraft?.id || cStep.edgeId,
      order,
      type: "api_call",
      edgeId: cStep.edgeId,
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
function formatDraftStep(
  draft: FrontendActionStepDraft,
  stepNum: number,
  lines: string[],
) {
  switch (draft.type) {
    case "update_query_params": {
      const nav = draft.queryParamNavMode || "replace";
      const scroll = draft.queryParamScroll ? "scroll: true" : "scroll: false";

      const formatSource = (src?: FrontendFieldSource): string => {
        if (!src) return "value";
        if (src.kind === "literal") return `"${src.value || ""}"`;
        if (src.kind === "state_var") return `state.${src.stateKey}`;
        if (src.kind === "user_input") return `input.${src.fieldName}`;
        if (src.kind === "prev_response") return `step.${src.fieldPath}`;
        if (src.kind === "route_param") return `params.${src.paramName}`;
        if (src.kind === "query_param") return `query.${src.paramName}`;
        return "value";
      };

      const updates = draft.queryParamsUpdates;
      if (updates && updates.length > 1) {
        const ops = updates
          .map((u) => {
            const k = u.key || "param";
            const m = (u.mode || "set").toUpperCase();
            if (m === "REMOVE") return `REMOVE "${k}"`;
            if (m === "TOGGLE") return `TOGGLE "${k}"`;
            return `SET "${k}" = ${formatSource(u.valueSource)}`;
          })
          .join(", ");
        lines.push(
          `// Step ${stepNum}: [UPDATE QUERY PARAMS] (${ops}) (${nav}, ${scroll})`,
        );
        break;
      }

      const key = draft.queryParamKey || "param";
      const mode = (draft.queryParamMode || "set").toUpperCase();
      const val = formatSource(draft.queryParamValueSource);
      lines.push(
        `// Step ${stepNum}: [UPDATE QUERY PARAMS] ${mode} "${key}"${mode !== "REMOVE" && mode !== "TOGGLE" ? ` = ${val}` : ""} (${nav}, ${scroll})`,
      );
      break;
    }
    case "navigation": {
      lines.push(
        `// Step ${stepNum}: [NAVIGATE] -> ${draft.targetRoute || "/"} (${draft.navCondition || "direct"})`,
      );
      break;
    }
    case "state_mutation": {
      lines.push(
        `// Step ${stepNum}: [STATE MUTATION] ${draft.stateUpdateType || "set"} ${draft.stateKey || "state"}`,
      );
      break;
    }
    case "storage_put": {
      const bucket = draft.bucketName || draft.bucketId || "bucket";
      const fileKey = draft.fileSource?.key || "file";
      lines.push(
        `// Step ${stepNum}: [STORAGE PUT] -> ${bucket} (Payload: ${fileKey})`,
      );
      break;
    }
    case "api_call": {
      lines.push(`// Step ${stepNum}: [API CALL] /endpoint`);
      break;
    }
    case "custom_code": {
      lines.push(`// Step ${stepNum}: [CUSTOM CODE]`);
      break;
    }
    case "condition": {
      lines.push(
        `// Step ${stepNum}: [CONDITION] if (${draft.conditionExpr || "condition"})`,
      );
      break;
    }
    case "notification": {
      lines.push(
        `// Step ${stepNum}: [NOTIFICATION] ${draft.notifyLevel || "info"}: "${draft.notifyMessage || ""}"`,
      );
      break;
    }
    case "reset_form": {
      lines.push(
        `// Step ${stepNum}: [RESET FORM] ${draft.formTarget || "form"}`,
      );
      break;
    }
  }
}

export function getActionFlowRuntime(
  item?: UIEventItem,
  canvasSteps: ActionStepItem[] = [],
  drafts: FrontendActionStepDraft[] = [],
): string {
  if (canvasSteps.length === 0 && drafts.length === 0) {
    return "// No execution steps configured for this action.";
  }

  const actionName = item?.name || "Action";
  const total = drafts.length > 0 ? drafts.length : canvasSteps.length;
  const lines: string[] = [
    `// Runtime execution plan for: ${actionName}`,
    `// Total sequential steps: ${total}`,
    "// ----------------------------------------------------",
  ];

  if (canvasSteps.length > 0) {
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
                          : b.source.kind === "route_param"
                            ? `params.${b.source.paramName}`
                            : b.source.kind === "query_param"
                              ? `query.${b.source.paramName}`
                              : `Step.${b.source.fieldPath || ""}`;
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

    const nonCanvasDrafts = drafts.filter(
      (d) => !canvasSteps.some((c) => c.edgeId === d.id || c.edgeId === d.edgeId),
    );
    nonCanvasDrafts.forEach((draft, idx) => {
      const stepNum = canvasSteps.length + idx + 1;
      formatDraftStep(draft, stepNum, lines);
    });

    return lines.join("\n");
  }

  drafts.forEach((draft, idx) => {
    const stepNum = idx + 1;
    formatDraftStep(draft, stepNum, lines);
  });

  return lines.join("\n");
}
