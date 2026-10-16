import { useState, useEffect, useMemo, useCallback } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import type {
  AgentNodeData,
  LangGraphNodeStepType,
  LangGraphNodePipelineStep,
  LangGraphAgentResponseFormatConfig,
} from "@workspace/canvas";
import { deriveInitialPipelineSteps } from "./stepTypes";

interface UseAgentPipelineStepsProps {
  selectedAgentData: AgentNodeData;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  connectedLLMId?: string | null;
  connectedToolIds?: string[];
  connectedMiddlewareIds?: string[];
  rfConfig: LangGraphAgentResponseFormatConfig;
  onSelectLLM?: (llmId: string | null) => void;
}

export function useAgentPipelineSteps({
  selectedAgentData,
  onUpdateAgent,
  connectedLLMId,
  connectedToolIds,
  connectedMiddlewareIds,
  rfConfig,
  onSelectLLM,
}: UseAgentPipelineStepsProps) {
  const initialPipelineSteps = useMemo(() => {
    return deriveInitialPipelineSteps(
      selectedAgentData,
      connectedLLMId,
      connectedToolIds,
      connectedMiddlewareIds,
    );
  }, [
    selectedAgentData,
    connectedLLMId,
    connectedToolIds,
    connectedMiddlewareIds,
  ]);

  const [activePipelineSteps, setActivePipelineSteps] =
    useState<LangGraphNodePipelineStep[]>(initialPipelineSteps);

  useEffect(() => {
    setActivePipelineSteps(initialPipelineSteps);
  }, [initialPipelineSteps]);

  // Expanded state per step instance ID
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    initialPipelineSteps.forEach((s) => {
      init[s.id] = true;
    });
    return init;
  });

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  }, []);

  const handleExpandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    activePipelineSteps.forEach((s) => {
      next[s.id] = true;
    });
    setExpandedSteps(next);
  }, [activePipelineSteps]);

  const handleCollapseAll = useCallback(() => {
    setExpandedSteps({});
  }, []);

  const handleMoveStep = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= activePipelineSteps.length) return;
      const copy = [...activePipelineSteps];
      const item = copy[fromIndex];
      if (!item) return;
      copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      setActivePipelineSteps(copy);
      onUpdateAgent({
        pipelineSteps: copy,
        nodeSteps: copy.map((s) => s.type),
      });
    },
    [activePipelineSteps, onUpdateAgent],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      if (result.destination.index === result.source.index) return;
      handleMoveStep(result.source.index, result.destination.index);
    },
    [handleMoveStep],
  );

  const handleAddStep = useCallback(
    (type: LangGraphNodeStepType) => {
      const prefix =
        type === "transformer" || type === "transform"
          ? "trans"
          : type === "custom_code"
            ? "code"
            : "llm";
      const newStepId = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      let defaultLabel = "Step";
      if (type === "transformer" || type === "transform") {
        const hasLLM = activePipelineSteps.some((s) => s.type === "llm_call");
        const existingTransCount = activePipelineSteps.filter(
          (s) => s.type === "transformer" || s.type === "transform",
        ).length;
        if (!hasLLM && existingTransCount === 0) {
          defaultLabel = "Data Preparation";
        } else if (hasLLM && existingTransCount === 0) {
          defaultLabel = "Response Transform";
        } else {
          defaultLabel = `Transformer ${existingTransCount + 1}`;
        }
      } else if (type === "custom_code") {
        const hasLLM = activePipelineSteps.some((s) => s.type === "llm_call");
        const existingCodeCount = activePipelineSteps.filter(
          (s) => s.type === "custom_code",
        ).length;
        if (!hasLLM && existingCodeCount === 0) {
          defaultLabel = "Pre-processing";
        } else if (hasLLM && existingCodeCount === 0) {
          defaultLabel = "Post-processing";
        } else {
          defaultLabel = `Custom Code ${existingCodeCount + 1}`;
        }
      } else if (type === "llm_call") {
        const existingLlmCount = activePipelineSteps.filter(
          (s) => s.type === "llm_call",
        ).length;
        if (existingLlmCount > 0) {
          defaultLabel = `LLM Agent ${existingLlmCount + 1}`;
        } else {
          defaultLabel = "LLM Agent";
        }
      }

      const newStep: LangGraphNodePipelineStep = {
        id: newStepId,
        type,
        label: defaultLabel,
        ...(type === "transformer" || type === "transform"
          ? {
              outputVariable: `transformedData_${activePipelineSteps.length + 1}`,
              inputBindings: [],
              customCode: {
                body: "// TypeScript logic: (inputs, state, clone) => transformed\nreturn {\n  // return transformed fields\n};\n",
              },
            }
          : type === "custom_code"
            ? {
                customCode: {
                  body: "// TypeScript logic: (state, clone) => Partial<State>\nreturn {\n  // mutate channels\n};\n",
                },
              }
            : {
                llmConfig: { enabled: true },
              }),
      };

      const nextSteps = [...activePipelineSteps, newStep];
      setActivePipelineSteps(nextSteps);
      setExpandedSteps((prev) => ({ ...prev, [newStepId]: true }));

      const updates: Partial<AgentNodeData> = {
        pipelineSteps: nextSteps,
        nodeSteps: nextSteps.map((s) => s.type),
      };

      if (type === "custom_code" && !selectedAgentData.customCode?.body) {
        updates.customCode = newStep.customCode;
      } else if (type === "llm_call") {
        updates.llmConfig = {
          ...(selectedAgentData.llmConfig || {}),
          enabled: true,
        };
      }

      onUpdateAgent(updates);
    },
    [activePipelineSteps, onUpdateAgent, selectedAgentData],
  );

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const nextSteps = activePipelineSteps.filter((s) => s.id !== stepId);
      setActivePipelineSteps(nextSteps);

      const updates: Partial<AgentNodeData> = {
        pipelineSteps: nextSteps,
        nodeSteps: nextSteps.map((s) => s.type),
      };

      const remainingCodeSteps = nextSteps.filter((s) => s.type === "custom_code");
      if (remainingCodeSteps.length === 0) {
        updates.customCode = { body: "" };
      } else if (remainingCodeSteps[0]?.customCode) {
        updates.customCode = remainingCodeSteps[0].customCode;
      }

      const remainingLlmSteps = nextSteps.filter((s) => s.type === "llm_call");
      if (remainingLlmSteps.length === 0) {
        updates.llmConfig = {
          ...(selectedAgentData.llmConfig || {}),
          enabled: false,
        };
        updates.responseFormat = {
          ...(selectedAgentData.responseFormat || rfConfig),
          enabled: false,
        };
        updates.middlewareConfig = {
          ...(selectedAgentData.middlewareConfig || {}),
          enabled: false,
        };
        updates.systemPrompt = "";
        onSelectLLM?.(null);
      }

      onUpdateAgent(updates);
    },
    [activePipelineSteps, onSelectLLM, onUpdateAgent, selectedAgentData, rfConfig],
  );

  const handleUpdateStepCode = useCallback(
    (stepId: string, body: string) => {
      const next = activePipelineSteps.map((s) =>
        s.id === stepId ? { ...s, customCode: { body } } : s,
      );
      setActivePipelineSteps(next);
      const firstCode = next.find((s) => s.type === "custom_code");
      onUpdateAgent({
        pipelineSteps: next,
        nodeSteps: next.map((s) => s.type),
        ...(firstCode?.customCode ? { customCode: firstCode.customCode } : {}),
      });
    },
    [activePipelineSteps, onUpdateAgent],
  );

  const handleUpdateStepLabel = useCallback(
    (stepId: string, label: string) => {
      const next = activePipelineSteps.map((s) =>
        s.id === stepId ? { ...s, label } : s,
      );
      setActivePipelineSteps(next);
      onUpdateAgent({
        pipelineSteps: next,
      });
    },
    [activePipelineSteps, onUpdateAgent],
  );

  const allOpen =
    activePipelineSteps.length > 0 &&
    activePipelineSteps.every((s) => expandedSteps[s.id]);

  return {
    activePipelineSteps,
    setActivePipelineSteps,
    expandedSteps,
    setExpandedSteps,
    allOpen,
    toggleStep,
    handleExpandAll,
    handleCollapseAll,
    handleAddStep,
    handleDeleteStep,
    handleMoveStep,
    handleDragEnd,
    handleUpdateStepCode,
    handleUpdateStepLabel,
  };
}
