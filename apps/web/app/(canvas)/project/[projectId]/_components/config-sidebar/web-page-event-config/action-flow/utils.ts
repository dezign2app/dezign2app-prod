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
 * Checks if a parameter or field name is an authentication header (e.g. Authorization)
 */
export function isAuthHeaderName(name?: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  return (
    lower === "authorization" ||
    lower === "auth-bearer-header" ||
    lower === "auth_token" ||
    lower.startsWith("auth-")
  );
}

/**
 * Returns any auth headers configured on the endpoint, or defaults to Authorization: Bearer <token>
 * if the endpoint is connected to a protected page (or requireAuth === true) and requireAuth !== false.
 */
export function getEndpointAuthHeaders(
  endpoint?: Endpoint | null,
  isProtected?: boolean,
): Array<{ name: string; value: string }> {
  if (endpoint?.requireAuth === false) {
    return [];
  }

  // Check if endpoint already has an auth header in endpoint.headers
  const existingAuthHeaders = (endpoint?.headers || []).filter((h) => {
    const name = (h.name || "").toLowerCase();
    const id = (h.id || "").toLowerCase();
    return (
      name === "authorization" ||
      id === "auth-bearer-header" ||
      id.startsWith("auth-") ||
      h.defaultValue?.toLowerCase().includes("bearer") ||
      h.value?.toLowerCase().includes("bearer")
    );
  });

  if (existingAuthHeaders.length > 0) {
    return existingAuthHeaders.map((h) => ({
      name: h.name || "Authorization",
      value: h.defaultValue || h.value || "Bearer <token>",
    }));
  }

  if (isProtected || endpoint?.requireAuth === true) {
    return [{ name: "Authorization", value: "Bearer <token>" }];
  }

  return [];
}

/**
 * Automatically maps required authentication headers into requestBindings when calling
 * an authenticated endpoint from a protected WebPage.
 */
export function autoMapAuthBindings(
  bindings: FrontendRequestFieldBinding[] = [],
  endpoint?: Endpoint | null,
  isProtected?: boolean,
): FrontendRequestFieldBinding[] {
  const authHeaders = getEndpointAuthHeaders(endpoint, isProtected);

  if (authHeaders.length === 0) {
    // If endpoint explicitly disallows auth, remove any default Bearer <token> auth header
    if (endpoint?.requireAuth === false) {
      return bindings.filter(
        (b) =>
          !isAuthHeaderName(b.targetField) ||
          b.source.kind !== "literal" ||
          b.source.value !== "Bearer <token>",
      );
    }
    return bindings;
  }

  const result = [...bindings];
  for (const ah of authHeaders) {
    const exists = result.some(
      (b) => b.targetField.toLowerCase() === ah.name.toLowerCase(),
    );
    if (!exists) {
      result.push({
        id: `bind-auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        targetField: ah.name,
        source: {
          kind: "literal",
          value: ah.value,
        },
      });
    }
  }

  return result;
}

/**
 * Derives FrontendActionStepDraft[] by merging canvas topology (ActionStepItem[])
 * with any existing saved drafts on the UIEventItem.
 * Canvas steps remain the source of truth for step existence, ordering, and topology.
 */
export function deriveStepsFromEdges(
  canvasSteps: ActionStepItem[],
  existing?: FrontendActionStepDraft[],
  isProtected?: boolean,
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

    const mappedBindings = autoMapAuthBindings(
      requestBindings,
      cStep.endpoint,
      isProtected,
    );

    const draft: FrontendActionStepDraft = {
      id: existingDraft?.id || cStep.edgeId,
      order,
      type: "api_call",
      edgeId: cStep.edgeId,
      serviceNodeId: cStep.targetNodeId,
      endpointId: cStep.endpointId,
      requestBindings: mappedBindings,
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
        if (src.kind === "state_var")
          return src.storeName ? `${src.storeName}.${src.stateKey}` : `state.${src.stateKey}`;
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
                        ? (b.source.storeName ? `${b.source.storeName}.${b.source.stateKey}` : `state.${b.source.stateKey}`)
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
