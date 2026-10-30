"use client";

import { useMemo, useCallback } from "react";
import { LangGraphMessagesConfig } from "@workspace/canvas/types";
import { PipelineStepDraft, StepBinding, AvailableSource } from "../../types";
import { stepSourceToAccessor, accessorToStepSource } from "../utils";

export interface UseConversationMessagesParams {
  step: PipelineStepDraft;
  mapping: Record<string, string>;
  availableSources: AvailableSource[];
  onChange: (updated: PipelineStepDraft) => void;
}

export function useConversationMessages({
  step,
  mapping,
  availableSources,
  onChange,
}: UseConversationMessagesParams) {
  const effectiveMessagesMode: "single" | "bulk" = step.langGraphMessagesConfig?.mode || "single";

  const userMessageBinding = useMemo<StepBinding>(() => {
    const srcStr =
      step.langGraphMessagesConfig?.userMessageSource ||
      (mapping.messages && !mapping.messages.includes(".messages") ? mapping.messages : "body.message");
    return {
      argName: "user_message",
      source: accessorToStepSource(srcStr, availableSources),
    };
  }, [step.langGraphMessagesConfig, mapping.messages, availableSources]);

  const hasSystemPrompt = useMemo(() => {
    return (
      typeof step.langGraphMessagesConfig?.systemMessageSource === "string" &&
      step.langGraphMessagesConfig.systemMessageSource.trim().length > 0
    );
  }, [step.langGraphMessagesConfig]);

  const hasAiMessage = useMemo(() => {
    return (
      typeof step.langGraphMessagesConfig?.aiMessageSource === "string" &&
      step.langGraphMessagesConfig.aiMessageSource.trim().length > 0
    );
  }, [step.langGraphMessagesConfig]);

  const systemMessageBinding = useMemo<StepBinding>(() => {
    const srcStr = step.langGraphMessagesConfig?.systemMessageSource || "";
    return {
      argName: "system_prompt",
      source: accessorToStepSource(srcStr, availableSources),
    };
  }, [step.langGraphMessagesConfig, availableSources]);

  const aiMessageBinding = useMemo<StepBinding>(() => {
    const srcStr = step.langGraphMessagesConfig?.aiMessageSource || "";
    return {
      argName: "ai_message",
      source: accessorToStepSource(srcStr, availableSources),
    };
  }, [step.langGraphMessagesConfig, availableSources]);

  const bulkMessagesBinding = useMemo<StepBinding>(() => {
    const srcStr =
      step.langGraphMessagesConfig?.bulkMessagesSource ||
      (mapping.messages && mapping.messages.includes(".messages") ? mapping.messages : "body.messages");
    return {
      argName: "messages",
      source: accessorToStepSource(srcStr, availableSources),
    };
  }, [step.langGraphMessagesConfig, mapping.messages, availableSources]);

  const handleMessagesModeChange = useCallback(
    (mode: "single" | "bulk") => {
      const currentCfg = step.langGraphMessagesConfig || {};
      const nextCfg: LangGraphMessagesConfig = {
        ...currentCfg,
        mode,
        userMessageSource: currentCfg.userMessageSource || mapping.messages || "body.message",
        bulkMessagesSource: currentCfg.bulkMessagesSource || "body.messages",
      };
      const nextMapping = { ...mapping };
      nextMapping.messages =
        mode === "bulk"
          ? nextCfg.bulkMessagesSource || "body.messages"
          : nextCfg.userMessageSource || "body.message";

      onChange({
        ...step,
        langGraphMessagesConfig: nextCfg,
        langGraphStateMapping: nextMapping,
      });
    },
    [step, mapping, onChange],
  );

  const handleUserMessageBindingChange = useCallback(
    (updated: StepBinding) => {
      const accessor = stepSourceToAccessor(updated.source, availableSources);
      const currentCfg = step.langGraphMessagesConfig || {};
      const nextCfg: LangGraphMessagesConfig = {
        ...currentCfg,
        mode: currentCfg.mode || "single",
        userMessageSource: accessor,
      };
      const nextMapping = { ...mapping, messages: accessor };
      onChange({
        ...step,
        langGraphMessagesConfig: nextCfg,
        langGraphStateMapping: nextMapping,
      });
    },
    [step, mapping, availableSources, onChange],
  );

  const handleSystemMessageBindingChange = useCallback(
    (updated: StepBinding) => {
      const accessor = stepSourceToAccessor(updated.source, availableSources);
      const currentCfg = step.langGraphMessagesConfig || {};
      const nextCfg: LangGraphMessagesConfig = {
        ...currentCfg,
        mode: currentCfg.mode || "single",
        systemMessageSource: accessor,
      };
      onChange({
        ...step,
        langGraphMessagesConfig: nextCfg,
      });
    },
    [step, availableSources, onChange],
  );

  const handleAddSystemPrompt = useCallback(() => {
    const currentCfg = step.langGraphMessagesConfig || {};
    let defaultSource = "body.systemPrompt";
    for (const src of availableSources) {
      if (src.kind === "req_body") {
        const p = src.paths.find((item) =>
          /system|instruction|prompt/i.test(item.path) && !/message|chat/i.test(item.path),
        );
        if (p) {
          defaultSource = `body.${p.path}`;
          break;
        }
      }
    }
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode: currentCfg.mode || "single",
      systemMessageSource: defaultSource,
    };
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  }, [step, availableSources, onChange]);

  const handleRemoveSystemPrompt = useCallback(() => {
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = { ...currentCfg };
    delete nextCfg.systemMessageSource;
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  }, [step, onChange]);

  const handleAddAiMessage = useCallback(() => {
    const currentCfg = step.langGraphMessagesConfig || {};
    let defaultSource = "body.aiMessage";
    for (const src of availableSources) {
      if (src.kind === "req_body") {
        const p = src.paths.find((item) =>
          /ai|assistant|context/i.test(item.path) && !/system|user/i.test(item.path),
        );
        if (p) {
          defaultSource = `body.${p.path}`;
          break;
        }
      }
    }
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode: currentCfg.mode || "single",
      aiMessageSource: defaultSource,
    };
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  }, [step, availableSources, onChange]);

  const handleRemoveAiMessage = useCallback(() => {
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = { ...currentCfg };
    delete nextCfg.aiMessageSource;
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  }, [step, onChange]);

  const handleAiMessageBindingChange = useCallback(
    (updated: StepBinding) => {
      const accessor = stepSourceToAccessor(updated.source, availableSources);
      const currentCfg = step.langGraphMessagesConfig || {};
      const nextCfg: LangGraphMessagesConfig = {
        ...currentCfg,
        mode: currentCfg.mode || "single",
        aiMessageSource: accessor,
      };
      onChange({
        ...step,
        langGraphMessagesConfig: nextCfg,
      });
    },
    [step, availableSources, onChange],
  );

  const handleBulkMessagesBindingChange = useCallback(
    (updated: StepBinding) => {
      const accessor = stepSourceToAccessor(updated.source, availableSources);
      const currentCfg = step.langGraphMessagesConfig || {};
      const nextCfg: LangGraphMessagesConfig = {
        ...currentCfg,
        mode: "bulk",
        bulkMessagesSource: accessor,
      };
      const nextMapping = { ...mapping, messages: accessor };
      onChange({
        ...step,
        langGraphMessagesConfig: nextCfg,
        langGraphStateMapping: nextMapping,
      });
    },
    [step, mapping, availableSources, onChange],
  );

  return {
    effectiveMessagesMode,
    userMessageBinding,
    systemMessageBinding,
    aiMessageBinding,
    bulkMessagesBinding,
    hasSystemPrompt,
    hasAiMessage,
    handleMessagesModeChange,
    handleUserMessageBindingChange,
    handleSystemMessageBindingChange,
    handleAddSystemPrompt,
    handleRemoveSystemPrompt,
    handleAddAiMessage,
    handleRemoveAiMessage,
    handleAiMessageBindingChange,
    handleBulkMessagesBindingChange,
  };
}

