"use client";

import { useMemo, useEffect, useRef, useCallback } from "react";
import { BackendNode, Endpoint, LangGraphInputChannel } from "@workspace/canvas/types";
import { PipelineStepDraft, StepBinding } from "../../types";
import { DeclaredChannel } from "../StateChannelPayloadSection";
import { isDedicatedChannel } from "../utils";
import { syncAgentInputChannelsToStore } from "../syncUtils";

export interface UseAgentTargetingParams {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  endpoint?: Endpoint;
  projectId?: string;
  onChange: (updated: PipelineStepDraft) => void;
}

export function useAgentTargeting({
  step,
  allNodes,
  endpoint,
  projectId,
  onChange,
}: UseAgentTargetingParams) {
  const stepRef = useRef(step);
  stepRef.current = step;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const hasSyncedAgentInputChannelsRef = useRef<Set<string>>(new Set());

  // 1. Identify all LangGraph nodes on canvas
  const availableAgents = useMemo(() => {
    return allNodes.filter((n) => n.type === "langgraph");
  }, [allNodes]);

  // Selected agent node
  const selectedAgentNode = useMemo(() => {
    if (step.langGraphTargetNodeId) {
      const found = availableAgents.find((n) => n.id === step.langGraphTargetNodeId);
      if (found) return found;
    }
    return availableAgents[0];
  }, [availableAgents, step.langGraphTargetNodeId]);

  // Auto-set targetNodeId if not set yet
  useEffect(() => {
    if (!step.langGraphTargetNodeId && selectedAgentNode?.id) {
      onChangeRef.current({
        ...stepRef.current,
        langGraphTargetNodeId: selectedAgentNode.id,
      });
    }
  }, [step.langGraphTargetNodeId, selectedAgentNode?.id]);

  // Input channels defined on selected agent node (the explicit public API contract)
  const inputChannels: LangGraphInputChannel[] = useMemo(() => {
    if (!selectedAgentNode?.data?.inputChannels) return [];
    if (Array.isArray(selectedAgentNode.data.inputChannels)) {
      return selectedAgentNode.data.inputChannels;
    }
    return [];
  }, [selectedAgentNode]);

  // State channels defined on selected agent node
  const stateChannels: Array<{ key: string; type: string }> = useMemo(() => {
    if (!selectedAgentNode?.data) return [{ key: "messages", type: "BaseMessage[]" }];
    const channels = selectedAgentNode.data.stateChannels;
    if (Array.isArray(channels) && channels.length > 0) {
      return channels;
    }
    return [{ key: "messages", type: "BaseMessage[]" }];
  }, [selectedAgentNode]);

  const hasDedicatedMessages = Boolean(step.langGraphMessagesConfig);

  // Combined declared channels for mapping: prioritizing inputChannels, plus unmapped state channels.
  // Note: thread_id and messages/message have dedicated cards above when active, so they are excluded here.
  const declaredChannels = useMemo<DeclaredChannel[]>(() => {
    const list: DeclaredChannel[] = [];
    const seen = new Set<string>();

    for (const inCh of inputChannels) {
      if (inCh.key && !isDedicatedChannel(inCh.key, inCh.stateChannelKey, hasDedicatedMessages)) {
        list.push({
          key: inCh.key,
          type: inCh.type || "string",
          isInputChannel: true,
          required: inCh.required,
          description: inCh.description,
          stateChannelKey: inCh.stateChannelKey,
        });
        seen.add(inCh.key);
        if (inCh.stateChannelKey) {
          for (const sk of inCh.stateChannelKey.split(",")) {
            seen.add(sk.trim());
          }
        }
      }
    }

    for (const stCh of stateChannels) {
      if (
        stCh.key &&
        !isDedicatedChannel(stCh.key, undefined, hasDedicatedMessages) &&
        !seen.has(stCh.key)
      ) {
        list.push({
          key: stCh.key,
          type: stCh.type || "unknown",
          isInputChannel: false,
        });
        seen.add(stCh.key);
      }
    }

    if (list.length === 0 && !hasDedicatedMessages) {
      list.push({
        key: "messages",
        type: "BaseMessage[]",
        isInputChannel: false,
      });
    }

    return list;
  }, [inputChannels, stateChannels, hasDedicatedMessages]);

  const syncAgentInputChannels = useCallback(
    (
      bindings: StepBinding[],
      mappingRecord: Record<string, string>,
      threadIdSource?: string,
    ) => {
      syncAgentInputChannelsToStore({
        selectedAgentNode,
        bindings,
        endpoint,
      });
    },
    [selectedAgentNode, endpoint],
  );

  useEffect(() => {
    if (
      selectedAgentNode?.id &&
      !hasSyncedAgentInputChannelsRef.current.has(selectedAgentNode.id) &&
      (!selectedAgentNode.data?.inputChannels || selectedAgentNode.data.inputChannels.length === 0) &&
      ((step.inputBindings && step.inputBindings.length > 0) ||
        (step.langGraphStateMapping && Object.keys(step.langGraphStateMapping).length > 0))
    ) {
      hasSyncedAgentInputChannelsRef.current.add(selectedAgentNode.id);
      syncAgentInputChannels(step.inputBindings || [], step.langGraphStateMapping || {}, step.langGraphThreadIdSource);
    }
  }, [selectedAgentNode?.id, step.inputBindings, step.langGraphStateMapping, step.langGraphThreadIdSource, syncAgentInputChannels]);

  const handleSelectAgent = useCallback((nodeId: string) => {
    onChange({
      ...step,
      langGraphTargetNodeId: nodeId,
    });
  }, [onChange, step]);

  const handleOpenStudio = useCallback(() => {
    if (selectedAgentNode) {
      syncAgentInputChannels(
        step.inputBindings || [],
        step.langGraphStateMapping || {},
        step.langGraphThreadIdSource,
      );
      if (projectId) {
        window.open(`/project/${projectId}/langgraph/${selectedAgentNode.id}`, "_blank");
      }
    }
  }, [selectedAgentNode, syncAgentInputChannels, step.inputBindings, step.langGraphStateMapping, step.langGraphThreadIdSource, projectId]);

  return {
    availableAgents,
    selectedAgentNode,
    inputChannels,
    stateChannels,
    declaredChannels,
    syncAgentInputChannels,
    handleSelectAgent,
    handleOpenStudio,
  };
}

