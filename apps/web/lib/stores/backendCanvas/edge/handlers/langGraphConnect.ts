import { PipelineStep, Parameter } from "@workspace/canvas/types";
import { toVarName } from "@/lib/compiler/utils";
import { ConnectionContext } from "../types";

/**
 * Handles connections between ServiceNode (endpoint or consumer event) and LangGraphNode:
 * 1. Endpoint -> LangGraphNode: auto-adds a `langgraph_invoke` step to the endpoint's pipelineSteps.
 * 2. Consumed Event -> LangGraphNode: auto-adds a `langgraph_invoke` step to the event's pipelineSteps.
 * 3. Reverse connections (LangGraphNode -> ServiceNode) are also handled.
 *
 * @returns boolean `false` as direct canvas edge is preserved for visual route wiring.
 */
export function handleLangGraphConnect({
  get,
  connection,
  sourceNode,
  targetNode,
}: ConnectionContext): boolean {
  const isSourceService = sourceNode.type === "service";
  const isTargetLangGraph = targetNode.type === "langgraph";
  const isSourceLangGraph = sourceNode.type === "langgraph";
  const isTargetService = targetNode.type === "service";

  if (
    !(
      (isSourceService && isTargetLangGraph) ||
      (isSourceLangGraph && isTargetService)
    )
  ) {
    return false;
  }

  const serviceNode = isSourceService ? sourceNode : targetNode;
  const langGraphNode = isTargetLangGraph ? targetNode : sourceNode;
  const serviceHandle = isSourceService
    ? connection.sourceHandle
    : connection.targetHandle;

  // 1. Resolve endpoint or consumer event from serviceHandle
  let endpointId: string | null = null;
  let consumedEventId: string | null = null;

  if (serviceHandle?.startsWith("endpoint-out-")) {
    endpointId = serviceHandle.replace("endpoint-out-", "");
  } else if (serviceHandle?.startsWith("endpoint-in-")) {
    endpointId = serviceHandle.replace("endpoint-in-", "");
  } else if (serviceHandle?.startsWith("consumedEvents-out-")) {
    consumedEventId = serviceHandle.replace("consumedEvents-out-", "");
  } else if (serviceHandle?.startsWith("consumedEvents-in-")) {
    consumedEventId = serviceHandle.replace("consumedEvents-in-", "");
  } else if (serviceHandle) {
    // Direct match against known endpoints or events
    const matchingEp = get().endpoints.find(
      (e) => e.nodeId === serviceNode.id && e.id === serviceHandle,
    );
    if (matchingEp) {
      endpointId = matchingEp.id;
    } else {
      const matchingEv = get().events.find(
        (e) => e.nodeId === serviceNode.id && e.id === serviceHandle,
      );
      if (matchingEv) {
        consumedEventId = matchingEv.id;
      }
    }
  }

  // Fallback: if no specific handle was matched, target the first endpoint of the service
  if (!endpointId && !consumedEventId) {
    const firstEp = get().endpoints.find((e) => e.nodeId === serviceNode.id);
    if (firstEp) {
      endpointId = firstEp.id;
    }
  }

  // Snap LangGraph node to the left of the service node (ingress / input side)
  if (langGraphNode.position && serviceNode.position && langGraphNode.position.x >= serviceNode.position.x) {
    get().updateNode(langGraphNode.id, {
      position: {
        x: serviceNode.position.x - 340,
        y: langGraphNode.position.y,
      },
    });
  }

  const agentLabel = langGraphNode.data?.label || "LangGraph Agent";
  const stateChannels = langGraphNode.data?.stateChannels || [];

  // 2. Add step to Endpoint
  if (endpointId) {
    const endpoint = get().endpoints.find((e) => e.id === endpointId);
    if (!endpoint) return false;

    const existingSteps = endpoint.pipelineSteps || [];
    const hasMatchingStep = existingSteps.some(
      (s) =>
        s.type === "langgraph_invoke" &&
        s.langGraphTargetNodeId === langGraphNode.id,
    );

    if (!hasMatchingStep) {
      const defaultStateMapping: Record<string, string> = {};
      if (stateChannels.length > 0) {
        stateChannels.forEach((ch: { key: string }) => {
          if (ch.key === "messages") {
            defaultStateMapping[ch.key] = "body.message";
          } else {
            defaultStateMapping[ch.key] = `body.${ch.key}`;
          }
        });
      } else {
        defaultStateMapping["messages"] = "body.message";
      }

      const stepNum =
        existingSteps.filter((s) => s.type !== "return_response").length + 1;
      const outputVar = `${toVarName(agentLabel)}Result${stepNum > 1 ? stepNum : ""}`;

      const memoryConfig = langGraphNode.data?.memoryConfig;
      const hasMemory = Boolean(
        memoryConfig &&
        memoryConfig.enabled !== false &&
        memoryConfig.checkpointer,
      );

      const newLangGraphStep: PipelineStep = {
        id: `step-langgraph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: agentLabel,
        type: "langgraph_invoke",
        enabled: true,
        outputVariable: outputVar,
        langGraphTargetNodeId: langGraphNode.id,
        langGraphStreamingEnabled: false,
        langGraphStreamingProtocol: "sse",
        langGraphOutputMode: "full_state",
        langGraphStateMapping: defaultStateMapping,
        ...(hasMemory ? { langGraphThreadIdSource: "body.thread_id" } : {}),
        inputBindings: [],
      };

      const returnIdx = existingSteps.findIndex(
        (s) => s.type === "return_response",
      );
      let nextPipelineSteps: PipelineStep[];
      if (returnIdx !== -1) {
        nextPipelineSteps = [
          ...existingSteps.slice(0, returnIdx),
          newLangGraphStep,
          ...existingSteps.slice(returnIdx),
        ];
      } else {
        nextPipelineSteps = [...existingSteps, newLangGraphStep];
      }

      // Check if endpoint requestBody exists or needs thread_id auto-provisioning
      const currentReqBody = endpoint.requestBody;
      const currentFields = currentReqBody?.fields || [];
      const hasThreadId = currentFields.some(
        (f: Parameter) =>
          f.name?.toLowerCase() === "thread_id" ||
          f.name?.toLowerCase() === "threadid",
      );
      const hasMessage = currentFields.some(
        (f: Parameter) =>
          f.name?.toLowerCase() === "message" ||
          f.name?.toLowerCase() === "messages",
      );

      let updatedReqBody = currentReqBody;
      const fieldsToAdd: Parameter[] = [];
      if (!hasMessage) {
        fieldsToAdd.push({
          id: `field_msg_${Date.now()}`,
          name: "message",
          key: "message",
          type: "string",
          required: true,
          description: "User input prompt / message",
          defaultValue: "",
          value: "",
        });
      }
      if (hasMemory && !hasThreadId) {
        fieldsToAdd.push({
          id: `field_thread_id_${Date.now()}`,
          name: "thread_id",
          key: "thread_id",
          type: "string",
          required: false,
          description: "Conversation session thread ID for LangGraph checkpointer memory",
          defaultValue: "",
          value: "",
        });
      }

      if (fieldsToAdd.length > 0) {
        updatedReqBody = {
          ...(currentReqBody || { id: `req_${endpoint.id}` }),
          fields: [...currentFields, ...fieldsToAdd],
        };
      }

      get().updateEndpoint(endpointId, {
        pipelineSteps: nextPipelineSteps,
        ...(updatedReqBody !== currentReqBody ? { requestBody: updatedReqBody } : {}),
      });
    }
  }

  // 3. Add step to Consumed Event
  if (consumedEventId) {
    const event = get().events.find((e) => e.id === consumedEventId);
    if (!event) return false;

    const existingSteps = event.pipelineSteps || [];
    const hasMatchingStep = existingSteps.some(
      (s) =>
        s.type === "langgraph_invoke" &&
        s.langGraphTargetNodeId === langGraphNode.id,
    );

    if (!hasMatchingStep) {
      const defaultStateMapping: Record<string, string> = {};
      if (stateChannels.length > 0) {
        stateChannels.forEach((ch: { key: string }) => {
          if (ch.key === "messages") {
            defaultStateMapping[ch.key] = "event.message";
          } else {
            defaultStateMapping[ch.key] = `event.${ch.key}`;
          }
        });
      } else {
        defaultStateMapping["messages"] = "event.message";
      }

      const stepNum = existingSteps.length + 1;
      const outputVar = `${toVarName(agentLabel)}Result${stepNum > 1 ? stepNum : ""}`;

      const memoryConfig = langGraphNode.data?.memoryConfig;
      const hasMemory = Boolean(
        memoryConfig &&
        memoryConfig.enabled !== false &&
        memoryConfig.checkpointer,
      );

      const newLangGraphStep: PipelineStep = {
        id: `step-langgraph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: agentLabel,
        type: "langgraph_invoke",
        enabled: true,
        outputVariable: outputVar,
        langGraphTargetNodeId: langGraphNode.id,
        langGraphStreamingEnabled: false,
        langGraphStreamingProtocol: "sse",
        langGraphOutputMode: "full_state",
        langGraphStateMapping: defaultStateMapping,
        ...(hasMemory ? { langGraphThreadIdSource: "event.thread_id" } : {}),
        inputBindings: [],
      };

      get().updateEvent(consumedEventId, {
        pipelineSteps: [...existingSteps, newLangGraphStep],
      });
    }
  }

  return false;
}
