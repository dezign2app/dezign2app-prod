import { useState, useEffect, useMemo, useCallback } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import type {
  AgentNodeData,
  LangGraphNodeStepType,
  LangGraphNodePipelineStep,
  LangGraphAgentResponseFormatConfig,
} from "@workspace/canvas";
import { deriveInitialPipelineSteps } from "./stepTypes";
import { toCamelCase } from "./AgentPromptVariablePicker";

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

  useEffect(() => {
    if (selectedAgentData.pipelineSteps && selectedAgentData.pipelineSteps.length > 0) {
      let needsUpdate = false;
      const normalized = selectedAgentData.pipelineSteps.map((step) => {
        const rawLabel = step.label || step.name || "";
        const camelLabel = toCamelCase(rawLabel) || rawLabel;
        const camelName = toCamelCase(step.name || rawLabel) || camelLabel;
        const camelOutVar = step.outputVariable
          ? toCamelCase(step.outputVariable) || step.outputVariable
          : step.outputVariable;
        if (
          step.label !== camelLabel ||
          step.name !== camelName ||
          step.outputVariable !== camelOutVar
        ) {
          needsUpdate = true;
          return {
            ...step,
            label: camelLabel,
            name: camelName,
            outputVariable: camelOutVar,
          };
        }
        return step;
      });

      if (needsUpdate) {
        setActivePipelineSteps(normalized);
        onUpdateAgent({ pipelineSteps: normalized });
      }
    }
  }, [selectedAgentData.pipelineSteps, onUpdateAgent]);

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
      let prefix = "step";
      if (type === "transformer" || type === "transform") prefix = "trans";
      else if (type === "custom_code") prefix = "code";
      else if (type === "llm_call") prefix = "llm";
      else if (type === "db_operation") prefix = "db";
      else if (type === "redis_operation") prefix = "redis";
      else if (type === "storage_operation") prefix = "storage";
      else if (type === "kafka_publish") prefix = "kafka";
      else if (type === "external_call") prefix = "api";
      else if (type === "service_call") prefix = "service";
      else if (type === "variable") prefix = "var";
      else if (type === "condition") prefix = "cond";
      else if (type === "try_catch") prefix = "try";
      else if (type === "switch") prefix = "switch";
      else if (type === "parallel") prefix = "parallel";
      else if (type === "loop") prefix = "loop";
      else if (type === "push_to_client") prefix = "push";

      const newStepId = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const typeCount = activePipelineSteps.filter((s) => s.type === type).length + 1;

      let defaultLabel = `step${activePipelineSteps.length + 1}`;
      if (type === "transformer" || type === "transform") {
        const hasLLM = activePipelineSteps.some((s) => s.type === "llm_call");
        const existingTransCount = activePipelineSteps.filter(
          (s) => s.type === "transformer" || s.type === "transform",
        ).length;
        if (!hasLLM && existingTransCount === 0) {
          defaultLabel = "dataPreparation";
        } else if (hasLLM && existingTransCount === 0) {
          defaultLabel = "responseTransform";
        } else {
          defaultLabel = `transformer${existingTransCount + 1}`;
        }
      } else if (type === "custom_code") {
        const hasLLM = activePipelineSteps.some((s) => s.type === "llm_call");
        const existingCodeCount = activePipelineSteps.filter(
          (s) => s.type === "custom_code",
        ).length;
        if (!hasLLM && existingCodeCount === 0) {
          defaultLabel = "preProcessing";
        } else if (hasLLM && existingCodeCount === 0) {
          defaultLabel = "postProcessing";
        } else {
          defaultLabel = `customCode${existingCodeCount + 1}`;
        }
      } else if (type === "llm_call") {
        defaultLabel = typeCount > 1 ? `llmAgent${typeCount}` : "llmAgent";
      } else if (type === "db_operation") {
        defaultLabel = `dbOperation${typeCount}`;
      } else if (type === "redis_operation") {
        defaultLabel = `redis${typeCount}`;
      } else if (type === "storage_operation") {
        defaultLabel = `storage${typeCount}`;
      } else if (type === "kafka_publish") {
        defaultLabel = `kafkaPublish${typeCount}`;
      } else if (type === "external_call") {
        defaultLabel = `externalApi${typeCount}`;
      } else if (type === "service_call") {
        defaultLabel = `serviceCall${typeCount}`;
      } else if (type === "variable") {
        defaultLabel = `variable${typeCount}`;
      } else if (type === "condition") {
        defaultLabel = `ifElse${typeCount}`;
      } else if (type === "try_catch") {
        defaultLabel = `tryCatch${typeCount}`;
      } else if (type === "push_to_client") {
        defaultLabel = `pushToClient${typeCount}`;
      }

      let stepSpecificProps: Partial<LangGraphNodePipelineStep> = {};
      if (type === "transformer" || type === "transform") {
        stepSpecificProps = {
          outputVariable: `transformedData${activePipelineSteps.length + 1}`,
          outputSchema: [{ name: "result", type: "string", required: true }],
          inputBindings: [],
        };
      } else if (type === "custom_code") {
        stepSpecificProps = {
          customCode: "// TypeScript logic: (state, clone) => Partial<State>\nreturn {\n  // mutate channels\n};\n",
        };
      } else if (type === "llm_call") {
        stepSpecificProps = {
          outputVariable: typeCount > 1 ? `llmResponse${typeCount}` : "response",
          llmConfig: { enabled: true },
        };
      } else if (type === "db_operation") {
        stepSpecificProps = {
          outputVariable: `dbResult${typeCount}`,
          declarationKind: "const",
          inputBindings: [],
        };
      } else if (type === "redis_operation") {
        stepSpecificProps = {
          outputVariable: `cachedData${typeCount}`,
          declarationKind: "const",
          inputBindings: [],
        };
      } else if (type === "storage_operation") {
        stepSpecificProps = {
          outputVariable: `storageResult${typeCount}`,
          declarationKind: "const",
          inputBindings: [],
        };
      } else if (type === "kafka_publish") {
        stepSpecificProps = {
          outputVariable: `publishResult${typeCount}`,
          declarationKind: "const",
          inputBindings: [],
        };
      } else if (type === "external_call") {
        stepSpecificProps = {
          outputVariable: `apiResponse${typeCount}`,
          declarationKind: "const",
          inputBindings: [],
        };
      } else if (type === "service_call") {
        stepSpecificProps = {
          outputVariable: `serviceResponse${typeCount}`,
          declarationKind: "const",
          inputBindings: [],
        };
      } else if (type === "variable") {
        stepSpecificProps = {
          outputVariable: `myVar${typeCount}`,
          variableOperation: "declare",
          declarationKind: "const",
          variableDataType: "string",
        };
      } else if (type === "condition") {
        stepSpecificProps = {
          thenSteps: [],
          elseSteps: [],
        };
      } else if (type === "try_catch") {
        stepSpecificProps = {
          trySteps: [],
          catchSteps: [],
        };
      } else if (type === "push_to_client") {
        stepSpecificProps = {
          pushProtocol: "sse",
          inputBindings: [],
        };
      }

      const newStep: LangGraphNodePipelineStep = {
        id: newStepId,
        type,
        label: defaultLabel,
        name: defaultLabel,
        enabled: true,
        ...stepSpecificProps,
      };

      const nextSteps = [...activePipelineSteps, newStep];
      setActivePipelineSteps(nextSteps);
      setExpandedSteps((prev) => ({ ...prev, [newStepId]: true }));

      const updates: Partial<AgentNodeData> = {
        pipelineSteps: nextSteps,
        nodeSteps: nextSteps.map((s) => s.type),
      };

      if (type === "custom_code" && !selectedAgentData.customCode?.body) {
        updates.customCode = { body: newStep.customCode || "" };
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
        updates.customCode = { body: remainingCodeSteps[0].customCode };
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
        s.id === stepId ? { ...s, customCode: body } : s,
      );
      setActivePipelineSteps(next);
      const firstCode = next.find((s) => s.type === "custom_code");
      onUpdateAgent({
        pipelineSteps: next,
        nodeSteps: next.map((s) => s.type),
        ...(firstCode?.customCode ? { customCode: { body: firstCode.customCode } } : {}),
      });
    },
    [activePipelineSteps, onUpdateAgent],
  );

  const handleUpdateStepLabel = useCallback(
    (stepId: string, label: string) => {
      const next = activePipelineSteps.map((s) =>
        s.id === stepId ? { ...s, label, name: label } : s,
      );
      setActivePipelineSteps(next);
      onUpdateAgent({
        pipelineSteps: next,
      });
    },
    [activePipelineSteps, onUpdateAgent],
  );

  const handleUpdateStep = useCallback(
    (updatedStep: LangGraphNodePipelineStep) => {
      const next = activePipelineSteps.map((s) =>
        s.id === updatedStep.id ? updatedStep : s,
      );
      setActivePipelineSteps(next);
      onUpdateAgent({
        pipelineSteps: next,
        nodeSteps: next.map((st) => st.type),
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
    handleUpdateStep,
  };
}
