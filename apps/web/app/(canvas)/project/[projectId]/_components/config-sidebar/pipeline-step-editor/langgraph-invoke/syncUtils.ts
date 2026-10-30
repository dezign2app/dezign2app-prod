import { BackendNode, Endpoint, LangGraphInputChannel } from "@workspace/canvas/types";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { StepBinding } from "../types";

export function syncAgentInputChannelsToStore({
  selectedAgentNode,
  bindings,
  endpoint,
  store = useBackendCanvasStore.getState(),
}: {
  selectedAgentNode?: BackendNode;
  bindings: StepBinding[];
  endpoint?: Endpoint;
  store?: ReturnType<typeof useBackendCanvasStore.getState>;
}) {
  if (!selectedAgentNode) return;
  const currentChannels: LangGraphInputChannel[] =
    selectedAgentNode.data?.inputChannels &&
    Array.isArray(selectedAgentNode.data.inputChannels)
      ? [...selectedAgentNode.data.inputChannels]
      : [];

  const customChannels = currentChannels.filter((c) => c.source === "custom");
  const newRequestChannels: LangGraphInputChannel[] = [];
  const seen = new Set<string>();

  const resolveFieldType = (fieldName: string): LangGraphInputChannel["type"] => {
    const epField = endpoint?.requestBody?.fields?.find((f) => f.name === fieldName);
    if (epField?.type === "number") return "number";
    if (epField?.type === "boolean") return "boolean";
    if (epField?.type === "object") return "object";
    if (epField?.type === "array") return "array";
    return "string";
  };

  for (const b of bindings) {
    if (!b.argName) continue;
    // thread_id is configurable.thread_id (checkpointer config), NOT a state channel — skip it
    if (b.argName === "thread_id" || b.argName === "threadId") continue;

    let fieldKey = "";
    if ("field" in b.source && b.source.field) {
      fieldKey = b.source.field;
    } else {
      fieldKey = b.argName;
    }

    if (!fieldKey) continue;

    const existing = newRequestChannels.find((c) => c.key === fieldKey);
    if (existing) {
      const currentMapped = existing.stateChannelKey
        ? existing.stateChannelKey.split(",").map((s) => s.trim())
        : [];
      if (!currentMapped.includes(b.argName)) {
        currentMapped.push(b.argName);
        existing.stateChannelKey = currentMapped.join(",");
      }
    } else {
      newRequestChannels.push({
        id: `input_${fieldKey}_${Date.now()}`,
        key: fieldKey,
        type: resolveFieldType(fieldKey),
        source: "request",
        required: true,
        stateChannelKey: b.argName,
      });
      seen.add(fieldKey);
    }
  }

  const updatedChannels = [...newRequestChannels, ...customChannels];

  const areChannelsEqual = (
    a: LangGraphInputChannel[],
    b: LangGraphInputChannel[],
  ): boolean => {
    if (a.length !== b.length) return false;
    return a.every((chA, idx) => {
      const chB = b[idx];
      if (!chB) return false;
      return (
        chA.key === chB.key &&
        chA.type === chB.type &&
        chA.source === chB.source &&
        chA.required === chB.required &&
        chA.stateChannelKey === chB.stateChannelKey
      );
    });
  };

  if (areChannelsEqual(currentChannels, updatedChannels)) {
    return;
  }

  store.updateNode(selectedAgentNode.id, {
    data: {
      ...selectedAgentNode.data,
      inputChannels: updatedChannels,
    },
  });
}

export function removeChannelsFromAgentStore({
  selectedAgentNode,
  keysToDelete,
  store = useBackendCanvasStore.getState(),
}: {
  selectedAgentNode?: BackendNode;
  keysToDelete: Set<string>;
  store?: ReturnType<typeof useBackendCanvasStore.getState>;
}) {
  if (
    !selectedAgentNode?.data?.inputChannels ||
    !Array.isArray(selectedAgentNode.data.inputChannels)
  ) {
    return;
  }

  const updatedChannels = selectedAgentNode.data.inputChannels.filter(
    (c) =>
      !keysToDelete.has(c.key) &&
      (!c.stateChannelKey ||
        !c.stateChannelKey.split(",").some((sk) => keysToDelete.has(sk.trim()))),
  );

  if (updatedChannels.length !== selectedAgentNode.data.inputChannels.length) {
    store.updateNode(selectedAgentNode.id, {
      data: {
        ...selectedAgentNode.data,
        inputChannels: updatedChannels,
      },
    });
  }
}

