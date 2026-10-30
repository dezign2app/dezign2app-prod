"use client";

import { useMemo, useState, useCallback } from "react";
import { BackendNode, LangGraphInputChannel } from "@workspace/canvas/types";
import { PipelineStepDraft, StepBinding, AvailableSource } from "../../types";
import { DeclaredChannel } from "../StateChannelPayloadSection";
import {
  stepSourceToAccessor,
  accessorToStepSource,
  isDedicatedChannel,
  findMatchingSourceForChannel,
  findMatchingSourceForThreadId,
} from "../utils";
import { removeChannelsFromAgentStore } from "../syncUtils";

export interface UseStateChannelPayloadParams {
  step: PipelineStepDraft;
  declaredChannels: DeclaredChannel[];
  stateChannels?: Array<{ key: string; type: string }>;
  inputChannels?: LangGraphInputChannel[];
  hasMemory: boolean;
  availableSources: AvailableSource[];
  selectedAgentNode: BackendNode | undefined;
  onChange: (updated: PipelineStepDraft) => void;
  syncAgentInputChannels: (
    bindings: StepBinding[],
    mappingRecord: Record<string, string>,
    threadIdSource?: string,
  ) => void;
}

export function useStateChannelPayload({
  step,
  declaredChannels,
  stateChannels = [],
  inputChannels = [],
  hasMemory,
  availableSources,
  selectedAgentNode,
  onChange,
  syncAgentInputChannels,
}: UseStateChannelPayloadParams) {
  const [newKey, setNewKey] = useState("");
  const [newCustomBinding, setNewCustomBinding] = useState<StepBinding>({
    argName: "",
    source: { kind: "req_body", field: "" },
  });

  const mapping: Record<string, string> = useMemo(() => {
    return step.langGraphStateMapping || {};
  }, [step.langGraphStateMapping]);

  const hasDedicatedMessages = Boolean(step.langGraphMessagesConfig);

  const isChannelMapped = useCallback(
    (chOrKey: { key: string; stateChannelKey?: string } | string) => {
      const key = typeof chOrKey === "string" ? chOrKey : chOrKey.key;
      const stateKey = typeof chOrKey === "object" ? chOrKey.stateChannelKey : undefined;

      const keysToCheck = [key];
      if (stateKey) {
        for (const sk of stateKey.split(",")) {
          keysToCheck.push(sk.trim());
        }
      }

      return keysToCheck.some((k) => {
        const hasInMapping = k in mapping && mapping[k] !== undefined && mapping[k] !== "";
        const hasInBindings = (step.inputBindings || []).some((b) => b.argName === k);
        return hasInMapping || hasInBindings;
      });
    },
    [mapping, step.inputBindings],
  );

  const mappedDeclaredChannels = useMemo(() => {
    return declaredChannels.filter((ch) => isChannelMapped(ch));
  }, [declaredChannels, isChannelMapped]);

  const customKeys = useMemo(() => {
    const keysFromMapping = Object.keys(mapping).filter((k) => Boolean(mapping[k]));
    const keysFromBindings = (step.inputBindings || []).map((b) => b.argName).filter(Boolean);
    const allKeys = Array.from(new Set([...keysFromMapping, ...keysFromBindings]));
    return allKeys.filter(
      (k) =>
        !isDedicatedChannel(k, undefined, hasDedicatedMessages) &&
        !declaredChannels.some((ch) => ch.key === k || ch.stateChannelKey === k),
    );
  }, [mapping, step.inputBindings, declaredChannels, hasDedicatedMessages]);

  const unmappedDeclaredChannels = useMemo(() => {
    return declaredChannels.filter(
      (ch) =>
        ch.key.toLowerCase() !== "messages" &&
        (!ch.stateChannelKey ||
          !ch.stateChannelKey
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .includes("messages")) &&
        !isChannelMapped(ch),
    );
  }, [declaredChannels, isChannelMapped]);

  const getBindingForChannel = useCallback(
    (chOrKey: { key: string; stateChannelKey?: string } | string): StepBinding => {
      const channelKey = typeof chOrKey === "string" ? chOrKey : chOrKey.key;
      const stateKey = typeof chOrKey === "object" ? chOrKey.stateChannelKey : undefined;

      const existing = (step.inputBindings || []).find(
        (b) =>
          b.argName === channelKey ||
          (stateKey && b.argName === stateKey),
      );
      if (existing) return existing;

      const rawMapping =
        mapping[channelKey] ||
        (stateKey ? mapping[stateKey] : undefined);

      if (rawMapping) {
        return {
          argName: channelKey,
          source: accessorToStepSource(rawMapping, availableSources),
        };
      }
      return {
        argName: channelKey,
        source: {
          kind: "req_body",
          field: channelKey === "messages" ? "message" : channelKey,
        },
      };
    },
    [step.inputBindings, mapping, availableSources],
  );

  const handleBindingChange = useCallback(
    (channelKey: string, updatedBinding: StepBinding) => {
      const currentBindings = step.inputBindings || [];
      const existingKeys = new Set(currentBindings.map((b) => b.argName));
      const backfilledBindings: StepBinding[] = [...currentBindings];

      for (const [k, rawMap] of Object.entries(mapping)) {
        if (k !== channelKey && !existingKeys.has(k)) {
          backfilledBindings.push({
            argName: k,
            source: accessorToStepSource(rawMap, availableSources),
          });
        }
      }

      const otherBindings = backfilledBindings.filter((b) => b.argName !== channelKey);
      const nextBindings = [...otherBindings, { ...updatedBinding, argName: channelKey }];

      const accessor = stepSourceToAccessor(updatedBinding.source, availableSources);
      const nextMapping = { ...mapping };
      if (accessor) {
        nextMapping[channelKey] = accessor;
      } else {
        delete nextMapping[channelKey];
      }

      onChange({
        ...step,
        inputBindings: nextBindings,
        langGraphStateMapping: nextMapping,
      });
      syncAgentInputChannels(nextBindings, nextMapping);
    },
    [step, mapping, availableSources, onChange, syncAgentInputChannels],
  );

  const handleRemoveMapping = useCallback(
    (stateKey: string) => {
      const nextMapping = { ...mapping };
      const keysToDelete = new Set<string>([stateKey]);
      if (stateKey === "message") keysToDelete.add("messages");
      if (stateKey === "messages") keysToDelete.add("message");

      const matchedDeclared = declaredChannels.find(
        (ch) => ch.key === stateKey || ch.stateChannelKey === stateKey,
      );
      if (matchedDeclared) {
        keysToDelete.add(matchedDeclared.key);
        if (matchedDeclared.stateChannelKey) {
          for (const sk of matchedDeclared.stateChannelKey.split(",")) {
            keysToDelete.add(sk.trim());
          }
        }
      }

      for (const k of keysToDelete) {
        delete nextMapping[k];
      }

      const currentBindings = step.inputBindings || [];
      const existingKeys = new Set(currentBindings.map((b) => b.argName));
      const backfilledBindings: StepBinding[] = [...currentBindings];

      for (const [k, rawMap] of Object.entries(nextMapping)) {
        if (!existingKeys.has(k) && !keysToDelete.has(k)) {
          backfilledBindings.push({
            argName: k,
            source: accessorToStepSource(rawMap, availableSources),
          });
        }
      }

      const nextBindings = backfilledBindings.filter((b) => !keysToDelete.has(b.argName));

      removeChannelsFromAgentStore({ selectedAgentNode, keysToDelete });

      onChange({
        ...step,
        inputBindings: nextBindings,
        langGraphStateMapping: nextMapping,
      });
      syncAgentInputChannels(nextBindings, nextMapping);
    },
    [mapping, declaredChannels, step, availableSources, selectedAgentNode, onChange, syncAgentInputChannels],
  );

  const handleAddChannel = useCallback(
    (channelKey: string) => {
      if (channelKey === "thread_id" || channelKey === "threadId") return;
      const matchedSource = findMatchingSourceForChannel(channelKey, availableSources);
      const accessor = stepSourceToAccessor(matchedSource, availableSources);
      const nextMapping = {
        ...mapping,
        [channelKey]: accessor || `body.${channelKey}`,
      };

      const bindingToAdd: StepBinding = {
        argName: channelKey,
        source: matchedSource,
      };

      const currentBindings = step.inputBindings || [];
      const existingKeys = new Set(currentBindings.map((b) => b.argName));
      const backfilledBindings: StepBinding[] = [...currentBindings];
      for (const [k, rawMap] of Object.entries(mapping)) {
        if (k !== channelKey && !existingKeys.has(k)) {
          backfilledBindings.push({
            argName: k,
            source: accessorToStepSource(rawMap, availableSources),
          });
        }
      }

      const nextBindings = [
        ...backfilledBindings.filter((b) => b.argName !== channelKey),
        bindingToAdd,
      ];

      onChange({
        ...step,
        inputBindings: nextBindings,
        langGraphStateMapping: nextMapping,
      });
      syncAgentInputChannels(nextBindings, nextMapping);
    },
    [mapping, availableSources, step, onChange, syncAgentInputChannels],
  );

  const handleAutoMap = useCallback(() => {
    const newMapping: Record<string, string> = { ...mapping };
    delete newMapping.thread_id;
    delete newMapping.threadId;
    const newBindings: StepBinding[] = (step.inputBindings || []).filter(
      (b) => b.argName !== "thread_id" && b.argName !== "threadId",
    );

    // Auto-map conversation messages channel if present on agent
    if (
      stateChannels.some((c) => c.key === "messages") ||
      inputChannels.some((c) => c.key === "messages")
    ) {
      newMapping.messages = "body.message";
      if (!newBindings.some((b) => b.argName === "messages")) {
        newBindings.push({
          argName: "messages",
          source: { kind: "req_body", field: "message" },
        });
      }
    }

    declaredChannels.forEach((ch) => {
      const matchedSource = findMatchingSourceForChannel(ch.key, availableSources);
      const accessor = stepSourceToAccessor(matchedSource, availableSources);
      newMapping[ch.key] = accessor;

      const existingIdx = newBindings.findIndex((b) => b.argName === ch.key);
      const updatedB: StepBinding = { argName: ch.key, source: matchedSource };
      if (existingIdx >= 0) {
        newBindings[existingIdx] = updatedB;
      } else {
        newBindings.push(updatedB);
      }
    });

    let nextThreadIdSource = step.langGraphThreadIdSource;
    if (hasMemory && !nextThreadIdSource) {
      const matchedThreadSource = findMatchingSourceForThreadId(availableSources);
      if (matchedThreadSource) {
        nextThreadIdSource = stepSourceToAccessor(
          matchedThreadSource,
          availableSources,
        );
      } else {
        nextThreadIdSource = "body.thread_id";
      }
    }

    onChange({
      ...step,
      inputBindings: newBindings,
      langGraphStateMapping: newMapping,
      ...(hasMemory && nextThreadIdSource
        ? { langGraphThreadIdSource: nextThreadIdSource }
        : {}),
    });
    syncAgentInputChannels(newBindings, newMapping, nextThreadIdSource);
  }, [mapping, step, stateChannels, inputChannels, declaredChannels, availableSources, hasMemory, onChange, syncAgentInputChannels]);

  const handleAddCustomField = useCallback(() => {
    if (!newKey.trim()) return;
    const key = newKey.trim();
    if (key === "thread_id" || key === "threadId") {
      const accessor = stepSourceToAccessor(newCustomBinding.source, availableSources);
      onChange({
        ...step,
        langGraphThreadIdSource: accessor || "body.thread_id",
      });
      setNewKey("");
      return;
    }
    const bindingToAdd: StepBinding = {
      argName: key,
      source: newCustomBinding.source,
    };

    const currentBindings = step.inputBindings || [];
    const existingKeys = new Set(currentBindings.map((b) => b.argName));
    const backfilledBindings: StepBinding[] = [...currentBindings];
    for (const [k, rawMap] of Object.entries(mapping)) {
      if (k !== key && !existingKeys.has(k)) {
        backfilledBindings.push({
          argName: k,
          source: accessorToStepSource(rawMap, availableSources),
        });
      }
    }

    const nextBindings = [
      ...backfilledBindings.filter((b) => b.argName !== key),
      bindingToAdd,
    ];
    const accessor = stepSourceToAccessor(bindingToAdd.source, availableSources);
    const nextMapping = {
      ...mapping,
      [key]: accessor || `body.${key}`,
    };

    onChange({
      ...step,
      inputBindings: nextBindings,
      langGraphStateMapping: nextMapping,
    });
    syncAgentInputChannels(nextBindings, nextMapping);
    setNewKey("");
    setNewCustomBinding({
      argName: "",
      source: { kind: "req_body", field: "" },
    });
  }, [newKey, newCustomBinding, availableSources, step, mapping, onChange, syncAgentInputChannels]);

  return {
    mapping,
    newKey,
    setNewKey,
    newCustomBinding,
    setNewCustomBinding,
    mappedDeclaredChannels,
    customKeys,
    unmappedDeclaredChannels,
    getBindingForChannel,
    handleBindingChange,
    handleRemoveMapping,
    handleAddChannel,
    handleAutoMap,
    handleAddCustomField,
  };
}

