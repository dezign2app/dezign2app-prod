import { useMemo } from "react";
import type {
  CustomTypeItem,
  LangGraphNodePipelineStep,
  LangGraphStateChannel,
} from "@workspace/canvas";
import type { Parameter } from "@/types/canvas";
import type { ReferenceStep, ReferenceStepField } from "./types";
import {
  getChannelDisplayType,
  resolveCustomTypeForChannel,
  extractFieldsFromCustomType,
} from "./utils";
import { toCamelCase } from "../AgentPromptVariablePicker";

interface UseAvailableReferenceStepsParams {
  isStructured: boolean;
  schemaFields: Parameter[];
  pipelineSteps?: LangGraphNodePipelineStep[];
  stateChannels?: LangGraphStateChannel[];
  availableCustomTypes?: CustomTypeItem[];
}

export function useAvailableReferenceSteps({
  isStructured,
  schemaFields,
  pipelineSteps = [],
  stateChannels = [],
  availableCustomTypes = [],
}: UseAvailableReferenceStepsParams): ReferenceStep[] {
  return useMemo(() => {
    const steps: ReferenceStep[] = [];

    // 1. LLM Agent Step
    const llmFields: ReferenceStepField[] = [
      { path: "response.content", label: "content (AI Text)", short: "response.content", type: "string" },
      { path: "response", label: "response (Whole Message)", short: "response", type: "object" },
    ];

    if (isStructured && schemaFields.length > 0) {
      for (const sf of schemaFields) {
        if (!sf.name?.trim()) continue;
        llmFields.push({
          path: `response.${sf.name.trim()}`,
          label: `${sf.name} (${sf.type || "string"})`,
          short: `response.${sf.name.trim()}`,
          type: sf.type || "string",
        });
      }
    }

    llmFields.push(
      { path: "response.role", label: "role (string)", short: "response.role", type: "string" },
      { path: "response.tool_calls", label: "tool_calls (array)", short: "response.tool_calls", type: "array" },
    );

    steps.push({
      id: "response",
      label: "llmAgent (response)",
      fields: llmFields,
    });

    // 2. All Pipeline Steps (LLM steps, transformers, custom code, tools, etc.)
    pipelineSteps.forEach((ps, idx) => {
      const stepNum = idx + 1;
      const stepVar = ps.outputVariable || ps.id || `step${stepNum}`;
      const rawStepName = ps.label || ps.name || ps.type;
      const stepName = toCamelCase(rawStepName) || rawStepName;
      const stepLabel = `${stepName} (${stepVar})`;

      const pFields: ReferenceStepField[] = [
        { path: stepVar, label: `${stepVar} (Whole Output)`, short: stepVar, type: "object" },
      ];

      const returnSchema = ps.outputSchema || ps.functionRef?.returnSchema || [];
      returnSchema.forEach((rf) => {
        if (rf.name?.trim()) {
          pFields.push({
            path: `${stepVar}.${rf.name.trim()}`,
            label: `${rf.name} (${rf.type || "string"})`,
            short: `${stepVar}.${rf.name.trim()}`,
            type: rf.type || "string",
          });
        }
      });

      if (ps.type === "custom_code") {
        pFields.push({
          path: `${stepVar}.result`,
          label: "result (output)",
          short: `${stepVar}.result`,
          type: "string",
        });
      } else if (ps.type === "tools") {
        pFields.push(
          {
            path: `${stepVar}.output`,
            label: "output (object)",
            short: `${stepVar}.output`,
            type: "object",
          },
          {
            path: `${stepVar}.content`,
            label: "content (string)",
            short: `${stepVar}.content`,
            type: "string",
          },
        );
      } else if (ps.type === "llm_call") {
        pFields.push(
          {
            path: `${stepVar}.content`,
            label: "content (string)",
            short: `${stepVar}.content`,
            type: "string",
          },
          {
            path: `${stepVar}.response`,
            label: "response (object)",
            short: `${stepVar}.response`,
            type: "object",
          },
        );
      } else if (returnSchema.length === 0) {
        pFields.push(
          {
            path: `${stepVar}.output`,
            label: "output (data)",
            short: `${stepVar}.output`,
            type: "object",
          },
          {
            path: `${stepVar}.content`,
            label: "content (string)",
            short: `${stepVar}.content`,
            type: "string",
          },
        );
      }

      steps.push({
        id: stepVar,
        label: stepLabel,
        fields: pFields,
      });
    });

    // 3. Graph State Variables
    if (stateChannels.length > 0) {
      const stateFields: ReferenceStepField[] = [];

      stateChannels
        .filter((c) => Boolean(c.key?.trim()))
        .forEach((c) => {
          const typeLabel = getChannelDisplayType(c, availableCustomTypes);
          stateFields.push({
            path: `state.${c.key}`,
            label: `state.${c.key} (${typeLabel})`,
            short: `state.${c.key}`,
            type: c.type,
          });

          // Check if custom type schema has fields
          const schema = resolveCustomTypeForChannel(c, availableCustomTypes);
          const fields = extractFieldsFromCustomType(schema);

          if (fields.length > 0) {
            fields.forEach((f) => {
              if (f && f.name && !f.isOmitted) {
                const fieldTypeStr = f.isArray ? `${f.type}[]` : f.type;
                stateFields.push({
                  path: `state.${c.key}.${f.name}`,
                  label: `state.${c.key}.${f.name} (${fieldTypeStr})`,
                  short: `state.${c.key}.${f.name}`,
                  type: f.type,
                });
              }
            });
          }
        });

      steps.push({
        id: "state",
        label: "Graph State (state.*)",
        fields: stateFields,
      });
    }

    return steps;
  }, [isStructured, schemaFields, pipelineSteps, stateChannels, availableCustomTypes]);
}
