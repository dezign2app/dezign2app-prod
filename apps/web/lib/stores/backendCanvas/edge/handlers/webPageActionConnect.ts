import {
  BackendNode,
  BackendEdge,
  Endpoint,
  PageSection,
  UIEventItem,
  FrontendActionStepDraft,
} from "@/types/canvas";
import { ConnectionContext } from "../types";
import { buildInitialBindingsFromEndpoint } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/web-page-event-config/action-flow/utils";
import { isStorageRefNode } from "../utils";
import { toast } from "sonner";

/**
 * Handles WebPage action/event connections:
 * When an edge is drawn from a WebPage action handle (events-*, event-in-*, pageload-in-*)
 * to a Service endpoint or Storage bucket, automatically configures the corresponding
 * request step (api_call or storage_put) in the action's `actionSteps`!
 */
export function handleWebPageActionConnect({
  set,
  get,
  connection,
  sourceNode,
  targetNode,
  newEdge,
}: ConnectionContext): boolean {
  const isSourceWebPage = sourceNode.type === "webPage";
  const isTargetWebPage = targetNode.type === "webPage";

  if (!isSourceWebPage && !isTargetWebPage) return false;

  const webPageNode = isSourceWebPage ? sourceNode : targetNode;
  const otherNode = isSourceWebPage ? targetNode : sourceNode;
  const webHandle = isSourceWebPage
    ? (connection.sourceHandle ?? "")
    : (connection.targetHandle ?? "");
  const otherHandle = isSourceWebPage
    ? (connection.targetHandle ?? "")
    : (connection.sourceHandle ?? "");

  const isActionHandle =
    webHandle.startsWith("events-") ||
    webHandle.startsWith("event-in-") ||
    webHandle.startsWith("pageload-in-") ||
    webHandle.startsWith("action-in-");

  if (!isActionHandle) return false;

  const actionId = webHandle.replace(
    /^(?:events-|event-in-|pageload-in-|action-in-)/,
    "",
  );

  const isServiceTarget =
    otherNode.type === "service" ||
    otherNode.type === "serverless" ||
    otherNode.type === "worker" ||
    Boolean(otherNode.data?.endpoints);

  const isStorageTarget =
    isStorageRefNode(otherNode.type) || otherNode.type === "storage";

  if (!isServiceTarget && !isStorageTarget) return false;

  // 1. Determine if this WebPage is on a protected route
  const currentNodes = get().nodes;
  const currentEdges = get().edges;
  const webAppNode = currentNodes.find((n) => n.type === "webApp");
  const isConnectedToPrivateZone = currentEdges.some((e) => {
    if (
      (e.source === webAppNode?.id && e.target === webPageNode.id) ||
      (e.target === webAppNode?.id && e.source === webPageNode.id)
    ) {
      const zoneHandle =
        e.source === webAppNode?.id ? e.sourceHandle : e.targetHandle;
      return (
        zoneHandle === "private-in" ||
        zoneHandle?.toLowerCase().includes("private") ||
        zoneHandle?.toLowerCase().includes("protect")
      );
    }
    return false;
  });

  const isProtected =
    Boolean(webPageNode.data?.requireAuth) || isConnectedToPrivateZone;

  let configuredStep: FrontendActionStepDraft | null = null;
  let targetDesc = "";

  if (isServiceTarget) {
    const endpointId = otherHandle
      .replace(/^(?:routeEndpoints|endpoints|endpoint)-(?:in|out)-/, "")
      .replace(/^func-(?:in-)?/, "");

    const allEndpoints = get().endpoints;
    const serviceEndpoints = allEndpoints.filter(
      (e) => e.nodeId === otherNode.id,
    );
    const endpoint: Endpoint | undefined =
      allEndpoints.find((e) => e.id === endpointId) ||
      serviceEndpoints.find(
        (e) => e.id === endpointId || e.name === endpointId,
      ) ||
      (otherNode.data?.endpoints || []).find(
        (e: any) => e.id === endpointId || e.name === endpointId,
      ) ||
      serviceEndpoints[0];

    if (!endpoint) return false;

    targetDesc = `${endpoint.type || "POST"} ${endpoint.name || "endpoint"}`;
    const requestBindings = buildInitialBindingsFromEndpoint(
      endpoint,
      isProtected,
    );

    configuredStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      order: 1, // Will be updated to actual sequence index below
      type: "api_call",
      name: endpoint.name
        ? `${endpoint.type || "POST"} ${endpoint.name}`
        : `Call Endpoint`,
      edgeId: newEdge.id,
      serviceNodeId: otherNode.id,
      endpointId: endpoint.id,
      requestBindings,
    };
  } else if (isStorageTarget) {
    const opName =
      otherHandle.replace(/^func-(?:in-)?/, "") || "uploadObject";
    const storageNodeId =
      otherNode.data?.storageNodeId ||
      (otherNode.type === "storage" ? otherNode.id : undefined);
    const bucketId =
      otherNode.data?.bucketId ||
      otherNode.data?.bucketName ||
      "default-bucket";
    const bucketName =
      otherNode.data?.bucketName || otherNode.data?.label || bucketId;

    targetDesc = `storage bucket ${bucketName}`;
    configuredStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      order: 1,
      type: "storage_put",
      name: `Upload to ${bucketName}`,
      edgeId: newEdge.id,
      storageNodeId,
      storageRefNodeId: otherNode.id,
      bucketId,
      bucketName,
      presignedUrlSource: { stepId: "", fieldPath: "presignedUrl" },
      fileSource: { kind: "user_input", key: "file" },
      contentType: "application/octet-stream",
    };
  }

  if (!configuredStep) return false;

  let foundAction = false;
  let actionName = "";
  let calculatedStepNumber = 1;

  const stepTemplate: FrontendActionStepDraft = configuredStep;

  // Update in sections -> actions
  const sections: PageSection[] = webPageNode.data?.sections || [];
  const updatedSections = sections.map((sec) => ({
    ...sec,
    actions: (sec.actions || []).map((act) => {
      if (act.id === actionId) {
        foundAction = true;
        actionName = act.name || "Action";
        const existingSteps: FrontendActionStepDraft[] = act.actionSteps || [];
        const existingIdx = existingSteps.findIndex(
          (s) =>
            s.edgeId === newEdge.id ||
            (stepTemplate.type === "api_call" &&
              s.serviceNodeId === stepTemplate.serviceNodeId &&
              s.endpointId === stepTemplate.endpointId) ||
            (stepTemplate.type === "storage_put" &&
              s.storageRefNodeId === stepTemplate.storageRefNodeId &&
              s.bucketId === stepTemplate.bucketId),
        );

        calculatedStepNumber =
          existingIdx >= 0
            ? (existingSteps[existingIdx]?.order ?? 1)
            : existingSteps.length + 1;

        const stepToApply: FrontendActionStepDraft = {
          ...stepTemplate,
          order: calculatedStepNumber,
          id: existingIdx >= 0 ? (existingSteps[existingIdx]?.id ?? stepTemplate.id) : stepTemplate.id,
        };

        const nextSteps =
          existingIdx >= 0
            ? existingSteps.map((s, i) =>
                i === existingIdx ? stepToApply : s,
              )
            : [...existingSteps, stepToApply];

        return {
          ...act,
          actionSteps: nextSteps,
          ...(stepToApply.type === "storage_put"
            ? {
                storageOperationBinding: {
                  storageNodeId: stepToApply.storageNodeId,
                  bucketId: stepToApply.bucketId!,
                  operationName: "uploadObject",
                  refNodeId: stepToApply.storageRefNodeId,
                },
              }
            : {}),
        };
      }
      return act;
    }),
  }));

  // Also check webPageNode.data?.events
  const events: UIEventItem[] = webPageNode.data?.events || [];
  const updatedEvents = events.map((evt) => {
    if (evt.id === actionId) {
      foundAction = true;
      actionName = evt.name || "Event";
      const existingSteps: FrontendActionStepDraft[] = evt.actionSteps || [];
      const existingIdx = existingSteps.findIndex(
        (s) =>
          s.edgeId === newEdge.id ||
          (stepTemplate.type === "api_call" &&
            s.serviceNodeId === stepTemplate.serviceNodeId &&
            s.endpointId === stepTemplate.endpointId) ||
          (stepTemplate.type === "storage_put" &&
            s.storageRefNodeId === stepTemplate.storageRefNodeId &&
            s.bucketId === stepTemplate.bucketId),
      );

      calculatedStepNumber =
        existingIdx >= 0
          ? (existingSteps[existingIdx]?.order ?? 1)
          : existingSteps.length + 1;

      const stepToApply: FrontendActionStepDraft = {
        ...stepTemplate,
        order: calculatedStepNumber,
        id: existingIdx >= 0 ? (existingSteps[existingIdx]?.id ?? stepTemplate.id) : stepTemplate.id,
      };

      const nextSteps =
        existingIdx >= 0
          ? existingSteps.map((s, i) =>
              i === existingIdx ? stepToApply : s,
            )
          : [...existingSteps, stepToApply];

      return {
        ...evt,
        actionSteps: nextSteps,
      };
    }
    return evt;
  });

  if (foundAction) {
    get().updateNode(webPageNode.id, {
      data: {
        ...webPageNode.data,
        sections: updatedSections,
        ...(events.length > 0 ? { events: updatedEvents } : {}),
      },
    });

    // Ensure newEdge data has sequenceOrder and label set
    const allEdges = get().edges;
    set({
      edges: allEdges.map((e) =>
        e.id === newEdge.id
          ? {
              ...e,
              data: {
                ...e.data,
                sequenceOrder: calculatedStepNumber,
                label: String(calculatedStepNumber),
              },
            }
          : e,
      ),
    });

    toast.success(
      `Configured request step for "${actionName}" calling ${targetDesc}`,
    );
    return true;
  }

  return false;
}
