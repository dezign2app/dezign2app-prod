"use client";

import { useMemo, useEffect, useRef, useCallback } from "react";
import { BackendNode, BackendEdge, Endpoint, Parameter } from "@workspace/canvas/types";
import { checkCheckpointerTablesStatus } from "../../../../backend-nodes/graph-nodes/langgraph/langgraph-canvas/utils/checkpointerTables";
import { PipelineStepDraft, StepBinding, AvailableSource } from "../../types";
import {
  stepSourceToAccessor,
  getArgBinding,
  checkEndpointHasThreadId,
} from "../utils";

export interface UseSessionThreadIdParams {
  step: PipelineStepDraft;
  selectedAgentNode: BackendNode | undefined;
  allNodes: BackendNode[];
  allEdges?: BackendEdge[];
  endpoint?: Endpoint;
  onEndpointChange?: (changes: Partial<Endpoint>) => void;
  availableSources: AvailableSource[];
  onChange: (updated: PipelineStepDraft) => void;
  syncAgentInputChannels: (
    bindings: StepBinding[],
    mappingRecord: Record<string, string>,
    threadIdSource?: string,
  ) => void;
}

export function useSessionThreadId({
  step,
  selectedAgentNode,
  allNodes,
  allEdges = [],
  endpoint,
  onEndpointChange,
  availableSources,
  onChange,
  syncAgentInputChannels,
}: UseSessionThreadIdParams) {
  const stepRef = useRef(step);
  stepRef.current = step;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const rawMemoryConfig = selectedAgentNode?.data?.memoryConfig;
  const memoryConfig = rawMemoryConfig ?? {
    checkpointer: "memory",
    enabled: true,
  };
  const hasMemory = useMemo(() => {
    if (rawMemoryConfig && rawMemoryConfig.enabled === false) return false;
    return Boolean(memoryConfig.checkpointer);
  }, [rawMemoryConfig, memoryConfig]);

  const checkpointerTablesStatus = useMemo(() => {
    if (!selectedAgentNode || !hasMemory) return null;
    const mem = selectedAgentNode.data?.memoryConfig;
    const checkpointerType = mem?.checkpointer || "memory";
    if (checkpointerType === "memory") return null;
    return checkCheckpointerTablesStatus(
      allNodes,
      allEdges,
      mem?.enabled !== false,
      checkpointerType,
      mem?.checkpointerNodeId,
    );
  }, [selectedAgentNode, hasMemory, allNodes, allEdges]);

  const checkpointerWarning = useMemo(() => {
    if (!checkpointerTablesStatus) return null;
    if (checkpointerTablesStatus.isMissingStorage) {
      const type =
        selectedAgentNode?.data?.memoryConfig?.checkpointer === "postgres"
          ? "PostgreSQL database"
          : "Redis instance";
      return `No connected ${type} found in SchemaView. Please create a database/Redis node in SchemaView to store conversation checkpoints.`;
    }
    if (!checkpointerTablesStatus.areTablesCreated) {
      return `${checkpointerTablesStatus.missingCount} checkpointer ${
        checkpointerTablesStatus.missingCount === 1 ? "table is" : "tables are"
      } missing in SchemaView. Configure them in LangGraph Studio to enable persistence.`;
    }
    return null;
  }, [checkpointerTablesStatus, selectedAgentNode]);

  // Check if the endpoint request contract already declares a thread_id field
  const endpointHasThreadId = useMemo(() => {
    return checkEndpointHasThreadId(endpoint, step.langGraphThreadIdSource, availableSources);
  }, [endpoint, step.langGraphThreadIdSource, availableSources]);

  const threadBinding = useMemo(() => {
    return getArgBinding(step, availableSources, "thread_id", step.langGraphThreadIdSource, "body.thread_id");
  }, [step, availableSources]);

  const handleThreadBindingChange = useCallback(
    (updated: StepBinding) => {
      const currentBindings = step.inputBindings || [];
      const otherBindings = currentBindings.filter(
        (b) => b.argName !== "thread_id" && b.argName !== "threadId",
      );
      const accessor = stepSourceToAccessor(updated.source, availableSources);
      const nextStep = {
        ...step,
        inputBindings: otherBindings,
        langGraphThreadIdSource: accessor,
      };
      onChange(nextStep);
      syncAgentInputChannels(otherBindings, step.langGraphStateMapping || {}, accessor);
    },
    [step, availableSources, onChange, syncAgentInputChannels],
  );

  const handleAddThreadIdToRequestBody = useCallback(() => {
    if (!endpoint || !onEndpointChange) return;
    const currentFields = endpoint.requestBody?.fields || [];
    const newField: Parameter = {
      id: `param_thread_id_${Date.now()}`,
      name: "thread_id",
      key: "thread_id",
      type: "string",
      required: false,
      description: "Conversation session thread ID for LangGraph checkpointer memory",
      defaultValue: "",
      value: "",
    };
    onEndpointChange({
      requestBody: {
        ...(endpoint.requestBody || { id: `req_${endpoint.id}` }),
        fields: [...currentFields, newField],
      },
    });
    handleThreadBindingChange({
      argName: "thread_id",
      source: { kind: "req_body", field: "thread_id" },
    });
  }, [endpoint, onEndpointChange, handleThreadBindingChange]);

  const handleUseHeaderThreadId = useCallback(() => {
    if (endpoint && onEndpointChange) {
      const currentHeaders = endpoint.headers || [];
      if (!currentHeaders.some((h: Parameter) => h.name?.toLowerCase() === "x-thread-id")) {
        const newHeader: Parameter = {
          id: `hdr_thread_id_${Date.now()}`,
          name: "x-thread-id",
          key: "x-thread-id",
          type: "string",
          required: false,
          description: "Session thread ID header",
          defaultValue: "",
          value: "",
        };
        onEndpointChange({
          headers: [...currentHeaders, newHeader],
        });
      }
    }
    handleThreadBindingChange({
      argName: "thread_id",
      source: { kind: "req_headers", field: "x-thread-id" },
    });
  }, [endpoint, onEndpointChange, handleThreadBindingChange]);

  // Self-healing sanitizer: thread_id is configurable.thread_id (checkpointer config)
  // belonging strictly to the dedicated Session Thread ID section (langGraphThreadIdSource).
  // It must NEVER be treated as a state channel payload or stored in langGraphStateMapping/inputBindings.
  useEffect(() => {
    const rawMapping = step.langGraphStateMapping;
    const hasThreadInMapping =
      rawMapping && (Boolean(rawMapping.thread_id) || Boolean(rawMapping.threadId));
    const currentBindings = step.inputBindings || [];
    const threadBinding = currentBindings.find(
      (b) => b.argName === "thread_id" || b.argName === "threadId",
    );

    if (hasThreadInMapping || threadBinding) {
      const nextMapping = rawMapping ? { ...rawMapping } : {};
      const legacyAccessor = nextMapping.thread_id || nextMapping.threadId;
      delete nextMapping.thread_id;
      delete nextMapping.threadId;

      const nextBindings = currentBindings.filter(
        (b) => b.argName !== "thread_id" && b.argName !== "threadId",
      );

      let nextThreadIdSource = step.langGraphThreadIdSource;
      if (!nextThreadIdSource) {
        if (threadBinding && threadBinding.source) {
          nextThreadIdSource = stepSourceToAccessor(threadBinding.source, availableSources);
        } else if (legacyAccessor) {
          nextThreadIdSource = legacyAccessor;
        }
      }

      onChangeRef.current({
        ...stepRef.current,
        inputBindings: nextBindings,
        langGraphStateMapping: nextMapping,
        ...(nextThreadIdSource ? { langGraphThreadIdSource: nextThreadIdSource } : {}),
      });
      syncAgentInputChannels(nextBindings, nextMapping, nextThreadIdSource);
    }
  }, [step.id, step.langGraphStateMapping, step.inputBindings, step.langGraphThreadIdSource, availableSources, syncAgentInputChannels]);

  return {
    hasMemory,
    checkpointerWarning,
    endpointHasThreadId,
    threadBinding,
    handleThreadBindingChange,
    handleAddThreadIdToRequestBody,
    handleUseHeaderThreadId,
  };
}
